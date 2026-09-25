-- Register exact HTTPS app-link callbacks without overwriting operator-managed
-- redirect URIs. Runtime environment policy selects the matching client/URI;
-- the legacy loopback remains registered for local development only.

UPDATE client_apps
SET redirect_uris = json_insert(redirect_uris, '$[#]', 'https://mobile-callback.trip-planner-dby.pages.dev/oauth/callback'),
    updated_at = datetime('now')
WHERE client_id = 'tripline-mobile'
  AND json_valid(redirect_uris)
  AND NOT EXISTS (
    SELECT 1 FROM json_each(client_apps.redirect_uris)
    WHERE value = 'https://mobile-callback.trip-planner-dby.pages.dev/oauth/callback'
  );

INSERT INTO client_apps (client_id, client_secret_hash, client_type, app_name, app_description, redirect_uris, allowed_scopes, status)
VALUES ('tripline-mobile-uat', NULL, 'public', 'Tripline Mobile UAT', 'Tripline Flutter UAT',
  '["https://mobile-callback.trip-planner-dby.pages.dev/uat/oauth/callback"]',
  '["openid","profile","email","offline_access"]', 'active')
ON CONFLICT(client_id) DO NOTHING;

INSERT INTO client_apps (client_id, client_secret_hash, client_type, app_name, app_description, redirect_uris, allowed_scopes, status)
VALUES ('tripline-mobile-dev', NULL, 'public', 'Tripline Mobile Development', 'Tripline Flutter local development',
  '["http://127.0.0.1:8765"]',
  '["openid","profile","email","offline_access"]', 'active')
ON CONFLICT(client_id) DO NOTHING;
