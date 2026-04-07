const DEFAULT_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatAddress(tags = {}) {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
    tags['addr:state'],
    tags['addr:postcode'],
    tags['addr:country']
  ].filter(Boolean);

  if (parts.length) {
    return parts.join(', ');
  }

  return tags['addr:full'] || tags['contact:street'] || 'Address unavailable';
}

function buildOverpassQuery(lat, lon, radiusMeters) {
  return `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lon})["amenity"="hospital"];
  way(around:${radiusMeters},${lat},${lon})["amenity"="hospital"];
  relation(around:${radiusMeters},${lat},${lon})["amenity"="hospital"];
  node(around:${radiusMeters},${lat},${lon})["healthcare"="hospital"];
  way(around:${radiusMeters},${lat},${lon})["healthcare"="hospital"];
  relation(around:${radiusMeters},${lat},${lon})["healthcare"="hospital"];
);
out center tags;
`.trim();
}

class OsmMapProvider {
  constructor() {
    this.nominatimUrl = process.env.NOMINATIM_URL || DEFAULT_NOMINATIM_URL;
    this.overpassUrl = process.env.OVERPASS_URL || DEFAULT_OVERPASS_URL;
    this.timeoutMs = Number(process.env.MAPS_TIMEOUT_MS || 10000);
    this.maxRetries = Number(process.env.OVERPASS_MAX_RETRIES || 2);
    this.userAgent = process.env.OSM_USER_AGENT || 'MediCheck/1.0 (contact: support@medicheck.local)';
  }

  async fetchJsonWithRetry(url, options, retries) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        if (attempt < retries) {
          const backoffMs = 400 * Math.pow(2, attempt);
          await sleep(backoffMs);
          continue;
        }
      }
    }

    throw lastError || new Error('Unknown network error');
  }

  async geocodeLocation(location) {
    const params = new URLSearchParams({
      q: location,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5'
    });

    const url = `${this.nominatimUrl}?${params.toString()}`;
    const data = await this.fetchJsonWithRetry(
      url,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': this.userAgent
        }
      },
      1
    );

    if (!Array.isArray(data) || data.length === 0) {
      return { found: false };
    }

    const best = data[0];
    const second = data[1];
    const bestImportance = Number(best.importance || 0);
    const secondImportance = Number((second && second.importance) || 0);

    if (second && Math.abs(bestImportance - secondImportance) < 0.02) {
      return {
        found: false,
        ambiguous: true,
        suggestions: data.slice(0, 3).map((item) => item.display_name)
      };
    }

    return {
      found: true,
      lat: Number(best.lat),
      lon: Number(best.lon),
      displayName: best.display_name
    };
  }

  async findNearbyHospitals({ lat, lon, radiusKm, limit }) {
    const radiusMeters = Math.round(radiusKm * 1000);
    const overpassQuery = buildOverpassQuery(lat, lon, radiusMeters);

    const data = await this.fetchJsonWithRetry(
      this.overpassUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Accept': 'application/json',
          'User-Agent': this.userAgent
        },
        body: overpassQuery
      },
      this.maxRetries
    );

    const elements = Array.isArray(data && data.elements) ? data.elements : [];

    const hospitals = elements
      .map((element) => {
        const latitude = Number(element.lat || (element.center && element.center.lat));
        const longitude = Number(element.lon || (element.center && element.center.lon));

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const tags = element.tags || {};
        const distanceKm = haversineDistanceKm(lat, lon, latitude, longitude);
        const name = tags.name || 'Hospital (unnamed)';

        return {
          name,
          address: formatAddress(tags),
          lat: latitude,
          lon: longitude,
          distance_km: Number(distanceKm.toFixed(2)),
          osm_id: `${element.type}/${element.id}`,
          maps_url: `https://www.google.com/maps?q=${latitude},${longitude}`,
          phone: tags.phone || tags['contact:phone'] || null,
          website: tags.website || tags['contact:website'] || null,
          opening_hours: tags.opening_hours || null,
          emergency: tags.emergency === 'yes' ? true : (tags.emergency === 'no' ? false : null),
          operator: tags.operator || null,
          beds: tags.beds ? Number(tags.beds) : null,
          healthcare_type: tags.healthcare || tags.amenity || 'hospital'
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    return hospitals;
  }
}

module.exports = {
  OsmMapProvider
};
