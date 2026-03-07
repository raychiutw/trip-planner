#!/usr/bin/env node
// build.js — Build all trips from MD source + generate registry
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var srcBase = path.join(__dirname, '..', 'data', 'trips-md');
var distBase = path.join(__dirname, '..', 'data', 'dist');

var slugs = fs.readdirSync(srcBase).filter(function(d) {
  return fs.statSync(path.join(srcBase, d)).isDirectory();
});

if (!slugs.length) {
  console.log('No trip directories found in data/trips-md/');
  process.exit(0);
}

console.log('Building ' + slugs.length + ' trips...');

var failed = [];
slugs.forEach(function(slug) {
  var result = childProcess.spawnSync('node', [path.join(__dirname, 'trip-build.js'), slug], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('FAIL: ' + slug);
    failed.push(slug);
  } else {
    console.log('OK: ' + slug);
  }
});

// Generate registry: data/dist/trips.json
var registry = [];
var distDirs = fs.readdirSync(distBase).filter(function(d) {
  var metaPath = path.join(distBase, d, 'meta.json');
  return fs.existsSync(metaPath);
});

distDirs.forEach(function(slug) {
  var meta = JSON.parse(fs.readFileSync(path.join(distBase, slug, 'meta.json'), 'utf8'));
  registry.push({
    slug: slug,
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

console.log('All ' + slugs.length + ' trips built successfully.');
