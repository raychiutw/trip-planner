#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'dist', 'sw.js');
if (!fs.existsSync(swPath)) {
  console.error('❌ dist/sw.js not found. Run npm run build first.');
  process.exit(1);
}

const sw = fs.readFileSync(swPath, 'utf8');
let failed = false;

function check(name, condition) {
  if (condition) {
    console.log('✅', name);
  } else {
    console.error('❌', name);
    failed = true;
  }
}

// 1. 不應有 NavigationRoute
check('No NavigationRoute (navigation fallback disabled)', !sw.includes('NavigationRoute'));

// 2. 不應有 createHandlerBoundToURL
check('No createHandlerBoundToURL', !sw.includes('createHandlerBoundToURL'));

// 3. 應有 precacheAndRoute
check('Has precacheAndRoute', sw.includes('precacheAndRoute'));

// 4. precache entries > 10
const precacheMatch = sw.match(/url:"[^"]+"/g);
const entryCount = precacheMatch ? precacheMatch.length : 0;
check(`Precache entries > 10 (found ${entryCount})`, entryCount > 10);

// 5. 應有 NetworkFirst
check('Has NetworkFirst runtime cache', sw.includes('NetworkFirst'));

// 6. 不應 precache manage/ 或 admin/ HTML
const hasManageHtml = precacheMatch && precacheMatch.some(e => e.includes('manage/') && e.includes('.html'));
const hasAdminHtml = precacheMatch && precacheMatch.some(e => e.includes('admin/') && e.includes('.html'));
check('No manage/ HTML in precache', !hasManageHtml);
check('No admin/ HTML in precache', !hasAdminHtml);

if (failed) {
  console.error('\n❌ SW verification FAILED');
  process.exit(1);
} else {
  console.log('\n✅ SW verification PASSED');
}
