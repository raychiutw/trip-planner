#!/usr/bin/env node
// build.js — Build all trips from MD source + generate registry
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var srcBase = path.join(__dirname, '..', 'data', 'trips-md');
var distBase = path.join(__dirname, '..', 'data', 'dist');

var tripIds = fs.readdirSync(srcBase).filter(function(d) {
  return fs.statSync(path.join(srcBase, d)).isDirectory();
});

if (!tripIds.length) {
  console.log('No trip directories found in data/trips-md/');
  process.exit(0);
}

console.log('Building ' + tripIds.length + ' trips...');

var failed = [];
tripIds.forEach(function(tripId) {
  var result = childProcess.spawnSync('node', [path.join(__dirname, 'trip-build.js'), tripId], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('FAIL: ' + tripId);
    failed.push(tripId);
  } else {
    console.log('OK: ' + tripId);
  }
});

// Generate registry: data/dist/trips.json
var registry = [];
var distDirs = fs.readdirSync(distBase).filter(function(d) {
  var metaPath = path.join(distBase, d, 'meta.json');
  return fs.existsSync(metaPath);
});

distDirs.forEach(function(tripId) {
  var meta = JSON.parse(fs.readFileSync(path.join(distBase, tripId, 'meta.json'), 'utf8'));
  registry.push({
    tripId: tripId,
    name: meta.meta.name || '',
    dates: meta.footer.dates || '',
    owner: meta.meta.owner || ''
  });
});

fs.writeFileSync(path.join(distBase, 'trips.json'), JSON.stringify(registry, null, 2) + '\n');
console.log('\nRegistry: data/dist/trips.json (' + registry.length + ' trips)');

if (failed.length) {
  console.error(failed.length + ' trip(s) failed: ' + failed.join(', '));
  process.exit(1);
}

console.log('All ' + tripIds.length + ' trips built successfully.');
