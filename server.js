require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
const nearbyHospitalsRoutes = require('./routes/nearbyHospitals');
const { requireAuthPage, requireAuthApi } = require('./middleware/auth');

const app = express();
const port = Number(process.env.PORT || 3000);

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
  console.error('SESSION_SECRET must be set and at least 16 characters long.');
  process.exit(1);
}

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    name: 'medicheck.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

app.use('/auth', authRoutes);
app.use('/api/nearby', requireAuthApi, nearbyHospitalsRoutes);

app.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  return res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/logout', (req, res) => {
  if (!req.session) {
    return res.redirect('/login');
  }
  req.session.destroy(() => {
    res.clearCookie('medicheck.sid');
    return res.redirect('/login');
  });
});

app.get('/api/protected/health', requireAuthApi, (req, res) => {
  return res.status(200).json({ status: 'ok', userId: req.session.userId });
});

app.get('/', requireAuthPage, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/app', requireAuthPage, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.use((req, res) => {
  if (req.path === '/favicon.ico') {
    return res.status(204).end();
  }
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  return res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.listen(port, () => {
  console.log(`MediCheck server running at http://localhost:${port}`);
});
