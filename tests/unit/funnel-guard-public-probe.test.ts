/**
 * funnel-guard health probe — authoritative-NS edition (v2.55.17)
 *
 * 2026-07-05 incident：原 L2/L3 用 recursive resolver (1.1.1.1/8.8.8.8) 判 funnel
 * 對外可達，但大型 recursive 對 *.ts.net funnel hostname 因 Tailscale 週期 re-publish
 * 造成 negative-cache 300s → 反覆 NXDOMAIN → guard 誤判 drift → serve reset 惡化 →
 * self-perpetuating flapping。funnel 服務本身全程健康。
 *
 * 改查 authoritative NS (dnsimple) 的 A record（= 控制平面實際發布的真相，不受
 * recursive cache 污染）：真 drift（authoritative 也無 record）仍偵測得到 → heal；
 * 假 drift（authoritative 有、只是 recursive cache）→ 判 healthy 不 heal。
 *
 * source-grep 鎖關鍵邏輯防誤改回 recursive。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GUARD = readFileSync(
  join(__dirname, '../../scripts/funnel-guard/guard.sh'),
  'utf8',
);

describe('funnel-guard 3-layer probe', () => {
  it('is_funnel_healthy 依序檢 L1 local / L2 authoritative DNS / L3 reach', () => {
    expect(GUARD).toMatch(/is_funnel_local_healthy \|\| \{ log "L1/);
    expect(GUARD).toContain('is_funnel_dns_published "$host"');
    expect(GUARD).toContain('is_funnel_reach_ok "$host"');
  });

  it('L1 (local) 邏輯保留 — AllowFunnel + Proxy jq query', () => {
    expect(GUARD).toContain('is_funnel_local_healthy()');
    expect(GUARD).toMatch(/AllowFunnel.*endswith\(":443"\)/s);
    expect(GUARD).toMatch(/Proxy] \| any\(\. == \$proxy\)/);
  });

  it('funnel_hostname helper 取 first :443 key from AllowFunnel', () => {
    expect(GUARD).toContain('funnel_hostname()');
    expect(GUARD).toMatch(/AllowFunnel \/\/ \{\} \| keys\[\]\?/);
    expect(GUARD).toMatch(/sed 's\/:443\$\/\/'/);
  });
});

describe('authoritative NS resolve (2026-07-05 recursive-negative-cache incident fix)', () => {
  it('查 authoritative NS 而非 recursive resolver — 舊 recursive 實作已移除', () => {
    expect(GUARD).toContain('funnel_resolve_authoritative()');
    expect(GUARD).not.toContain('PUBLIC_RESOLVERS');
    expect(GUARD).not.toContain('funnel_resolve_public');
  });

  it('動態取 ts.net NS delegation + grep 白名單防 dig 診斷污染 stdout', () => {
    expect(GUARD).toContain('dig +short +time=3 +tries=1 NS ts.net');
    // dig 連線層失敗會把 `;; ...` 診斷印到 stdout — grep 只留合法 NS hostname 行
    expect(GUARD).toContain("grep -E '^[A-Za-z0-9._-]+\\.$'");
  });

  it('dig NS 取不到時 fallback 到已知 dnsimple NS', () => {
    expect(GUARD).toContain('FALLBACK_NS=(ns1.dnsimple.com');
    expect(GUARD).toContain('nslist=("${FALLBACK_NS[@]}")');
  });

  it('A record 查詢經 IPv4 白名單過濾（排除 CNAME/雜訊 + injection）', () => {
    expect(GUARD).toContain('dig +short +time=3 +tries=1 A "$host" @"$ns"');
    expect(GUARD).toContain("grep -E '^[0-9]+\\.[0-9.]+$'");
  });

  it('L2 is_funnel_dns_published = authoritative 有 record（控制平面已發布）', () => {
    expect(GUARD).toContain('is_funnel_dns_published()');
    expect(GUARD).toContain('funnel_resolve_authoritative "$host" >/dev/null');
  });
});

describe('L3 HTTPS reach probe — curl 000 false-healthy guard', () => {
  it('curl --resolve 用 authoritative IP（避過本機 MagicDNS + recursive 污染）', () => {
    expect(GUARD).toContain('ip=$(funnel_resolve_authoritative "$host") || return 1');
    expect(GUARD).toContain('curl -sS -o /dev/null -w "%{http_code}" --max-time 10');
    expect(GUARD).toContain('--resolve "${host}:443:${ip}" "https://${host}/"');
  });

  it('只認真 HTTP response (1xx-5xx) — 排除 curl transport-fail 000（dead ingress 不誤判 healthy）', () => {
    expect(GUARD).toMatch(/\[\[ "\$http_code" =~ \^\[1-5\]\[0-9\]\{2\}\$ \]\]/);
    // 000 false-healthy regression guard：不可退回接受任意 3-digit
    expect(GUARD).not.toMatch(/\^\[0-9\]\{3\}\$/);
  });

  it('10s timeout 涵蓋 DERP relay cold path', () => {
    expect(GUARD).toContain('--max-time 10');
  });
});

describe('real-drift detection preserved', () => {
  it('authoritative 也無 record → L2 判「控制平面未發布，真 drift」→ 仍 heal', () => {
    expect(GUARD).toContain('控制平面未發布，真 drift');
  });
});
