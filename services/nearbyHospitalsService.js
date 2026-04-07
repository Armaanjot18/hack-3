const { createMapProvider } = require('./maps/mapProvider');

const cacheStore = new Map();
const CACHE_TTL_MS = Number(process.env.HOSPITALS_CACHE_TTL_MS || 10 * 60 * 1000);

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

function roundedForCache(value) {
  return Number(value).toFixed(3);
}

function getCacheKey({ lat, lon, radiusKm, limit }) {
  return `${roundedForCache(lat)}:${roundedForCache(lon)}:${radiusKm}:${limit}`;
}

function getFromCache(cacheKey) {
  const entry = cacheStore.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    cacheStore.delete(cacheKey);
    return null;
  }

  return entry.value;
}

function setCache(cacheKey, value) {
  cacheStore.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function validateAndNormalizeInput(input = {}) {
  const location = typeof input.location === 'string' ? input.location.trim() : '';
  const lat = asNumber(input.lat);
  const lon = asNumber(input.lon);
  const radiusKm = clamp(asNumber(input.radius_km) || 5, 1, 25);
  const limit = Math.floor(clamp(asNumber(input.limit) || 5, 1, 20));

  const hasCoords = lat !== undefined || lon !== undefined;

  if (hasCoords && (lat === undefined || lon === undefined)) {
    const err = new Error('Both lat and lon are required when using coordinates.');
    err.code = 'VALIDATION';
    throw err;
  }

  if (lat !== undefined && (lat < -90 || lat > 90)) {
    const err = new Error('lat must be between -90 and 90.');
    err.code = 'VALIDATION';
    throw err;
  }

  if (lon !== undefined && (lon < -180 || lon > 180)) {
    const err = new Error('lon must be between -180 and 180.');
    err.code = 'VALIDATION';
    throw err;
  }

  if (!location && !hasCoords) {
    const err = new Error('Share your city/address or allow location access (lat/lon).');
    err.code = 'MISSING_LOCATION';
    throw err;
  }

  return {
    location,
    lat,
    lon,
    radiusKm,
    limit
  };
}

async function findNearbyHospitals(input = {}) {
  const provider = createMapProvider();
  const normalized = validateAndNormalizeInput(input);

  let finalLat = normalized.lat;
  let finalLon = normalized.lon;
  let geocodedLocation = null;

  if (finalLat === undefined || finalLon === undefined) {
    const geocodeResult = await provider.geocodeLocation(normalized.location);

    if (!geocodeResult.found) {
      const err = new Error(
        geocodeResult.ambiguous
          ? 'Location is ambiguous. Please be more specific.'
          : 'Location could not be found.'
      );
      err.code = geocodeResult.ambiguous ? 'AMBIGUOUS_LOCATION' : 'GEOCODE_NOT_FOUND';
      err.suggestions = geocodeResult.suggestions || [];
      throw err;
    }

    finalLat = geocodeResult.lat;
    finalLon = geocodeResult.lon;
    geocodedLocation = geocodeResult.displayName;
  }

  const cacheKey = getCacheKey({
    lat: finalLat,
    lon: finalLon,
    radiusKm: normalized.radiusKm,
    limit: normalized.limit
  });

  const cached = getFromCache(cacheKey);
  if (cached) {
    return {
      query: {
        location: normalized.location || null,
        geocoded_location: geocodedLocation,
        lat: finalLat,
        lon: finalLon,
        radius_km: normalized.radiusKm,
        limit: normalized.limit,
        cached: true
      },
      hospitals: cached
    };
  }

  try {
    const hospitals = await provider.findNearbyHospitals({
      lat: finalLat,
      lon: finalLon,
      radiusKm: normalized.radiusKm,
      limit: normalized.limit
    });

    setCache(cacheKey, hospitals);

    return {
      query: {
        location: normalized.location || null,
        geocoded_location: geocodedLocation,
        lat: finalLat,
        lon: finalLon,
        radius_km: normalized.radiusKm,
        limit: normalized.limit,
        cached: false
      },
      hospitals
    };
  } catch (error) {
    const err = new Error('I could not reach the map service right now. Try again in a minute.');
    err.code = 'MAP_SERVICE_UNAVAILABLE';
    err.cause = error;
    throw err;
  }
}

module.exports = {
  findNearbyHospitals,
  validateAndNormalizeInput
};
