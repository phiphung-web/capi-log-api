const pool = require('../db/pool');
const { verifyToken } = require('../utils/security');

function unauthorized(res, errorCode, detail) {
  return res.status(401).json({
    success: false,
    message: 'Unauthorized.',
    error_code: errorCode,
    detail,
  });
}

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

  if (!authHeader) {
    return unauthorized(
      res,
      'AUTH_HEADER_MISSING',
      'Missing Authorization header. Use Authorization: Bearer <API_TOKEN>.'
    );
  }

  const [scheme, token, extra] = authHeader.split(' ');

  if (scheme !== 'Bearer') {
    return unauthorized(
      res,
      'AUTH_SCHEME_INVALID',
      'Authorization scheme must be Bearer.'
    );
  }

  if (!token || extra) {
    return unauthorized(
      res,
      'AUTH_TOKEN_FORMAT_INVALID',
      'Authorization header format must be: Bearer <token>.'
    );
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
    return unauthorized(
      res,
      'AUTH_TOKEN_INVALID',
      'Token does not match API_TOKEN and is not a valid user session token.'
    );
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, display_name, role, status FROM capi_users WHERE id = $1 LIMIT 1',
      [payload.user_id]
    );
    const user = rows[0];

    if (!user || user.status !== 'active') {
      return unauthorized(
        res,
        'AUTH_USER_INACTIVE',
        'User token is valid but the user is missing or inactive.'
      );
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
