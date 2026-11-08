import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractKeywords,
  scorePriority,
  classify,
  suggestAssignee,
  buildSimilarJql,
  buildRunbookCql,
  normalizeIssueKey,
  adfToText,
  textToAdf,
  buildTriageNote,
} from '../src/triage.js';

test('extractKeywords drops stopwords, numbers and urls, ranks by frequency', () => {
  const kws = extractKeywords('VPN keeps dropping. VPN disconnects every 10 minutes https://x.io/a on wifi');
  assert.equal(kws[0], 'vpn');
  assert.ok(kws.includes('wifi'));
  assert.ok(!kws.includes('10'));
  assert.ok(!kws.some((k) => k.includes('http')));
  assert.deepEqual(extractKeywords(''), []);
});

test('scorePriority: security incident affecting everyone is Highest', () => {
  const r = scorePriority({ summary: 'Phishing email - everyone clicked', description: 'urgent, possible compromised accounts' });
  assert.equal(r.priority, 'Highest');
  assert.ok(r.reasons.includes('Possible security incident'));
});

test('scorePriority: outage is at least High', () => {
  const r = scorePriority({ summary: 'Payroll site is down', description: '' });
  assert.ok(['Highest', 'High'].includes(r.priority));
});

test('scorePriority: question is Low or Lowest', () => {
  const r = scorePriority({ summary: 'Question: how do I change my desktop color', description: 'no rush' });
  assert.ok(['Low', 'Lowest'].includes(r.priority));
});

test('scorePriority: neutral text is Low with a default reason', () => {
  const r = scorePriority({ summary: 'Monitor flickers sometimes' });
  assert.equal(r.priority, 'Low');
  assert.deepEqual(r.reasons, ['No urgency signals found']);
});

test('classify picks the first matching category', () => {
  assert.equal(classify({ summary: 'Suspicious login and MFA prompt' }), 'Security');
  assert.equal(classify({ summary: 'Forgot password' }), 'Access');
  assert.equal(classify({ summary: 'VPN slow' }), 'Network');
  assert.equal(classify({ summary: 'Laptop battery dies' }), 'Hardware');
  assert.equal(classify({ summary: 'Hello' }), 'General');
});

test('suggestAssignee weights recent resolutions higher', () => {
  const now = Date.parse('2026-11-01T00:00:00Z');
  const alice = { accountId: 'a', displayName: 'Alice' };
  const bob = { accountId: 'b', displayName: 'Bob' };
  const similar = [
    { assignee: alice, resolved: '2025-01-01T00:00:00Z' },
    { assignee: alice, resolved: '2025-02-01T00:00:00Z' },
    { assignee: bob, resolved: '2026-10-25T00:00:00Z' },
    { assignee: null, resolved: '2026-10-25T00:00:00Z' },
  ];
  const s = suggestAssignee(similar, now);
  assert.equal(s.accountId, 'b');
  assert.equal(s.resolvedSimilar, 1);
  assert.equal(suggestAssignee([], now), null);
});

test('buildSimilarJql escapes quotes and excludes the source issue', () => {
  const jql = buildSimilarJql({ keywords: ['vpn', 'drop"s'], projectKey: 'IT', excludeKey: 'IT-7' });
  assert.equal(jql, 'project = "IT" AND statusCategory = Done AND key != "IT-7" AND (text ~ "vpn" OR text ~ "drops") ORDER BY resolved DESC');
  assert.equal(buildSimilarJql({ keywords: [] }), null);
});

test('buildRunbookCql', () => {
  assert.equal(buildRunbookCql(['vpn']), 'type = page AND (text ~ "vpn") ORDER BY lastmodified DESC');
  assert.equal(buildRunbookCql([]), null);
});

test('normalizeIssueKey validates and upper-cases', () => {
  assert.equal(normalizeIssueKey(' it-42 '), 'IT-42');
  assert.equal(normalizeIssueKey('IT42'), null);
  assert.equal(normalizeIssueKey('IT-42; DROP'), null);
  assert.equal(normalizeIssueKey(42), null);
});

test('ADF round trip', () => {
  const adf = textToAdf('Line one\n\nLine two');
  assert.equal(adf.content.length, 2);
  assert.equal(adfToText(adf).trim(), 'Line one\nLine two');
  assert.equal(adfToText('plain'), 'plain');
  assert.equal(adfToText(null), '');
});

test('buildTriageNote includes the key facts', () => {
  const note = buildTriageNote({
    priority: 'High',
    reasons: ['Service appears to be down'],
    category: 'Network',
    assignee: { displayName: 'Bob', resolvedSimilar: 3 },
    similarKeys: ['IT-1', 'IT-2'],
    runbooks: [{ title: 'VPN runbook' }],
  });
  assert.match(note, /Priority: High/);
  assert.match(note, /Bob/);
  assert.match(note, /IT-1, IT-2/);
  assert.match(note, /VPN runbook/);
});
