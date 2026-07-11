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

Until this is done, api-server is **fail-closed**: a restrict-token request
degrades to a read-only service-token session (can't write trips) and alerts —
it never runs the write-capable token in an un-contained session.
