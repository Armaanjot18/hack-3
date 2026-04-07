const { createMapProvider } = require('./maps/mapProvider');

const geocodeCache = new Map();
const GEOCODE_CACHE_TTL_MS = Number(process.env.GEOCODE_CACHE_TTL_MS || 24 * 60 * 60 * 1000);

function normalizeLocationText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function asNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function validateCoordinates(lat, lon) {
  const parsedLat = asNumber(lat);
  const parsedLon = asNumber(lon);

  if (parsedLat === undefined || parsedLon === undefined) {
    const err = new Error('lat and lon are required when using coordinates.');
    err.code = 'VALIDATION';
    throw err;
  }

  if (parsedLat < -90 || parsedLat > 90) {
    const err = new Error('lat must be between -90 and 90.');
    err.code = 'VALIDATION';
    throw err;
  }

  if (parsedLon < -180 || parsedLon > 180) {
    const err = new Error('lon must be between -180 and 180.');
    err.code = 'VALIDATION';
    throw err;
  }

  return {
    lat: parsedLat,
    lon: parsedLon
  };
}

function validateLocationText(locationText, required) {
  const normalized = normalizeLocationText(locationText);

  if (!normalized && required) {
    const err = new Error('location_text is required.');
    err.code = 'VALIDATION';
    throw err;
  }

  if (normalized && (normalized.length < 3 || normalized.length > 200)) {
    const err = new Error('location_text must be between 3 and 200 characters.');
    err.code = 'VALIDATION';
    throw err;
  }

  return normalized || null;
}

function getGeocodeCache(key) {
  const hit = geocodeCache.get(key);
  if (!hit) {
    return null;
  }

  if (hit.expiresAt < Date.now()) {
    geocodeCache.delete(key);
    return null;
  }

  return hit.value;
}

function setGeocodeCache(key, value) {
  geocodeCache.set(key, {
    value,
    expiresAt: Date.now() + clamp(GEOCODE_CACHE_TTL_MS, 5 * 60 * 1000, 7 * 24 * 60 * 60 * 1000)
  });
}

async function geocodeLocation(locationText) {
  const provider = createMapProvider();
  const cacheKey = normalizeLocationText(locationText).toLowerCase();
  const cached = getGeocodeCache(cacheKey);
  if (cached) {
    return cached;
  }

  const geocodeResult = await provider.geocodeLocation(locationText);
  if (!geocodeResult.found) {
    if (geocodeResult.ambiguous) {
      const err = new Error('Location is ambiguous. Please be more specific.');
      err.code = 'AMBIGUOUS_LOCATION';
      err.suggestions = geocodeResult.suggestions || [];
      throw err;
    }

    const err = new Error('Location could not be found.');
    err.code = 'GEOCODE_NOT_FOUND';
    throw err;
  }

  const normalized = {
    location_text: locationText,
    location_lat: geocodeResult.lat,
    location_lon: geocodeResult.lon,
    geocoded_provider: 'nominatim',
    geocoded_display_name: geocodeResult.displayName || null
  };

  setGeocodeCache(cacheKey, normalized);
  return normalized;
}

async function resolveLocationUpdateInput(input = {}) {
  const hasLat = input.lat !== undefined && input.lat !== null && input.lat !== '';
  const hasLon = input.lon !== undefined && input.lon !== null && input.lon !== '';
  const hasCoords = hasLat || hasLon;

  if (hasCoords) {
    const coords = validateCoordinates(input.lat, input.lon);
    const locationText = validateLocationText(input.location_text, false);

    return {
      location_text: locationText,
      location_lat: coords.lat,
      location_lon: coords.lon,
      geocoded_provider: null,
      geocoded_display_name: null
    };
  }

  const locationText = validateLocationText(input.location_text, true);

  try {
    return await geocodeLocation(locationText);
  } catch (error) {
    if (error.code === 'AMBIGUOUS_LOCATION' || error.code === 'GEOCODE_NOT_FOUND') {
      throw error;
    }

    const err = new Error('I could not reach the map service right now. Try again in a minute.');
    err.code = 'MAP_SERVICE_UNAVAILABLE';
    throw err;
  }
}

module.exports = {
  resolveLocationUpdateInput,
  validateCoordinates,
  validateLocationText
};
