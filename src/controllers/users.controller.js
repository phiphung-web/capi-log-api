const pool = require('../db/pool');
const { hashPassword } = require('../utils/security');
const { sanitizeUser } = require('./auth.controller');

const ROLES = new Set(['admin', 'manager', 'viewer']);
const STATUSES = new Set(['active', 'disabled']);

async function listUsers(req, res) {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          u.id,
          u.email,
          u.display_name,
          u.role,
          u.status,
          u.created_at,
          u.updated_at,
          COALESCE(
            json_agg(DISTINCT uma.market_key) FILTER (WHERE uma.market_key IS NOT NULL),
            '[]'
          ) AS markets,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('market_key', upa.market_key, 'product_key', upa.product_key))
              FILTER (WHERE upa.product_key IS NOT NULL),
            '[]'
          ) AS products
        FROM capi_users u
        LEFT JOIN capi_user_market_access uma ON uma.user_id = u.id
        LEFT JOIN capi_user_product_access upa ON upa.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Failed to list users:', error);
    return res.status(500).json({ success: false, message: 'Could not list users.' });
  }
}

async function createUser(req, res) {
  const { email, password, display_name, role = 'viewer', status = 'active' } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required.' });
  }

  if (!ROLES.has(role) || !STATUSES.has(status)) {
    return res.status(400).json({ success: false, message: 'Invalid role or status.' });
  }

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO capi_users (email, password_hash, display_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, display_name, role, status
      `,
      [email.toLowerCase().trim(), hashPassword(password), display_name || null, role, status]
    );

    return res.status(201).json({
      success: true,
      message: 'User created.',
      data: sanitizeUser(rows[0]),
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    return res.status(500).json({ success: false, message: 'Could not create user.' });
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { display_name, role, status, password } = req.body || {};

  if (role && !ROLES.has(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role.' });
  }

  if (status && !STATUSES.has(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  try {
    const { rows } = await pool.query(
      `
        UPDATE capi_users
        SET
          display_name = COALESCE($2, display_name),
          role = COALESCE($3, role),
          status = COALESCE($4, status),
          password_hash = COALESCE($5, password_hash),
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, display_name, role, status
      `,
      [id, display_name, role, status, password ? hashPassword(password) : null]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true, message: 'User updated.', data: sanitizeUser(rows[0]) });
  } catch (error) {
    console.error('Failed to update user:', error);
    return res.status(500).json({ success: false, message: 'Could not update user.' });
  }
}

async function updateUserAccess(req, res) {
  const { id } = req.params;
  const { markets = [], products = [] } = req.body || {};
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM capi_user_market_access WHERE user_id = $1', [id]);
    await client.query('DELETE FROM capi_user_product_access WHERE user_id = $1', [id]);

    for (const marketKey of markets) {
      await client.query(
        'INSERT INTO capi_user_market_access (user_id, market_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, marketKey]
      );
    }

    for (const product of products) {
      await client.query(
        `
          INSERT INTO capi_user_product_access (user_id, market_key, product_key)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `,
        [id, product.market_key, product.product_key]
      );
    }

    await client.query('COMMIT');
    return res.json({ success: true, message: 'User access updated.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to update user access:', error);
    return res.status(500).json({ success: false, message: 'Could not update user access.' });
  } finally {
    client.release();
  }
}

module.exports = {
  createUser,
  listUsers,
  updateUser,
  updateUserAccess,
};
