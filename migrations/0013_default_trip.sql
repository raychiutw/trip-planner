-- Add is_default flag to trips table
-- Only one trip should have is_default = 1 at a time
ALTER TABLE trips ADD COLUMN is_default INTEGER DEFAULT 0;

-- Set the default trip
UPDATE trips SET is_default = 1 WHERE id = 'okinawa-trip-2026-Ray';
