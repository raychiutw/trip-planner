import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function linkIo(failedDays = false) {
  return {
    getToken: async () => 'test-token',
    fetch: vi.fn(async (url: string) => {
      if (url.endsWith('/api/trips')) return Response.json([{ id: 'good', published: true }, { id: 'bad', published: true }]);
      if (url.endsWith('/good/days')) return Response.json([{ timeline: [{ location: { googleQuery: 'https://maps.google.com/good' } }] }]);
      if (url.endsWith('/bad/days')) return failedDays ? new Response('', { status: 503 }) : Response.json([]);
      if (url === 'https://maps.google.com/good') return new Response('', { status: 200 });
      throw new Error('Unexpected external request: ' + url);
    }),
  };
}

describe('one operations run through real sources and report rendering', () => {
  it('preserves successful link evidence when another trip cannot be checked', async () => {
    const { runOperations } = require('../../scripts/lib/operations-run');
    const { createReportSources, buildHtml } = require('../../scripts/daily-report');
    const result = await runOperations(createReportSources(linkIo(true)), { now: () => new Date('2026-09-21T00:00:00Z') });
    const serialized = JSON.parse(JSON.stringify(result));
    expect(serialized.sources.links.completion).toBe('partial');
    expect(serialized.sources.links.data.checked).toBe(1);
    expect(serialized.sources.links.data.failures).toEqual([expect.objectContaining({ tripId: 'bad' })]);
    expect(serialized.summary.healthy).toBe(false);
    const html = buildHtml({ links: result.sources.links, summary: result.summary });
    expect(html).toContain('部分完成');
    expect(html).not.toContain('全部連結正常');
  });
  it.each([
    ['complete', 'complete', false, true],
    ['zero', 'complete', true, false],
    ['all-days-fail', 'failed', false, false],
    ['partial-broken', 'partial', false, false],
    ['timeout', 'partial', false, false],
    ['empty-days', 'complete', true, false],
    ['token-fail', 'failed', false, false],
  ])('%s remains distinct in JSON, HTML and summary', async (scenario, completion, empty, healthy) => {
    const { runOperations, summaryText } = require('../../scripts/lib/operations-run');
    const { createReportSources, buildHtml } = require('../../scripts/daily-report');
    const io = linkIo();
    const fetch = io.fetch;
    io.fetch = vi.fn(async (url: string) => {
      if (scenario === 'zero' && url.endsWith('/api/trips')) return Response.json([]);
      if (scenario === 'all-days-fail' && url.endsWith('/days')) return new Response('', { status: 503 });
      if (scenario === 'empty-days' && url.endsWith('/days')) return Response.json([]);
      if (scenario === 'timeout' && url.endsWith('/bad/days')) throw new DOMException('Timed out', 'TimeoutError');
      if (scenario === 'partial-broken') {
        if (url.endsWith('/bad/days')) return new Response('', { status: 503 });
        if (url === 'https://maps.google.com/good') return new Response('', { status: 404 });
      }
      return fetch(url);
    });
    if (scenario === 'token-fail') io.getToken = async () => { throw new Error('Token unavailable'); };
    const result = await runOperations(createReportSources(io));
    const html = buildHtml({ links: result.sources.links, summary: result.summary });
    const json = JSON.parse(JSON.stringify(result));
    expect(json.sources.links.completion).toBe(completion);
    expect(json.summary).toMatchObject({ completion, empty, healthy });
    expect(html).toContain(summaryText(result.summary));
    if (healthy) expect(html).toContain('全部連結正常');
    else expect(html).not.toContain('全部連結正常');
    if (scenario === 'partial-broken') {
      expect(json.sources.links.data.broken).toEqual([{ url: 'https://maps.google.com/good', status: 404 }]);
      expect(json.summary.severity).toBe('critical');
      expect(html).toContain('1 個壞連結');
      expect(html).toContain('部分完成');
    }
    if (scenario === 'token-fail') expect(io.fetch).not.toHaveBeenCalled();
  });

  it('link transport failure retains its existing broken-link severity and marks the check incomplete', async () => {
    const { runOperations } = require('../../scripts/lib/operations-run');
    const { createReportSources, buildHtml } = require('../../scripts/daily-report');
    const io = linkIo();
    const fetch = io.fetch;
    io.fetch = vi.fn(async (url: string) => {
      if (url === 'https://maps.google.com/good') throw new DOMException('Timed out', 'TimeoutError');
      return fetch(url);
    });
    const result = await runOperations(createReportSources(io));
    expect(result.sources.links).toMatchObject({ completion: 'partial', severity: 'critical' });
    const html = buildHtml({ links: result.sources.links, summary: result.summary });
    expect(html).toContain('network error');
    expect(html).toContain('部分完成');
  });

});
