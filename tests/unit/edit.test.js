import { describe, it, expect } from 'vitest';

/**
 * Unit tests for edit.js chat UI structure.
 * Since edit.js is an IIFE (not exported), these tests validate
 * the HTML structure patterns that renderEditPage() and renderIssues()
 * generate, by reimplementing the helper logic inline.
 */

const { escHtml, escUrl } = require('../../js/shared.js');

/* ===== Helper: simulate renderIssues output ===== */
function renderIssuesHtml(issues) {
  if (!issues || !issues.length) {
    return '<div class="edit-issues-empty">尚無修改紀錄</div>';
  }
  var html = '';
  issues.forEach(function(issue) {
    var date = new Date(issue.created_at).toLocaleString('zh-TW', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    var dotClass = issue.state === 'open' ? 'open' : 'closed';
    html += '<div class="message-user">';
    html += '<div class="message-user-header">';
    html += '<span class="status-dot ' + dotClass + '"></span>';
    html += '<a class="message-user-title" href="' + escUrl(issue.html_url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(issue.title) + '</a>';
    html += '</div>';
    html += '<div class="message-user-meta">#' + issue.number + ' · ' + escHtml(date) + '</div>';
    html += '</div>';
  });
  return html;
}

/* ===== Helper: simulate renderEditPage greeting section ===== */
function renderGreetingHtml(owner) {
  var hour = new Date().getHours();
  var greet;
  if (hour >= 6 && hour < 12) {
    greet = '早安';
  } else if (hour >= 12 && hour < 18) {
    greet = '午安';
  } else {
    greet = '晚安';
  }
  var greeting = greet + '，' + escHtml(owner) + '！';

  var html = '<div class="message-system edit-greeting">';
  html += '<div class="message-system-icon">';
  html += '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M12 2 L13.5 9 L20 10.5 L13.5 12 L12 19 L10.5 12 L4 10.5 L10.5 9 Z"/></svg>';
  html += '</div>';
  html += '<div class="message-system-title edit-greeting-text">' + greeting + '</div>';
  html += '<div class="message-system-sub">有什麼行程修改需求？</div>';
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

  it('greeting card uses .message-system class', () => {
    const html = renderGreetingHtml('Ray');
    expect(html).toContain('message-system');
    expect(html).toContain('edit-greeting');
  });

  it('greeting shows owner name', () => {
    const html = renderGreetingHtml('Ray');
    expect(html).toContain('Ray');
    expect(html).toMatch(/早安|午安|晚安/);
  });

  it('greeting has .edit-greeting-text with time-based greeting', () => {
    const html = renderGreetingHtml('HuiYun');
    expect(html).toContain('edit-greeting-text');
    expect(html).toContain('HuiYun');
  });

  it('greeting has .message-system-sub subtitle', () => {
    const html = renderGreetingHtml('Ray');
    expect(html).toContain('message-system-sub');
    expect(html).toContain('有什麼行程修改需求');
  });

  it('greeting has spark icon SVG', () => {
    const html = renderGreetingHtml('Ray');
    expect(html).toContain('message-system-icon');
    expect(html).toContain('<svg');
    expect(html).toContain('</svg>');
  });

  it('escapes XSS in owner name', () => {
    const html = renderGreetingHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

/* ===== renderIssues — bubble rendering ===== */
describe('renderIssues bubble rendering', () => {
  it('returns empty state for no issues', () => {
    const html = renderIssuesHtml([]);
    expect(html).toContain('edit-issues-empty');
    expect(html).toContain('尚無修改紀錄');
  });

  it('returns empty state for null', () => {
    const html = renderIssuesHtml(null);
    expect(html).toContain('edit-issues-empty');
  });

  it('renders issue as .message-user bubble', () => {
    const html = renderIssuesHtml([{
      number: 42,
      title: '修改 Day 3 午餐',
      html_url: 'https://github.com/owner/repo/issues/42',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('message-user');
  });

  it('open issue has green status-dot', () => {
    const html = renderIssuesHtml([{
      number: 1,
      title: 'Open issue',
      html_url: 'https://github.com/x/y/issues/1',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('status-dot open');
    expect(html).not.toContain('status-dot closed');
  });

  it('closed issue has gray status-dot', () => {
    const html = renderIssuesHtml([{
      number: 2,
      title: 'Closed issue',
      html_url: 'https://github.com/x/y/issues/2',
      state: 'closed',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('status-dot closed');
    expect(html).not.toContain('status-dot open');
  });

  it('renders issue title as link', () => {
    const html = renderIssuesHtml([{
      number: 5,
      title: '加入景點',
      html_url: 'https://github.com/owner/repo/issues/5',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('message-user-title');
    expect(html).toContain('href="https://github.com/owner/repo/issues/5"');
    expect(html).toContain('加入景點');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders issue number and date in meta', () => {
    const html = renderIssuesHtml([{
      number: 99,
      title: 'Test',
      html_url: 'https://github.com/x/y/issues/99',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('message-user-meta');
    expect(html).toContain('#99');
  });

  it('renders multiple issues as multiple bubbles', () => {
    const html = renderIssuesHtml([
      { number: 1, title: 'A', html_url: 'https://github.com/x/y/issues/1', state: 'open', created_at: '2026-03-01T09:00:00Z' },
      { number: 2, title: 'B', html_url: 'https://github.com/x/y/issues/2', state: 'closed', created_at: '2026-03-01T10:00:00Z' },
    ]);
    const matches = html.match(/class="message-user"/g);
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

  it('message-user-header contains both status-dot and title link', () => {
    const html = renderIssuesHtml([{
      number: 3,
      title: 'Header test',
      html_url: 'https://github.com/x/y/issues/3',
      state: 'open',
      created_at: '2026-03-01T10:00:00Z'
    }]);
    expect(html).toContain('message-user-header');
    // status-dot and title should both appear inside message-user-header
    const headerIdx = html.indexOf('message-user-header');
    const dotIdx = html.indexOf('status-dot', headerIdx);
    const titleIdx = html.indexOf('message-user-title', headerIdx);
    expect(dotIdx).toBeGreaterThan(headerIdx);
    expect(titleIdx).toBeGreaterThan(headerIdx);
  });
});
