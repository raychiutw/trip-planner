# Versioned AI data consent (#1348)

This contract is staged. Migration `0097_ai_data_consent.sql` creates the disclosure and event tables but **does not activate a disclosure**. The processing party, data categories, purpose, revocation wording, and version must be formally approved before a row is activated. Existing OAuth `authorized` grants are not evidence of acceptance.

`GET /api/account/ai-data-consent` works for the signed-in web session or the canonical first-party Flutter Bearer grant. It returns `Cache-Control: no-store` and:

```json
{
  "disclosure": {
    "version": "approved-version",
    "title": "approved title",
    "processor": "approved processor",
    "dataCategories": ["approved category"],
    "purpose": "approved purpose",
    "revocation": "approved instructions"
  },
  "status": "not_accepted",
  "acceptedVersion": null,
  "acceptedAt": null,
  "decidedAt": null
}
```

`status` is `unconfigured` when there is no active disclosure, otherwise `not_accepted`, `current`, `outdated`, `revoked`, or `declined`. `acceptedVersion` and `acceptedAt` preserve the latest actual acceptance, even after revocation or a version change. They never infer acceptance from an OAuth grant. `decidedAt` is the time of the latest consent decision. A version change requires another explicit acceptance.
Times use UTC ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`).

The Web chat uses the approved inline card (prototype C) above the composer. It preserves the draft on refusal or failure and continues the attempted send only after a successful acceptance. When consent is current, “管理 AI 資料同意” opens the same card to revoke it.

Submit `POST /api/account/ai-data-consent` with `{ "version": "approved-version", "decision": "accept" | "decline", "requestId": "<UUID>" }`. Repeating the same `requestId` and decision is idempotent, even if the active version has changed; the response still reports the current status. Reusing it for a different decision or submitting a new decision for an inactive version returns `409`. `DELETE /api/account/ai-data-consent` accepts `{ "version": "approved-version", "requestId": "<UUID>" }` and records revocation. The account actor is always derived from authentication; callers cannot choose another user. Flutter should read the active disclosure before showing its consent UI and send the version actually shown.

Once a disclosure is active, `/api/requests`, trip health checks, and AI note generation require current acceptance by both the submitter and trip owner before accepting new work. The restricted-token mint rechecks both immediately before a queued job starts; if consent has since changed, it marks the job `failed` with `terminalReason: "needs_consent"` and does not issue a token. Already-issued work is not retroactively cancelled, and data previously sent to an external processor cannot be recalled. Existing non-AI features and ordinary OAuth scopes are unaffected.

Rollout order: deploy the migration and endpoint, ship Web and Flutter clients that display the server disclosure and handle `AI_DATA_CONSENT_REQUIRED` (HTTP 403), obtain formal text/version approval, then insert the approved disclosure and set `ai_data_disclosure_state.active_version`. The singleton pointer allows exactly one active version; switching it is one atomic write, without an interval where the gate is disabled. Treat each disclosure row as immutable: revised wording gets a new version and row. Do not activate a placeholder or treat this staged deployment as consent collected.
