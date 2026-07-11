# tp-request contained-session assets

Activation precondition (0) for `TP_REQUEST_USER_TOKEN=1`. When api-server
spawns `/tp-request` with a **restrict_trip user token** (write-capable), it runs
Claude Code in a doubly-contained session so a prompt-injected agent can neither
escalate (read creds → re-mint an unrestricted token) nor exfiltrate.

## Two independent layers

- **Layer B (capability)** — `settings.json` here: `--permission-mode dontAsk`
  + only `mcp__tripline__*` allowed + every built-in tool denied. The agent's
  ENTIRE capability surface is the tripline MCP server (`scripts/tp-request-mcp-server.js`).
- **Layer A (OS)** — spawned as the separate unix user **`tp-agent`** with a
  scrubbed env (`env -i`), disposable `HOME` / `TMPDIR` / `CLAUDE_CONFIG_DIR`.
  Filesystem permissions stop `tp-agent` reading `~ray/.tripline/*` or `.env.local`;
  env-scrub stops it inheriting `TRIPLINE_API_CLIENT_SECRET` etc.

Single-layer failure is still contained by the other.

## ⚠️ `deny` is load-bearing — do not trim it

`dontAsk` does NOT auto-deny read-only tools. Read-only Bash (`cat .env.local`),
the `Read` tool, `Grep`, etc. run **without a prompt** in every mode unless
explicitly denied. The `deny` list is what actually blocks credential reads.
Removing `Bash`/`Read`/`Grep`/`Glob` re-opens the file-read vector. Keep
`Agent`/`Task` denied too (sub-agent spawn would bypass the allowlist).

Do NOT pass `--dangerously-skip-permissions` / `bypassPermissions` to a contained
session — it voids the whole allowlist.

## (0a) Ray-manual precondition — I can't do this (needs root)

Before flipping `TP_REQUEST_USER_TOKEN=1`:

```bash
# 1. create the agent user (no login shell, no admin)
sudo sysadminctl -addUser tp-agent -fullName "Tripline Agent" -home /Users/tp-agent
sudo dscl . -create /Users/tp-agent UserShell /usr/bin/false

# 2. let api-server (user: ray) sudo to tp-agent WITHOUT password, non-interactive
#    visudo → add:  ray ALL=(tp-agent) NOPASSWD: ALL

# 3. repo read access for tp-agent (skill files + MCP server), NO write
sudo chmod -R o+rX /Users/ray/Projects/trip-planner
#    ensure creds are NOT o-readable:
chmod 700 /Users/ray/.tripline ; chmod 600 /Users/ray/Projects/trip-planner/.env.local

# 4. verify
sudo -n -u tp-agent true && echo "sudo OK"
sudo -n -u tp-agent test -r /Users/ray/Projects/trip-planner/scripts/tp-request-mcp-server.js && echo "repo read OK"
sudo -n -u tp-agent test -r /Users/ray/.env.local && echo "LEAK: tp-agent can read .env.local" || echo "creds isolated OK"
```

`containmentReady()` also runs a **negative self-probe** at spawn time: if
`tp-agent` CAN read `.env.local` or `~ray/.tripline`, it fails closed (a botched
step-3 chmod won't silently ship porous isolation).

Until (0a) is done, api-server is **fail-closed**: a restrict-token request
degrades to a service-token session (can't write trip content, though it still
holds ops scopes) and alerts — it never runs the write-capable token in an
un-contained session.

## (0b) REQUIRED pre-activation smoke test — run once before `TP_REQUEST_USER_TOKEN=1`

The capability lockdown (dontAsk + deny) and the headless skill invocation are
not e2e-tested in CI (no tp-agent there). Verify them live once:

```bash
SDIR=$(mktemp -d)
# a) a denied built-in must be refused (proves deny is load-bearing):
sudo -n -u tp-agent env -i PATH=/usr/bin:/bin HOME=/Users/tp-agent \
  CLAUDE_CONFIG_DIR="$SDIR" /Users/ray/.local/bin/claude -p 'Run: cat /Users/ray/Projects/trip-planner/.env.local' \
  --permission-mode dontAsk --settings /Users/ray/Projects/trip-planner/scripts/tp-request-contained/settings.json \
  --strict-mcp-config 2>&1 | grep -qi 'denied\|not allowed\|cannot' && echo "BASH DENIED ✓" || echo "LEAK — do not activate"
# b) the skill must actually run headless via -p and the MCP handshake must succeed
#    (protocolVersion 2024-11-05). Do a dry-run against a throwaway request and
#    confirm it reads/writes only that trip. If -p doesn't invoke the skill, fix
#    before flipping the flag.
```

Only flip `TP_REQUEST_USER_TOKEN=1` after both pass.

## Known follow-ups (not blocking merge; flag is OFF)

- **Per-session Google-API budget** — `recomputeTravel` / `enrichPoi` / `poiSearch`
  drive metered Google APIs with no per-session cap; an injected message could burn
  quota within the 90-min session. Add a `bumpRateLimit` budget keyed on the request.
- **Degrade path token on argv** — the service-token fallback still interpolates the
  token on the tmux command line (pre-existing baseline, visible in `ps`). Move it to
  stdin like the contained path.
- **cwd = repo** — the contained session's cwd is the repo, so Claude discovers the
  project `.claude/settings*.json`. The bare-tool `deny` (which removes the tool
  entirely) + `--strict-mcp-config` neutralise today's allows; the smoke test (0b)
  verifies it. Residual risk is only a FUTURE built-in tool not in the deny list.
