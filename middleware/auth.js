function isAuthed(req) {
  return Boolean(req.session && req.session.userId);
}

function requireAuthPage(req, res, next) {
  if (!isAuthed(req)) {
    return res.redirect('/login');
  }
  return next();
}

function requireAuthApi(req, res, next) {
  if (!isAuthed(req)) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  return next();
}

module.exports = {
  requireAuthPage,
  requireAuthApi
};
