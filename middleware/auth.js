const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function extractToken(req) {
  // 1. Check httpOnly cookie
  if (req.cookies && req.cookies.medicheck_access) {
    return req.cookies.medicheck_access;
  }
  // 2. Fallback to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function verifyAccessToken(req) {
  const token = extractToken(req);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'medicheck'
    });
    return payload;
  } catch (err) {
    return null;
  }
}

function requireAuthPage(req, res, next) {
  const payload = verifyAccessToken(req);
  if (!payload) {
    return res.redirect('/login');
  }
  req.userId = payload.sub;
  req.userEmail = payload.email;
  return next();
}

function requireAuthApi(req, res, next) {
  const payload = verifyAccessToken(req);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  req.userId = payload.sub;
  req.userEmail = payload.email;
  return next();
}

module.exports = {
  requireAuthPage,
  requireAuthApi,
  verifyAccessToken,
  extractToken
};
