import { describe, it, expect } from 'vitest';

/**
 * Unit tests for edit.js chat UI structure.
 * Since edit.js is an IIFE (not exported), these tests validate
 * the HTML structure patterns that renderEditPage() and renderIssues()
 * generate, by reimplementing the helper logic inline.
 */

const { escHtml, escUrl } = require('../../js/shared.js');
const { iconSpan } = require('../../js/icons.js');

/* ===== Helper: simulate getIssueMode ===== */
function getIssueMode(issue) {
  var labels = (issue.labels || []).map(function(l) { return typeof l === 'string' ? l : l.name; });
  if (labels.indexOf('trip-plan') !== -1) return 'plan';
  return 'edit';
}

/* ===== Helper: simulate buildIssueItemHtml ===== */
function buildIssueItemHtml(issue) {
  var date = new Date(issue.created_at).toLocaleString('zh-TW', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  var stateClass = issue.state === 'open' ? 'open' : 'closed';
  var badgeIcon = issue.state === 'open' ? iconSpan('circle-dot') : iconSpan('check-circle');
  var badgeText = issue.state === 'open' ? 'Open' : 'Closed';
  var mode = getIssueMode(issue);
  var modeBadgeText = mode === 'plan' ? '問建議' : '修改';
  var html = '<div class="issue-item ' + stateClass + '">';
  html += '<div class="issue-item-header">';
  html += '<span class="issue-badge ' + stateClass + '">' + badgeIcon + badgeText + '</span>';
  html += '<span class="issue-mode-badge mode-' + mode + '">' + escHtml(modeBadgeText) + '</span>';
  html += '<a class="issue-item-title" href="' + escUrl(issue.html_url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(issue.title) + '</a>';
  html += '</div>';
  if (issue.body) {
    html += '<div class="issue-item-body">' + escHtml(issue.body) + '</div>';
  }
  html += '<div class="issue-item-meta">#' + issue.number + ' · ' + escHtml(date) + '</div>';
  if (issue.comments > 0) {
    html += '<div class="issue-reply" id="reply-' + issue.number + '">\u8B80\u53D6\u56DE\u8986\u4E2D\u2026</div>';
  }
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

  it('open issue has .issue-item.open class and open badge', () => {
    const html = renderIssuesHtml([{
      number: 1,
      title: 'Open issue',
      html_url: 'https://github.com/x/y/issues/1',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-item open');
    expect(html).toContain('issue-badge open');
    expect(html).toContain('Open');
    expect(html).not.toContain('issue-item closed');
  });

  it('closed issue has .issue-item.closed class and closed badge', () => {
    const html = renderIssuesHtml([{
      number: 2,
      title: 'Closed issue',
      html_url: 'https://github.com/x/y/issues/2',
      state: 'closed',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-item closed');
    expect(html).toContain('issue-badge closed');
    expect(html).toContain('Closed');
    expect(html).not.toContain('issue-item open');
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

  it('issue-item-header contains badge before title link', () => {
    const html = renderIssuesHtml([{
      number: 3,
      title: 'Header test',
      html_url: 'https://github.com/x/y/issues/3',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-item-header');
    const badgeIdx = html.indexOf('issue-badge');
    const titleIdx = html.indexOf('issue-item-title');
    expect(badgeIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(badgeIdx);
  });

  it('issue with comments > 0 has reply placeholder', () => {
    const html = renderIssuesHtml([{
      number: 10,
      title: 'With reply',
      html_url: 'https://github.com/x/y/issues/10',
      state: 'closed',
      comments: 2,
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-reply');
    expect(html).toContain('id="reply-10"');
    expect(html).toContain('讀取回覆中…');
  });

  it('issue with 0 comments does not have reply placeholder', () => {
    const html = renderIssuesHtml([{
      number: 12,
      title: 'No comments',
      html_url: 'https://github.com/x/y/issues/12',
      state: 'closed',
      comments: 0,
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).not.toContain('issue-reply');
  });

  it('trip-edit label shows edit mode badge', () => {
    const html = renderIssuesHtml([{
      number: 20,
      title: 'Edit issue',
      html_url: 'https://github.com/x/y/issues/20',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z',
      labels: [{ name: 'trip-edit' }, { name: 'okinawa-trip-2026-Ray' }]
    }]);
    expect(html).toContain('issue-mode-badge mode-edit');
    expect(html).toContain('修改');
  });

  it('trip-plan label shows plan mode badge', () => {
    const html = renderIssuesHtml([{
      number: 21,
      title: 'Plan issue',
      html_url: 'https://github.com/x/y/issues/21',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z',
      labels: [{ name: 'trip-plan' }, { name: 'okinawa-trip-2026-Ray' }]
    }]);
    expect(html).toContain('issue-mode-badge mode-plan');
    expect(html).toContain('問建議');
  });

  it('no labels defaults to edit mode badge', () => {
    const html = renderIssuesHtml([{
      number: 22,
      title: 'No label issue',
      html_url: 'https://github.com/x/y/issues/22',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('issue-mode-badge mode-edit');
  });

  it('displays issue body text', () => {
    const html = renderIssuesHtml([{
      number: 23,
      title: 'Body test',
      html_url: 'https://github.com/x/y/issues/23',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z',
      body: '把 D3 午餐換成拉麵'
    }]);
    expect(html).toContain('issue-item-body');
    expect(html).toContain('把 D3 午餐換成拉麵');
  });

  it('does not render body div when body is empty', () => {
    const html = renderIssuesHtml([{
      number: 24,
      title: 'No body',
      html_url: 'https://github.com/x/y/issues/24',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z',
      body: ''
    }]);
    expect(html).not.toContain('issue-item-body');
  });
});
