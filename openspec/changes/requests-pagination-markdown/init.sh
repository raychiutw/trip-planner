#!/bin/bash
set -e
npm ci
npx tsc --noEmit
npm test
npm run build
echo "✅ Smoke test passed — app is healthy"
