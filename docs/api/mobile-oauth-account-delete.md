# Mobile OAuth and account deletion contract

Backend implementation for #1347 and #1349. These values are a repository contract; call them live only after the migration, callback host, association files, Flutter handlers, and device checks have been deployed and verified.

| Environment | Issuer | Client ID | Exact redirect URI |
|---|---|---|---|
| Production | `https://trip-planner-dby.pages.dev/api/oauth` | `tripline-mobile` | `https://mobile-callback.trip-planner-dby.pages.dev/oauth/callback` |
| UAT | `https://uat.trip-planner-dby.pages.dev/api/oauth` | `tripline-mobile-uat` | `https://mobile-callback.trip-planner-dby.pages.dev/uat/oauth/callback` |
| Local development | Local `/api/oauth` issuer | `tripline-mobile-dev` | `http://127.0.0.1:8765` |

Mobile clients are public: no client secret. Authorization code requires `response_type=code`, exact registered `redirect_uri`, `state` checked by the app, and PKCE `S256`. Allowed scopes are `openid profile email offline_access`; request only what the operation needs. Exchange the code at the same issuer's `/token` with the same client ID and redirect URI; the code is single use. Cross-environment client/redirect pairs are rejected before any redirect. A denied consent returns OAuth `access_denied` with the original state to the registered callback. Cancelled browser sessions leave the app signed out. Flutter must retain the pending verifier/state through background and cold-start delivery, reject a callback without a matching pending attempt, and never redeem a code twice.

The callback host serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`. iOS association uses `8Z6WVFJ574.com.raychiu.tripline`; Android association uses the Play **app-signing** SHA-256 fingerprint from Play Console, not the upload certificate. The callback host is distinct from the issuer host because same-domain navigation in Safari does not open a universal link. HTTPS, MIME type, no redirect, OS association and app routing need live device evidence before enabling this client in production builds.

For an account with a local password, `GET /api/account` reports `hasPassword: true` and `DELETE /api/account` still requires `{ "password": "..." }`. For a Google-only account, `GET /api/account` reports `hasPassword: false`, `reauthProvider: "google"`, `reauthenticated` (browser cookie flow only), `tripsOwned`, and `collaboratorsAffected`. The user must review this preview and explicitly confirm deletion. `confirm: "DELETE"` alone never grants fresh authentication.

Browser session flow: open `GET /api/oauth/login/google?purpose=account-delete` in the same browser session; after same-account Google authentication with a recent `auth_time`, the callback returns to `/account?deleteReauth=done`. Google denial or verification failure returns to `/account?deleteReauth=failed` and offers another attempt. A one-use server proof is bound to the original session, user and five-minute lifetime. Then `DELETE /api/account` with `{ "confirm": "DELETE" }` consumes it. A stale, wrong-account or replayed proof yields HTTP 403 `ACCOUNT_DELETE_REAUTH_REQUIRED` without erasure.

Flutter Bearer flow:

1. Call `GET /api/account` and show the deletion preview. Only the environment's mobile OAuth client Bearer token is accepted; the token's `grantId` is the stable binding across access-token refreshes.
2. Call `POST /api/account/delete-reauth` with that Bearer token. Response: `{ "challengeId": "opaque", "authorizeUrl": "https://<issuer-host>/api/oauth/login/google?purpose=account-delete&challenge=<opaque>", "expiresIn": 300 }`. Open `authorizeUrl` in the system browser. Do not construct the Google URL in the app.
3. Google returns to the backend callback. The backend verifies the linked Google account and a fresh ID-token `auth_time`, then redirects to the environment's HTTPS app link with `challenge_id` and `status=verified` or `status=failed`. A callback URL alone is not proof: the app checks the original pending challenge and calls the server.
4. Call `GET /api/account/delete-reauth?challenge_id=<opaque>` with a Bearer token from the **same grant**. Response status is `pending`, `started`, `verified`, `failed`, `cancelled`, `used` or `expired`. A different user/grant/client receives HTTP 404. The app may call `DELETE` on the same URL to cancel; it returns `{ "status": "cancelled" }`.
5. Once `verified`, call `DELETE /api/account` with `{ "confirm": "DELETE", "challengeId": "opaque" }` and a Bearer token from the same grant. The server reserves the five-minute challenge and erases the account in one atomic D1 batch. The response includes `{ "ok": true, "tripsDeleted", "auditRowsAnonymized", "tablesCleared" }`; account OAuth tokens are removed. If erasure fails, D1 rolls it back and restores the still-unexpired challenge for retry. If the challenge is absent, expired, cancelled, mismatched or already used, the response is HTTP 403 `ACCOUNT_DELETE_REAUTH_REQUIRED` and the account remains intact.

The mobile challenge status is tied to one attempt. A failed/expired/cancelled attempt requires starting a new challenge. The browser and app must not treat a generic signed-in session, an access token, a redirect URL, or the string `DELETE` as proof of fresh identity. Google must return an `auth_time` no more than five minutes old and not earlier than this attempt; otherwise the server fails closed. Provider capability requires live Google verification before this contract is marked operational.

## Error reference

| Endpoint | Status / code | When |
|---|---|---|
| `POST /api/account/delete-reauth` | 403 `ACCOUNT_DELETE_REAUTH_REQUIRED` | The account has no linked Google identity |
| `POST` / `GET` / `DELETE /api/account/delete-reauth` | 401 `AUTH_REQUIRED` | No valid credential: no session cookie and no resolvable Bearer token |
| `POST` / `GET` / `DELETE /api/account/delete-reauth` | 403 `PERM_DENIED` | A browser session cookie is present (it takes precedence over a Bearer header), or the Bearer token is not the environment's mobile OAuth client, is a service or trip-restricted token, or has no `grantId` / user |
| `POST /api/account/delete-reauth` | 500 `SERVER_MISCONFIG` | `MOBILE_OAUTH_CALLBACK_URL` is missing, not HTTPS, or does not match the environment's registered redirect |
| `GET` / `DELETE /api/account/delete-reauth` | 400 `DATA_VALIDATION` | `challenge_id` is missing |
| `GET` / `DELETE /api/account/delete-reauth` | 404 | Unknown challenge, or it belongs to another user, grant or client |
| `GET /api/account/delete-reauth` | 200 `{ "status": "expired", "expiresIn": 0 }` | The challenge lifetime has passed; otherwise `expiresIn` is omitted |
| `DELETE /api/account/delete-reauth` | 409 `DATA_CONFLICT` | The challenge is `used` (even if expired), or is unexpired and `failed`, or changed state concurrently |
| `DELETE /api/account/delete-reauth` | 403 `ACCOUNT_DELETE_REAUTH_REQUIRED` | The challenge has expired and is not `used`. Only an unexpired `cancelled` challenge answers idempotently (200 `{ "status": "cancelled" }`) |
| `GET /api/oauth/login/google?purpose=account-delete` | 403 `ACCOUNT_DELETE_REAUTH_REQUIRED` | Challenge is not `pending`, is expired, or its client does not match the environment. A challenge can be started once; open `authorizeUrl` a single time |
| `GET /api/oauth/login/google?purpose=account-delete` (browser) | 401 `AUTH_REQUIRED` | No session |
| `GET /api/oauth/login/google?purpose=account-delete` (browser) | 400 `ACCOUNT_DELETE_REAUTH_UNAVAILABLE` | The account has no linked Google identity |
| `DELETE /api/account` | 403 `ACCOUNT_DELETE_REAUTH_REQUIRED` | No usable proof: absent, expired, cancelled, mismatched, or already used |
| `GET` / `DELETE /api/account` | 403 `PERM_DENIED` | A Bearer token that is not the environment's mobile OAuth client. Such a token no longer falls back to a cookie session on these two endpoints |
| `GET /api/oauth/callback/google` | 400 `OAUTH_PROVIDER_DENIED` | Google returned `error=` for a normal login (previously this surfaced as `OAUTH_MISSING_PARAMS`). For a re-authentication attempt a mobile challenge redirects to the app link with `status=failed`, and a browser session redirects to `/account?deleteReauth=failed` |

## Known limits before this contract is operational

- **Google `auth_time` is unverified.** The backend requires an ID-token `auth_time` no older than five minutes and not earlier than the attempt, and asks Google with `max_age=0` and a `claims` request. Google's published discovery document (`claims_supported`) does not list `auth_time` and does not advertise `claims_parameter_supported`. If Google does not return it, every re-authentication fails closed and a Google-only account cannot be deleted through this path. A real Google round-trip on UAT must show the claim before production enablement; otherwise a different freshness proof is a product decision.
- **Local development.** The `tripline-mobile-dev` client exists for the OAuth code flow only. `POST /api/account/delete-reauth` requires an HTTPS `MOBILE_OAUTH_CALLBACK_URL` and therefore returns 500 `SERVER_MISCONFIG` under the loopback development contract.
- **Callback host.** `mobile-callback.trip-planner-dby.pages.dev` is a subdomain of this project's `pages.dev` name, so it can only be a branch alias (a deployment of a branch named `mobile-callback`) of the `trip-planner-dby` Pages project; a separate project cannot own it. This repository contains no configuration that creates that branch or host. Whoever can push, force-reset or delete that branch controls or kills the authorization-code landing page for production and UAT at once (batch stale-branch cleanup would too). `public/.well-known/*` reaches the host only through that branch's build. Before production use: keep the branch protected and documented, or move the callback to a custom domain on a dedicated project, or to a path on the main host that a universal link can claim.
- **Challenge lifetime.** One five-minute lifetime covers the whole mobile flow (create, Google login, app-link return, final `DELETE`). A slow login can end as `status=failed`; start a new challenge.
- **Existing `tripline-mobile` builds.** Only the exact production HTTPS redirect is accepted for new authorization-code sign-ins. Builds that used the old loopback redirect cannot start a new sign-in; refresh-token grants are not affected.
