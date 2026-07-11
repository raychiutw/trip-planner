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
 * Build the inline shell command for a contained tmux session.
 *
 * Security invariants (unit-tested):
 *   - runs as tp-agent via `sudo -n -u tp-agent` (layer A: FS isolation)
 *   - `env -i` scrubs the environment (no inherited CLIENT_SECRET / refresh token)
 *   - `--permission-mode dontAsk` + `--settings` = layer B capability lockdown
 *   - NO `--dangerously-skip-permissions` / bypassPermissions (would void the allowlist)
 *   - the restrict token is NOT here (it lives only in the 0600 mcp-config file),
 *     so it never lands in `ps` output or the tmux session name
 */
export function buildContainedShellCommand(o: {
  claudeBin: string;
  skillCommand: string;
  sessionName: string;
  sessionDir: string;
  settingsPath: string;
  mcpConfigPath: string;
}): string {
  const q = shSingleQuote;
  const env = [
    `PATH='${CONTAINED_PATH}'`,
    `HOME='/Users/${TP_AGENT_USER}'`,
    `TMPDIR='${q(`${o.sessionDir}/tmp`)}'`,
    `CLAUDE_CONFIG_DIR='${q(`${o.sessionDir}/config`)}'`,
    `LANG='en_US.UTF-8'`,
  ].join(' ');
  return (
    `sudo -n -u ${TP_AGENT_USER} env -i ${env} ` +
    `'${q(o.claudeBin)}' -p '${q(o.skillCommand)}' ` +
    `--permission-mode dontAsk ` +
    `--settings '${q(o.settingsPath)}' ` +
    `--mcp-config '${q(o.mcpConfigPath)}' ` +
    `--name '${q(o.sessionName)}'`
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
