const express = require('express');
const { getUserLocation, updateUserLocation, findUserById } = require('../db');
const { resolveLocationUpdateInput } = require('../services/userLocationService');
const {
  findNearbyHospitalsByCoordinates,
  validateSearchOptions
} = require('../services/nearbyHospitalsService');

const router = express.Router();

router.get('/location', (req, res) => {
  const user = findUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const location = getUserLocation(req.session.userId);
  return res.status(200).json({
    location
  });
});

router.put('/location', async (req, res) => {
  try {
    const resolved = await resolveLocationUpdateInput(req.body || {});

    const updated = updateUserLocation(req.session.userId, {
      location_text: resolved.location_text,
      location_lat: resolved.location_lat,
      location_lon: resolved.location_lon
    });

    if (!updated) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    return res.status(200).json({
      location: {
        ...updated,
        geocoded_provider: resolved.geocoded_provider || null,
        geocoded_display_name: resolved.geocoded_display_name || null
      }
    });
  } catch (error) {
    if (error.code === 'VALIDATION') {
      return res.status(400).json({ error: error.message, code: error.code });
    }

    if (error.code === 'AMBIGUOUS_LOCATION') {
      return res.status(409).json({
        error: 'Please clarify your location (for example, add state/country).',
        code: error.code,
        suggestions: error.suggestions || []
      });
    }

    if (error.code === 'GEOCODE_NOT_FOUND') {
      return res.status(404).json({
        error: 'I could not find that location. Please try a more specific place name.',
        code: error.code
      });
    }

    if (error.code === 'MAP_SERVICE_UNAVAILABLE') {
      return res.status(503).json({
        error: 'I could not reach the map service right now. Try again in a minute.',
        code: error.code
      });
    }

    return res.status(500).json({
      error: 'Unexpected error while saving location.',
      code: 'INTERNAL_ERROR'
    });
  }
});

router.get('/nearby-hospitals', async (req, res) => {
  try {
    const location = getUserLocation(req.session.userId);

    if (!location || location.location_lat === null || location.location_lon === null) {
      return res.status(400).json({
        error: 'Set your location first.',
        code: 'MISSING_SAVED_LOCATION'
      });
    }

    const { radiusKm, limit } = validateSearchOptions(req.query || {});
    const result = await findNearbyHospitalsByCoordinates({
      lat: location.location_lat,
      lon: location.location_lon,
      location: location.location_text || null,
      radius_km: radiusKm,
      limit
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'VALIDATION') {
      return res.status(400).json({ error: error.message, code: error.code });
    }

    if (error.code === 'MAP_SERVICE_UNAVAILABLE') {
      return res.status(503).json({
        error: 'I could not reach the map service right now. Try again in a minute.',
        code: error.code
      });
    }

    return res.status(500).json({
      error: 'Unexpected error while finding nearby hospitals.',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
