#!/bin/bash
set -e

echo "=== day-map-phase1 smoke test ==="

echo "1/4 Installing dependencies..."
npm ci

echo "2/4 TypeScript type check..."
npx tsc --noEmit

echo "3/4 Running tests..."
npm test

echo "4/4 Building..."
npm run build

echo "Smoke test passed — app is healthy"
