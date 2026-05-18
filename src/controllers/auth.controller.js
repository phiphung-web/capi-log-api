const pool = require('../db/pool');
const { hashPassword, signToken, verifyPassword } = require('../utils/security');

function readPositiveSeconds(value, fallback, minimum = 60 * 15) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(Math.trunc(parsed), minimum);
}

const DEFAULT_SESSION_SECONDS = readPositiveSeconds(
  process.env.SESSION_TTL_SECONDS,
  60 * 60 * 8
);
const REMEMBER_SESSION_SECONDS = Math.max(
  readPositiveSeconds(process.env.REMEMBER_SESSION_TTL_SECONDS, 60 * 60 * 24 * 30),
  DEFAULT_SESSION_SECONDS
);

function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return /^(true|1|yes|on)$/i.test(value.trim());
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return false;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    status: user.status,
  };
}

async function login(req, res) {
  const { username, password } = req.body || {};
  const rememberMe = parseBoolean(req.body?.remember_me);

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'username and password are required.',
    });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, password_hash, display_name, role, status FROM capi_users WHERE username = $1 LIMIT 1',
      [username.trim()]
    );
    const user = rows[0];

    if (!user || user.status !== 'active' || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const expiresInSeconds = rememberMe ? REMEMBER_SESSION_SECONDS : DEFAULT_SESSION_SECONDS;
    const token = signToken({ user_id: user.id }, { expiresInSeconds });

    return res.json({
      success: true,
      message: 'Logged in.',
      data: {
        token,
        remember_me: Boolean(rememberMe),
        expires_in_seconds: expiresInSeconds,
        expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
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
      expires_at: req.auth.expires_at || null,
      user: sanitizeUser(req.auth.user),
    },
  });
}

async function bootstrapAdmin(req, res) {
  const { username, password, display_name } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'username and password are required.',
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
        INSERT INTO capi_users (username, email, password_hash, display_name, role, status)
        VALUES ($1, $2, $3, $4, 'admin', 'active')
        ON CONFLICT (username)
        DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          role = 'admin',
          status = 'active',
          updated_at = NOW()
        RETURNING id, username, email, display_name, role, status
      `,
      [
        username.trim(),
        `${username.trim()}@local.admin`,
        hashPassword(password),
        display_name || 'Administrator',
      ]
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

async function ensureDefaultAdmin() {
  const username = process.env.DEFAULT_ADMIN_USERNAME;
  const password = process.env.DEFAULT_ADMIN_PASSWORD;
  const displayName = process.env.DEFAULT_ADMIN_DISPLAY_NAME || 'Administrator';

  if (!username || !password) {
    return;
  }

  await pool.query(
    `
      INSERT INTO capi_users (username, email, password_hash, display_name, role, status)
      VALUES ($1, $2, $3, $4, 'admin', 'active')
      ON CONFLICT (username)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        role = 'admin',
        status = 'active',
        updated_at = NOW()
    `,
    [
      username.trim(),
      `${username.trim()}@local.admin`,
      hashPassword(password),
      displayName,
    ]
  );

  console.log(`Default admin user ready: ${username.trim()}`);
}

module.exports = {
  bootstrapAdmin,
  ensureDefaultAdmin,
  login,
  me,
  sanitizeUser,
};
