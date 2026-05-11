const pool = require('../db/pool');
const { hashPassword, signToken, verifyPassword } = require('../utils/security');

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    status: user.status,
  };
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'email and password are required.',
    });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, display_name, role, status FROM capi_users WHERE email = $1 LIMIT 1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];

    if (!user || user.status !== 'active' || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    return res.json({
      success: true,
      message: 'Logged in.',
      data: {
        token: signToken({ user_id: user.id }),
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    console.error('Login failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Could not log in.',
    });
  }
}

async function me(req, res) {
  return res.json({
    success: true,
    data: {
      type: req.auth.type,
      role: req.auth.role,
      is_admin: req.auth.is_admin,
      can_write: req.auth.can_write,
      user: sanitizeUser(req.auth.user),
    },
  });
}

async function bootstrapAdmin(req, res) {
  const { email, password, display_name } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'email and password are required.',
    });
  }

  try {
    const existing = await pool.query('SELECT COUNT(*)::integer AS total FROM capi_users');

    if (existing.rows[0].total > 0 && !req.auth.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin already exists.',
      });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO capi_users (email, password_hash, display_name, role, status)
        VALUES ($1, $2, $3, 'admin', 'active')
        ON CONFLICT (email)
        DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          display_name = EXCLUDED.display_name,
          role = 'admin',
          status = 'active',
          updated_at = NOW()
        RETURNING id, email, display_name, role, status
      `,
      [email.toLowerCase().trim(), hashPassword(password), display_name || 'Administrator']
    );

    return res.status(201).json({
      success: true,
      message: 'Admin user ready.',
      data: sanitizeUser(rows[0]),
    });
  } catch (error) {
    console.error('Bootstrap admin failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Could not bootstrap admin.',
    });
  }
}

module.exports = {
  bootstrapAdmin,
  login,
  me,
  sanitizeUser,
};
