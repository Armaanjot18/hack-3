const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbUrl = process.env.DB_URL || process.env.DB_NAME;

if (!dbUrl) {
  console.error('Database config missing. Set DB_URL (or DB_NAME).');
  process.exit(1);
}

const dbPath = path.resolve(dbUrl);

function failFast(message, err) {
  console.error(message, err ? err.message : '');
  process.exit(1);
}

function ensureDbFile() {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(
        dbPath,
        JSON.stringify({ users: [] }, null, 2),
        'utf8'
      );
    }

    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed.users || !Array.isArray(parsed.users)) {
      throw new Error('Invalid DB structure. Expected { users: [] }.');
    }

    let migrated = false;
    parsed.users.forEach((user) => {
      if (!Object.prototype.hasOwnProperty.call(user, 'location_text')) {
        user.location_text = null;
        migrated = true;
      }
      if (!Object.prototype.hasOwnProperty.call(user, 'location_lat')) {
        user.location_lat = null;
        migrated = true;
      }
      if (!Object.prototype.hasOwnProperty.call(user, 'location_lon')) {
        user.location_lon = null;
        migrated = true;
      }
      if (!Object.prototype.hasOwnProperty.call(user, 'location_updated_at')) {
        user.location_updated_at = null;
        migrated = true;
      }
    });

    if (migrated) {
      fs.writeFileSync(dbPath, JSON.stringify(parsed, null, 2), 'utf8');
    }
  } catch (err) {
    failFast('Failed to initialize database file:', err);
  }
}

function readDb() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed.users || !Array.isArray(parsed.users)) {
      throw new Error('Invalid DB structure.');
    }
    return parsed;
  } catch (err) {
    failFast('Failed to read database file:', err);
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    failFast('Failed to write database file:', err);
  }
}

ensureDbFile();

function createUser({ name, email, passwordHash }) {
  const db = readDb();
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    name: name || null,
    email,
    password_hash: passwordHash,
    created_at: now,
    location_text: null,
    location_lat: null,
    location_lon: null,
    location_updated_at: null
  };
  db.users.push(user);
  writeDb(db);
  return { id: user.id, name: user.name, email: user.email };
}

function findUserByEmail(email) {
  const db = readDb();
  return db.users.find((u) => u.email === email) || null;
}

function findUserById(id) {
  const db = readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at,
    location_text: user.location_text || null,
    location_lat: Number.isFinite(user.location_lat) ? user.location_lat : null,
    location_lon: Number.isFinite(user.location_lon) ? user.location_lon : null,
    location_updated_at: user.location_updated_at || null
  };
}

function updateUserLocation(id, location) {
  const db = readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return null;
  }

  user.location_text = location.location_text || null;
  user.location_lat = Number(location.location_lat);
  user.location_lon = Number(location.location_lon);
  user.location_updated_at = new Date().toISOString();

  writeDb(db);

  return {
    location_text: user.location_text,
    location_lat: user.location_lat,
    location_lon: user.location_lon,
    location_updated_at: user.location_updated_at
  };
}

function getUserLocation(id) {
  const db = readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return null;
  }

  return {
    location_text: user.location_text || null,
    location_lat: Number.isFinite(user.location_lat) ? user.location_lat : null,
    location_lon: Number.isFinite(user.location_lon) ? user.location_lon : null,
    location_updated_at: user.location_updated_at || null
  };
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserLocation,
  getUserLocation
};
