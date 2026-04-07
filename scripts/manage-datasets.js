const fs = require('fs');
const path = require('path');
const https = require('https');

const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'datasets-manifest.json');
const outputDir = path.join(rootDir, 'datasets');

function loadManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error('datasets-manifest.json not found.');
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed.datasets || !Array.isArray(parsed.datasets)) {
    throw new Error('Invalid manifest: datasets array is missing.');
  }
  return parsed;
}

function validateManifest(manifest) {
  const errors = [];
  manifest.datasets.forEach((d, i) => {
    const prefix = `datasets[${i}]`;
    if (!d.id || typeof d.id !== 'string') errors.push(`${prefix}.id is required`);
    if (!d.name || typeof d.name !== 'string') errors.push(`${prefix}.name is required`);
    if (!d.source_url || typeof d.source_url !== 'string') errors.push(`${prefix}.source_url is required`);
    if (typeof d.approved !== 'boolean') errors.push(`${prefix}.approved must be boolean`);
    if (typeof d.requires_manual_access !== 'boolean') {
      errors.push(`${prefix}.requires_manual_access must be boolean`);
    }
  });
  return errors;
}

function listDatasets(manifest) {
  const totals = {
    total: manifest.datasets.length,
    approved: 0,
    manual: 0,
    downloadable: 0
  };

  manifest.datasets.forEach((d) => {
    if (d.approved) totals.approved += 1;
    if (d.requires_manual_access) totals.manual += 1;
    if (d.approved && d.download_url) totals.downloadable += 1;
  });

  console.log(`Total datasets: ${totals.total}`);
  console.log(`Approved: ${totals.approved}`);
  console.log(`Requires manual access: ${totals.manual}`);
  console.log(`Approved + direct download URL: ${totals.downloadable}`);
  console.log('');

  manifest.datasets.forEach((d) => {
    const status = d.approved ? 'APPROVED' : 'PENDING';
    const access = d.requires_manual_access ? 'manual' : 'direct';
    console.log(`- ${d.id} | ${status} | ${access} | ${d.name}`);
  });
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(downloadFile(res.headers.location, destination));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      const fileStream = fs.createWriteStream(destination);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(resolve);
      });

      fileStream.on('error', (err) => {
        fileStream.close(() => reject(err));
      });
    });

    req.on('error', reject);
  });
}

async function downloadApprovedDatasets(manifest) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const candidates = manifest.datasets.filter(
    (d) => d.approved && !d.requires_manual_access && d.download_url
  );

  if (!candidates.length) {
    console.log('No approved datasets with direct download URLs found.');
    return;
  }

  for (const dataset of candidates) {
    const targetPath = path.join(outputDir, `${dataset.id}.bin`);
    console.log(`Downloading ${dataset.id} -> ${targetPath}`);
    try {
      await downloadFile(dataset.download_url, targetPath);
      console.log(`Done: ${dataset.id}`);
    } catch (err) {
      console.error(`Failed: ${dataset.id} (${err.message})`);
    }
  }
}

async function main() {
  const command = process.argv[2] || 'list';

  const manifest = loadManifest();
  const errors = validateManifest(manifest);

  if (errors.length) {
    console.error('Manifest validation failed:');
    errors.forEach((err) => console.error(`- ${err}`));
    process.exit(1);
  }

  if (command === 'list') {
    listDatasets(manifest);
    return;
  }

  if (command === 'validate') {
    console.log('Manifest is valid.');
    return;
  }

  if (command === 'download') {
    await downloadApprovedDatasets(manifest);
    return;
  }

  console.error('Unknown command. Use: list | validate | download');
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
