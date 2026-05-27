/**
 * funnel-guard public DNS + HTTPS reach probe — v2.33.134 PR10 part 1
 *
 * 2026-05-27 incident：Tailscale 控制平面 funnel state on，但 public DNS
 * NXDOMAIN（@1.1.1.1 永久 fail，@8.8.8.8 OK）→ CF Worker 530。原 guard 只
 * 檢 local state 完全錯失。本 PR 加 L2 DNS + L3 HTTPS reach probe，multi-
 * resolver fallback 防 single-resolver outage。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GUARD = readFileSync(
  join(__dirname, '../../scripts/funnel-guard/guard.sh'),
  'utf8',
);

describe('funnel-guard 3-layer probe', () => {
  it('is_funnel_healthy 依序檢 L1 local / L2 DNS / L3 reach', () => {
    expect(GUARD).toMatch(/is_funnel_local_healthy \|\| \{ log "L1/);
    expect(GUARD).toMatch(/is_funnel_public_dns_ok "\$host"/);
    expect(GUARD).toMatch(/is_funnel_public_reach_ok "\$host"/);
  });

  it('L1 (local) 邏輯保留 — AllowFunnel + Proxy jq query', () => {
    expect(GUARD).toMatch(/is_funnel_local_healthy\(\)/);
    expect(GUARD).toMatch(/AllowFunnel.*endswith\(":443"\)/s);
    expect(GUARD).toMatch(/Proxy] \| any\(\. == \$proxy\)/);
  });

  it('funnel_hostname helper 取 first :443 key from AllowFunnel', () => {
    expect(GUARD).toMatch(/funnel_hostname\(\)/);
    expect(GUARD).toMatch(/AllowFunnel \/\/ \{\} \| keys\[\]\?/);
    expect(GUARD).toMatch(/sed 's\/:443\$\/\/'/);
  });
});

describe('multi-resolver fallback (DNS gap incident root cause)', () => {
  it('PUBLIC_RESOLVERS 含 1.1.1.1 + 8.8.8.8 + 9.9.9.9 + OpenDNS', () => {
    expect(GUARD).toMatch(/PUBLIC_RESOLVERS=\(1\.1\.1\.1 8\.8\.8\.8 9\.9\.9\.9 208\.67\.222\.222\)/);
  });

  it('funnel_resolve_public iterates resolvers (portable array syntax — bash + zsh 都跑)', () => {
    expect(GUARD).toMatch(/for ns in "\$\{PUBLIC_RESOLVERS\[@\]\}"; do/);
    expect(GUARD).toMatch(/dig \+short \+time=3 \+tries=1 "\$host" @"\$ns"/);
  });

  it('echoes first non-empty IP + return 0 (供 caller curl --resolve)', () => {
    expect(GUARD).toMatch(/printf '%s' "\$ip"\s+return 0/);
  });

  it('docstring 解釋 1.1.1.1 對 .tail2750c0.ts.net 永久 NXDOMAIN incident', () => {
    expect(GUARD).toMatch(/1\.1\.1\.1.*NXDOMAIN/);
    expect(GUARD).toMatch(/CF Worker forgot-password\s+# 530/);
  });
});

describe('L3 HTTPS reach probe', () => {
  it('curl --resolve 強制走 public IP（避過本機 MagicDNS）', () => {
    expect(GUARD).toMatch(/curl -sS -o \/dev\/null -w "%\{http_code\}" --max-time 10/);
    expect(GUARD).toMatch(/--resolve "\$\{host\}:443:\$\{ip\}" "https:\/\/\$\{host\}\/"/);
  });

  it('任何 3-digit HTTP code 算 reachable（4xx 也算 — 只看 TCP+TLS handshake）', () => {
    expect(GUARD).toMatch(/\[\[ "\$http_code" =~ \^\[0-9\]\{3\}\$ \]\]/);
  });

  it('10s timeout 涵蓋 DERP relay cold path', () => {
    expect(GUARD).toMatch(/--max-time 10/);
  });
});
