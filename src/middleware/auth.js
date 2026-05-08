function auth(req, res, next) {
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

  if (scheme !== 'Bearer' || !token || token !== expectedToken) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized.',
    });
  }

  return next();
}

module.exports = auth;
