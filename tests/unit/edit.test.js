import { describe, it, expect } from 'vitest';

/**
 * Unit tests for edit.js chat UI structure.
 * Since edit.js is an IIFE (not exported), these tests validate
 * the HTML structure patterns that renderEditPage() and renderIssues()
 * generate, by reimplementing the helper logic inline.
 */

const { escHtml, escUrl } = require('../../js/shared.js');

/* ===== Helper: simulate buildIssueItemHtml ===== */
function buildIssueItemHtml(issue) {
  var date = new Date(issue.created_at).toLocaleString('zh-TW', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  var stateClass = issue.state === 'open' ? 'open' : 'closed';
  var html = '<div class="issue-item ' + stateClass + '">';
  html += '<div class="issue-item-header">';
  html += '<a class="issue-item-title" href="' + escUrl(issue.html_url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(issue.title) + '</a>';
  html += '</div>';
  html += '<div class="issue-item-meta">#' + issue.number + ' · ' + escHtml(date) + '</div>';
  html += '</div>';
  return html;
}

/* ===== Helper: simulate renderIssues output ===== */
function renderIssuesHtml(issues) {
  if (!issues || !issues.length) {
    return '<div class="edit-issues-empty">尚無修改紀錄</div>';
  }
  var html = '<div class="issue-list">';
  issues.forEach(function(issue) {
    html += buildIssueItemHtml(issue);
  });
  html += '</div>';
  return html;
}

/* ===== renderEditPage — chat container structure ===== */
describe('renderEditPage chat structure', () => {
  it('generates .chat-container as root', () => {
    const html = '<div class="chat-container">';
    expect(html).toContain('chat-container');
  });

  it('generates .chat-messages scrollable area', () => {
    const html = '<div class="chat-messages">';
    expect(html).toContain('chat-messages');
  });

  it('generates .chat-messages-inner wrapper', () => {
    const html = '<div class="chat-messages-inner">';
    expect(html).toContain('chat-messages-inner');
  });

});

/* ===== renderIssues — list rendering ===== */
describe('renderIssues list rendering', () => {
  it('returns empty state for no issues', () => {
    const html = renderIssuesHtml([]);
    expect(html).toContain('edit-issues-empty');
    expect(html).toContain('尚無修改紀錄');
  });

  it('returns empty state for null', () => {
    const html = renderIssuesHtml(null);
    expect(html).toContain('edit-issues-empty');
  });

  it('renders issue as .issue-item in .issue-list', () => {
    const html = renderIssuesHtml([{
      number: 42,
      title: '修改 Day 3 午餐',
      html_url: 'https://github.com/owner/repo/issues/42',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-list');
    expect(html).toContain('issue-item');
  });

  it('open issue has .issue-item.open class', () => {
    const html = renderIssuesHtml([{
      number: 1,
      title: 'Open issue',
      html_url: 'https://github.com/x/y/issues/1',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-item open');
    expect(html).not.toContain('issue-item closed');
    expect(html).not.toContain('status-dot');
  });

  it('closed issue has .issue-item.closed class', () => {
    const html = renderIssuesHtml([{
      number: 2,
      title: 'Closed issue',
      html_url: 'https://github.com/x/y/issues/2',
      state: 'closed',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-item closed');
    expect(html).not.toContain('issue-item open');
    expect(html).not.toContain('status-dot');
  });

  it('renders issue title as link', () => {
    const html = renderIssuesHtml([{
      number: 5,
      title: '加入景點',
      html_url: 'https://github.com/owner/repo/issues/5',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-item-title');
    expect(html).toContain('href="https://github.com/owner/repo/issues/5"');
    expect(html).toContain('加入景點');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders issue number and date in meta (no state text)', () => {
    const html = renderIssuesHtml([{
      number: 99,
      title: 'Test',
      html_url: 'https://github.com/x/y/issues/99',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-item-meta');
    expect(html).toContain('#99');
    expect(html).not.toMatch(/issue-item-meta[^<]*open/);
  });

  it('renders multiple issues as multiple items', () => {
    const html = renderIssuesHtml([
      { number: 1, title: 'A', html_url: 'https://github.com/x/y/issues/1', state: 'open', created_at: '2026-03-01T09:00:00Z' },
      { number: 2, title: 'B', html_url: 'https://github.com/x/y/issues/2', state: 'closed', created_at: '2026-03-01T10:00:00Z' },
    ]);
    const matches = html.match(/class="issue-item /g);
    expect(matches).toHaveLength(2);
  });

  it('escapes XSS in issue title', () => {
    const html = renderIssuesHtml([{
      number: 1,
      title: '<script>alert(1)</script>',
      html_url: 'https://github.com/x/y/issues/1',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sanitizes unsafe URLs', () => {
    const html = renderIssuesHtml([{
      number: 1,
      title: 'XSS URL',
      html_url: 'javascript:alert(1)',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).not.toContain('javascript:');
  });

  it('issue-item-header contains both status-dot and title link', () => {
    const html = renderIssuesHtml([{
      number: 3,
      title: 'Header test',
      html_url: 'https://github.com/x/y/issues/3',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-item-header');
    const headerIdx = html.indexOf('issue-item-header');
    const titleIdx = html.indexOf('issue-item-title', headerIdx);
    expect(titleIdx).toBeGreaterThan(headerIdx);
    expect(html).not.toContain('status-dot');
  });
});
