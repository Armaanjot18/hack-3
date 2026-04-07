function createMapProvider() {
  const provider = (process.env.MAPS_PROVIDER || 'osm').toLowerCase();

  if (provider === 'osm') {
    const { OsmMapProvider } = require('./providers/osmProvider');
    return new OsmMapProvider();
  }

  throw new Error(`Unsupported MAPS_PROVIDER: ${provider}`);
}

module.exports = {
  createMapProvider
};
