const express = require('express');
const { findNearbyHospitals } = require('../services/nearbyHospitalsService');

const router = express.Router();

router.post('/hospitals', async (req, res) => {
  try {
    const result = await findNearbyHospitals(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'MISSING_LOCATION') {
      return res.status(400).json({
        error: error.message,
        code: error.code
      });
    }

    if (error.code === 'VALIDATION') {
      return res.status(400).json({
        error: error.message,
        code: error.code
      });
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
      error: 'Unexpected error while finding nearby hospitals.',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
