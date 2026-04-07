require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
const nearbyHospitalsRoutes = require('./routes/nearbyHospitals');
const meRoutes = require('./routes/me');
const { requireAuthPage, requireAuthApi } = require('./middleware/auth');
const { cleanExpiredRefreshTokens } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);

/* ── Validate JWT secrets at startup ── */
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}
if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
  console.error('JWT_REFRESH_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

/* ── Clean expired refresh tokens every 30 minutes ── */
setInterval(cleanExpiredRefreshTokens, 30 * 60 * 1000);

app.use('/auth', authRoutes);
app.use('/api/nearby', requireAuthApi, nearbyHospitalsRoutes);
app.use('/api/me', requireAuthApi, meRoutes);

/* ── No-cache middleware for HTML pages ── */
function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  return next();
}

app.get('/login', noCache, (req, res) => {
  const payload = require('./middleware/auth').verifyAccessToken(req);
  if (payload) return res.redirect('/');
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', noCache, (req, res) => {
  const payload = require('./middleware/auth').verifyAccessToken(req);
  if (payload) return res.redirect('/');
  return res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/logout', noCache, (req, res) => {
  res.clearCookie('medicheck_access', { path: '/' });
  res.clearCookie('medicheck_refresh', { path: '/auth' });
  return res.redirect('/login');
});

app.get('/api/protected/health', requireAuthApi, (req, res) => {
  return res.status(200).json({ status: 'ok', userId: req.userId });
});

app.get('/', requireAuthPage, noCache, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/app', requireAuthPage, noCache, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.use((req, res) => {
  if (req.path === '/favicon.ico') {
    return res.status(204).end();
  }
  return res.redirect('/login');
});

app.listen(port, () => {
  console.log(`MediCheck server running at http://localhost:${port}`);
});
