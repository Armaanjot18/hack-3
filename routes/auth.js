const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { createUser, findUserByEmail, findUserById } = require('../db');

const router = express.Router();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bcryptRounds = Number(process.env.BCRYPT_ROUNDS || 12);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 8),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

router.post('/signup', async (req, res) => {
  const name = sanitizeName(req.body.name);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
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

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session setup failed.' });
    }
    req.session.userId = created.id;
    req.session.userEmail = created.email;
    return res.status(201).json({
      message: 'Signup successful.',
      user: { id: created.id, name: created.name, email: created.email }
    });
  });
});

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

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session setup failed.' });
    }
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    return res.status(200).json({
      message: 'Login successful.',
      user: { id: user.id, name: user.name, email: user.email }
    });
  });
});

router.post('/logout', (req, res) => {
  if (!req.session) {
    return res.status(200).json({ message: 'Logged out.' });
  }

  req.session.destroy(() => {
    res.clearCookie('medicheck.sid');
    return res.status(200).json({ message: 'Logged out.' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const user = findUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  return res.status(200).json({ user });
});

module.exports = router;
