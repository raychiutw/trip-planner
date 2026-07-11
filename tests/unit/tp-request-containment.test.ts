/**
 * tp-request containment — behavioural tests of the pure spawn builders
 * (scripts/lib/contained-spawn.ts). These lock the security invariants that make
 * layer A+B containment hold, by actual output inspection (not source-grep).
 */
import { describe, it, expect } from 'vitest';
import {
  buildContainedShellCommand,
  buildMcpConfig,
  shSingleQuote,
  TP_AGENT_USER,
  CONTAINED_PATH,
} from '../../scripts/lib/contained-spawn';

const BASE = {
  claudeBin: '/Users/ray/.local/bin/claude',
  skillCommand: '/tp-request',
  sessionName: 'tripline-tp-request-123-456',
  sessionDir: '/Users/tp-agent/.tripline-contained/tripline-tp-request-123-456',
  settingsPath: '/repo/scripts/tp-request-contained/settings.json',
  mcpConfigPath: '/Users/tp-agent/.tripline-contained/tripline-tp-request-123-456/mcp-config.json',
};
const TOKEN = 'restrict-tok-SECRET-abc123';

describe('buildContainedShellCommand — layer A (OS isolation + env scrub)', () => {
  it('runs as tp-agent via non-interactive sudo', () => {
    const cmd = buildContainedShellCommand(BASE);
    expect(cmd).toContain(`sudo -n -u ${TP_AGENT_USER} `);
  });

  it('scrubs the environment with env -i and sets only safe vars', () => {
    const cmd = buildContainedShellCommand(BASE);
    expect(cmd).toContain('env -i ');
    expect(cmd).toContain(`PATH='${CONTAINED_PATH}'`);
    expect(cmd).toContain(`HOME='/Users/${TP_AGENT_USER}'`);
    expect(cmd).toContain('TMPDIR=');
    expect(cmd).toContain('CLAUDE_CONFIG_DIR=');
    // no ambient secret var names leak into the scrubbed env
    expect(cmd).not.toMatch(/CLIENT_SECRET|REFRESH|\.env\.local/i);
  });
});

describe('buildContainedShellCommand — layer B (capability lockdown)', () => {
  it('uses dontAsk + isolated --settings + --mcp-config + --strict-mcp-config', () => {
    const cmd = buildContainedShellCommand(BASE);
    expect(cmd).toContain('--permission-mode dontAsk');
    expect(cmd).toContain(`--settings '${BASE.settingsPath}'`);
    expect(cmd).toContain(`--mcp-config '${BASE.mcpConfigPath}'`);
    // ignore any project .mcp.json — tripline is provably the whole tool surface
    expect(cmd).toContain('--strict-mcp-config');
    expect(cmd).toContain("-p '/tp-request'");
  });

  it('NEVER passes --dangerously-skip-permissions / bypassPermissions (would void the allowlist)', () => {
    const cmd = buildContainedShellCommand(BASE);
    expect(cmd).not.toContain('--dangerously-skip-permissions');
    expect(cmd).not.toContain('bypassPermissions');
  });
});

describe('buildContainedShellCommand — token never on the command line', () => {
  it('the restrict token does not appear in the shell command (only in the mcp-config file)', () => {
    // token is not even an input to the builder — prove it can't leak into `ps`
    const cmd = buildContainedShellCommand(BASE);
    expect(cmd).not.toContain(TOKEN);
    expect(cmd).not.toMatch(/TRIPLINE_API_TOKEN/);
  });
});

describe('buildContainedShellCommand — shell-injection safety', () => {
  it('single-quotes every interpolated value; a malicious session name cannot break out', () => {
    const evil = "x'; rm -rf ~; echo '";
    const cmd = buildContainedShellCommand({ ...BASE, sessionName: evil });
    // escaping applied: each ' becomes '\'' so the value stays inside its single quotes
    expect(cmd).toContain(shSingleQuote(evil));
    // the raw breakout (bare quote immediately closing then `;`) is neutralised
    expect(cmd).not.toContain("x';");
  });
});

describe('buildMcpConfig — token delivery via server env (not inherited)', () => {
  it('embeds the restrict token + trip in the tripline server env block', () => {
    const cfg = JSON.parse(buildMcpConfig({
      nodeBin: '/opt/homebrew/bin/node',
      mcpServerPath: '/repo/scripts/tp-request-mcp-server.js',
      token: TOKEN,
      restrictTrip: 'trip-XYZ',
    }));
    const server = cfg.mcpServers.tripline;
    expect(server.type).toBe('stdio');
    expect(server.command).toBe('/opt/homebrew/bin/node');
    expect(server.args).toEqual(['/repo/scripts/tp-request-mcp-server.js']);
    expect(server.env.TRIPLINE_API_TOKEN).toBe(TOKEN);
    expect(server.env.TRIPLINE_RESTRICT_TRIP).toBe('trip-XYZ');
  });

  it('exposes only the tripline server (no other MCP servers)', () => {
    const cfg = JSON.parse(buildMcpConfig({ nodeBin: 'node', mcpServerPath: 's.js', token: 't', restrictTrip: 'r' }));
    expect(Object.keys(cfg.mcpServers)).toEqual(['tripline']);
  });
});
