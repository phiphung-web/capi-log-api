const pool = require('../db/pool');
const { verifyToken } = require('../utils/security');

function logAuthFailure(req, errorCode, detail) {
  const authHeader = getHeader(req, 'authorization');
  const scheme = authHeader ? authHeader.split(/\s+/)[0] : null;

  console.warn('Auth failed:', {
    error_code: errorCode,
    detail,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip || req.socket?.remoteAddress || null,
    user_agent: req.get('user-agent') || null,
    has_authorization: Boolean(authHeader),
    authorization_scheme: scheme,
    has_x_api_token: Boolean(getHeader(req, 'x-api-token')),
    has_x_api_key: Boolean(getHeader(req, 'x-api-key')),
  });
}

function unauthorized(req, res, errorCode, detail) {
  logAuthFailure(req, errorCode, detail);

  return res.status(401).json({
    success: false,
    message: 'Unauthorized.',
    error_code: errorCode,
    detail,
  });
}

function getHeader(req, name) {
  return String(req.get(name) || '').trim();
}

function parseAuthorizationHeader(authHeader) {
  if (!authHeader) {
    return { token: null, source: null, error: null };
  }

  const parts = authHeader.trim().split(/\s+/);
  const scheme = parts[0] || '';

  if (scheme.toLowerCase() !== 'bearer') {
    return {
      error: {
        code: 'AUTH_SCHEME_INVALID',
        detail: 'Authorization scheme must be Bearer.',
      },
    };
  }

  if (parts.length === 1) {
    return {
      error: {
        code: 'AUTH_TOKEN_MISSING',
        detail: 'Bearer token is missing. Use Authorization: Bearer <API_TOKEN>.',
      },
    };
  }

  if (parts.length > 2) {
    return {
      error: {
        code: 'AUTH_TOKEN_FORMAT_INVALID',
        detail: 'Bearer token must not contain spaces. Use Authorization: Bearer <token>.',
      },
    };
  }

  return { token: parts[1], source: 'authorization', error: null };
}

function resolveRequestToken(req) {
  const authHeader = getHeader(req, 'authorization');
  const apiTokenHeader = getHeader(req, 'x-api-token');
  const apiKeyHeader = getHeader(req, 'x-api-key');
  const parsedAuth = parseAuthorizationHeader(authHeader);

  if (parsedAuth.error) {
    return parsedAuth;
  }

  const sources = [
    parsedAuth.token ? { source: parsedAuth.source, token: parsedAuth.token } : null,
    apiTokenHeader ? { source: 'x-api-token', token: apiTokenHeader } : null,
    apiKeyHeader ? { source: 'x-api-key', token: apiKeyHeader } : null,
  ].filter(Boolean);

  if (sources.length === 0) {
    return {
      error: {
        code: 'AUTH_HEADER_MISSING',
        detail: 'Missing auth header. Use Authorization: Bearer <API_TOKEN> or X-API-Token: <API_TOKEN>.',
      },
    };
  }

  const uniqueTokens = new Set(sources.map((item) => item.token));
  if (uniqueTokens.size > 1) {
    return {
      error: {
        code: 'AUTH_TOKEN_CONFLICT',
        detail: 'Multiple auth headers were provided with different token values.',
      },
    };
  }

  return sources[0];
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

  const resolvedToken = resolveRequestToken(req);
  if (resolvedToken.error) {
    return unauthorized(req, res, resolvedToken.error.code, resolvedToken.error.detail);
  }

  const { token } = resolvedToken;

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
      req,
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
        req,
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
