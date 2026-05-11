const pool = require('../db/pool');
const { verifyToken } = require('../utils/security');

async function auth(req, res, next) {
  const expectedToken = process.env.API_TOKEN;

  if (!expectedToken) {
    console.error('API_TOKEN is not configured.');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error.',
    });
  }

  const authHeader = req.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized.',
    });
  }

  if (token === expectedToken) {
    req.auth = {
      type: 'api_token',
      role: 'admin',
      is_admin: true,
      can_write: true,
      user: null,
    };
    return next();
  }

  const payload = verifyToken(token);

  if (!payload || !payload.user_id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized.',
    });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, display_name, role, status FROM capi_users WHERE id = $1 LIMIT 1',
      [payload.user_id]
    );
    const user = rows[0];

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.',
      });
    }

    req.auth = {
      type: 'user',
      role: user.role,
      is_admin: user.role === 'admin',
      can_write: user.role === 'admin' || user.role === 'manager',
      user,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAdmin(req, res, next) {
  if (!req.auth || !req.auth.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden.',
    });
  }

  return next();
}

function requireWrite(req, res, next) {
  if (!req.auth || !req.auth.can_write) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden.',
    });
  }

  return next();
}

auth.requireAdmin = requireAdmin;
auth.requireWrite = requireWrite;

module.exports = auth;
