/**
 * Pure builders for the tp-request CONTAINED session (activation precondition 0).
 *
 * These live in their own module (not tripline-api-server.ts) because that file
 * boots an HTTP server on import — so this security-critical string construction
 * would be untestable there. Here it has zero side effects and is unit-tested
 * behaviourally (tests/unit/tp-request-containment.test.ts).
 *
 * See scripts/tp-request-contained/README.md for the two-layer containment design.
 */

/** The separate unix user the contained session runs as (layer A). */
export const TP_AGENT_USER = 'tp-agent';

/** Minimal, secret-free PATH for the scrubbed (`env -i`) contained claude process. */
export const CONTAINED_PATH = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';

/** POSIX shell single-quote escape for values injected into an inline shell command.
 *  Security-sensitive (shell injection) — ONE definition so the token, the trip id,
 *  and every path escape the same way and can't drift apart. */
export function shSingleQuote(s: string): string {
  return s.replace(/'/g, `'\\''`);
}

/**
 * Build the inline shell command for a contained tmux session. INTERACTIVE REPL
 * (no `-p` — headless print mode was deliberately abandoned in v2.30.7 for cold-boot
 * reliability); the skill command is submitted via tmux send-keys once the REPL is
 * ready, exactly like the non-contained spawn.
 *
 * Security invariants (unit-tested):
 *   - runs as tp-agent via `sudo -n -u tp-agent` (layer A: FS isolation)
 *   - `env -i` scrubs the environment (no inherited CLIENT_SECRET / refresh token)
 *   - `--permission-mode dontAsk` + `--settings` + `--strict-mcp-config` = layer B lockdown
 *   - NO `-p`, NO `--dangerously-skip-permissions` / bypassPermissions
 *   - neither the restrict API token NOR CLAUDE_CODE_OAUTH_TOKEN is on the command line:
 *     the API token lives in the 0600 mcp-config file; the OAuth subscription token
 *     (from `claude setup-token`) is read from a 0600 file into the env by an sh wrapper
 *     (`$(cat "$1")`) — so neither ever lands in `ps` / the tmux session name.
 */
export function buildContainedShellCommand(o: {
  claudeBin: string;
  sessionName: string;
  sessionDir: string;
  settingsPath: string;
  mcpConfigPath: string;
  tokenFilePath: string;
}): string {
  const q = shSingleQuote;
  const env = [
    `PATH='${CONTAINED_PATH}'`,
    `HOME='/Users/${TP_AGENT_USER}'`,
    `TMPDIR='${q(`${o.sessionDir}/tmp`)}'`,
    `CLAUDE_CONFIG_DIR='${q(`${o.sessionDir}/config`)}'`,
    `LANG='en_US.UTF-8'`,
  ].join(' ');
  // sh wrapper: read the OAuth token out of a 0600 file into CLAUDE_CODE_OAUTH_TOKEN,
  // then exec claude INTERACTIVELY. Positional args ($1..$5) keep every value — incl.
  // the token FILE path — off claude's own argv. `exec` replaces sh so the tmux pane's
  // foreground process is claude itself.
  const inner =
    'CLAUDE_CODE_OAUTH_TOKEN=$(cat "$1") exec "$2" --permission-mode dontAsk ' +
    '--settings "$3" --mcp-config "$4" --strict-mcp-config --name "$5"';
  return (
    `sudo -n -u ${TP_AGENT_USER} env -i ${env} /bin/sh -c '${inner}' tp-contained ` +
    `'${q(o.tokenFilePath)}' '${q(o.claudeBin)}' '${q(o.settingsPath)}' ` +
    `'${q(o.mcpConfigPath)}' '${q(o.sessionName)}'`
  );
}

/**
 * MCP-config JSON for the contained session. The restrict token + trip go in the
 * server's `env` block because Claude Code stdio MCP servers do NOT inherit the
 * parent (claude) environment — they must be passed explicitly here.
 */
export function buildMcpConfig(o: {
  nodeBin: string;
  mcpServerPath: string;
  token: string;
  restrictTrip: string;
}): string {
  return JSON.stringify({
    mcpServers: {
      tripline: {
        type: 'stdio',
        command: o.nodeBin,
        args: [o.mcpServerPath],
        env: { TRIPLINE_API_TOKEN: o.token, TRIPLINE_RESTRICT_TRIP: o.restrictTrip },
      },
    },
  });
}
