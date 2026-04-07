const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
  createUser,
  findUserByEmail,
  findUserById,
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteRefreshTokensByUser,
  deleteRefreshTokensByFamily
} = require('../db');
const { verifyAccessToken } = require('../middleware/auth');

const router = express.Router();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bcryptRounds = Number(process.env.BCRYPT_ROUNDS || 12);

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY_MS = Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS || 7) * 24 * 60 * 60 * 1000;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 8),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many token refresh attempts.' }
});

const isProduction = process.env.NODE_ENV === 'production';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY, issuer: 'medicheck' }
  );
}

function generateRefreshToken(user, family) {
  const tokenFamily = family || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();
  const token = jwt.sign(
    { sub: user.id, family: tokenFamily, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: Math.floor(REFRESH_TOKEN_EXPIRY_MS / 1000), issuer: 'medicheck' }
  );

  saveRefreshToken({
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt,
    family: tokenFamily
  });

  return { token, family: tokenFamily };
}

function setTokenCookies(res, accessToken, refreshToken) {
  res.cookie('medicheck_access', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    path: '/'
  });

  res.cookie('medicheck_refresh', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/auth'
  });
}

function clearTokenCookies(res) {
  res.clearCookie('medicheck_access', { path: '/' });
  res.clearCookie('medicheck_refresh', { path: '/auth' });
}

function validatePasswordStrength(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  return null;
}

/* ── Signup ── */
router.post('/signup', async (req, res) => {
  const name = sanitizeName(req.body.name);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  const pwError = validatePasswordStrength(password);
  if (pwError) {
    return res.status(400).json({ error: pwError });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const existing = findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const created = createUser({ name, email, passwordHash });

  const accessToken = generateAccessToken(created);
  const { token: refreshToken } = generateRefreshToken(created);

  setTokenCookies(res, accessToken, refreshToken);

  return res.status(201).json({
    message: 'Signup successful.',
    user: { id: created.id, name: created.name, email: created.email }
  });
});

/* ── Login ── */
router.post('/login', loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!emailRegex.test(email) || password.length < 8) {
    return res.status(400).json({ error: 'Invalid email or password format.' });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const accessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });
  const { token: refreshToken } = generateRefreshToken({ id: user.id });

  setTokenCookies(res, accessToken, refreshToken);

  return res.status(200).json({
    message: 'Login successful.',
    user: { id: user.id, name: user.name, email: user.email }
  });
});

/* ── Token Refresh (rotation) ── */
router.post('/refresh', refreshLimiter, (req, res) => {
  const oldToken = req.cookies && req.cookies.medicheck_refresh;
  if (!oldToken) {
    return res.status(401).json({ error: 'No refresh token.' });
  }

  let payload;
  try {
    payload = jwt.verify(oldToken, JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
      issuer: 'medicheck'
    });
  } catch (err) {
    clearTokenCookies(res);
    return res.status(401).json({ error: 'Invalid refresh token.' });
  }

  const oldHash = hashToken(oldToken);
  const stored = findRefreshToken(oldHash);

  if (!stored) {
    // Token reuse detected — invalidate the entire token family
    if (payload.family) {
      deleteRefreshTokensByFamily(payload.family);
    }
    clearTokenCookies(res);
    return res.status(401).json({ error: 'Token reuse detected. All sessions revoked.' });
  }

  // Delete the used refresh token
  deleteRefreshToken(oldHash);

  const user = findUserById(payload.sub);
  if (!user) {
    clearTokenCookies(res);
    return res.status(401).json({ error: 'User not found.' });
  }

  // Issue new token pair (same family for rotation detection)
  const accessToken = generateAccessToken(user);
  const { token: newRefreshToken } = generateRefreshToken({ id: user.id }, payload.family);

  setTokenCookies(res, accessToken, newRefreshToken);

  return res.status(200).json({ message: 'Token refreshed.' });
});

/* ── Logout ── */
router.post('/logout', (req, res) => {
  const refreshToken = req.cookies && req.cookies.medicheck_refresh;
  if (refreshToken) {
    deleteRefreshToken(hashToken(refreshToken));
  }

  clearTokenCookies(res);
  return res.status(200).json({ message: 'Logged out.' });
});

/* ── Logout all sessions ── */
router.post('/logout-all', (req, res) => {
  const payload = verifyAccessToken(req);
  if (!payload) {
    clearTokenCookies(res);
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  deleteRefreshTokensByUser(payload.sub);
  clearTokenCookies(res);
  return res.status(200).json({ message: 'All sessions revoked.' });
});

/* ── Get current user ── */
router.get('/me', (req, res) => {
  const payload = verifyAccessToken(req);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const user = findUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  return res.status(200).json({ user });
});

module.exports = router;
