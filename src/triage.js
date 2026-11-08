// Pure triage logic: no Atlassian API calls here, so it is fully unit-testable.

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can cannot could did do does for from had has have ' +
    'help hi hello i im i\'m if in into is it its just me my need no not of on or our please ' +
    'so some still than thanks thank that the their them then there these they this to too ' +
    'up us was we were what when where which while who why will with would you your ' +
    'issue problem ticket request getting get got working work works ' +
    'how every keeps keep sometimes again also any anyone all minutes minute hours hour day days today'
  ).split(/\s+/)
);

// Signals that raise urgency. Weights are additive; reasons are shown to the human.
const URGENCY_SIGNALS = [
  { re: /\b(outage|down|offline|unreachable|not responding|site is down)\b/i, weight: 4, reason: 'Service appears to be down' },
  { re: /\b(security|breach|phish(ing)?|malware|ransomware|compromised|hacked|virus)\b/i, weight: 5, reason: 'Possible security incident' },
  { re: /\b(data loss|lost data|deleted|corrupt(ed)?)\b/i, weight: 3, reason: 'Possible data loss' },
  { re: /\b(all users|everyone|entire (team|office|company)|whole (team|office|company)|multiple users)\b/i, weight: 3, reason: 'Affects many users' },
  { re: /\b(production|prod|customer[- ]facing|payments?|checkout)\b/i, weight: 2, reason: 'Production or customer-facing system' },
  { re: /\b(urgent|asap|immediately|critical|emergency|blocker|blocked)\b/i, weight: 2, reason: 'Reporter marked it urgent' },
  { re: /\b(can'?t|cannot|unable to) (log ?in|login|sign ?in|access)\b/i, weight: 2, reason: 'User is locked out' },
  { re: /\b(deadline|today|end of day|eod)\b/i, weight: 1, reason: 'Time-sensitive' },
];

const LOW_SIGNALS = [
  { re: /\b(feature request|nice to have|when you get a chance|no rush|low priority|question|how do i)\b/i, weight: -2, reason: 'Request or question, not an incident' },
  { re: /\b(cosmetic|typo|wording|color|colour)\b/i, weight: -1, reason: 'Cosmetic' },
];

const CATEGORIES = [
  { name: 'Security', re: /\b(security|phish(ing)?|malware|ransomware|virus|compromised|hacked|mfa|2fa|suspicious)\b/i },
  { name: 'Access', re: /\b(password|log ?in|login|sign ?in|locked out|access|permission|account|sso|okta)\b/i },
  { name: 'Network', re: /\b(vpn|wi-?fi|wifi|network|internet|dns|firewall|latency|connection)\b/i },
  { name: 'Hardware', re: /\b(laptop|monitor|keyboard|mouse|printer|dock|headset|battery|screen|hardware)\b/i },
  { name: 'Email & Collaboration', re: /\b(email|outlook|gmail|calendar|teams|slack|zoom|meeting)\b/i },
  { name: 'Software', re: /\b(install|license|app|application|software|update|crash(es|ed)?|error|bug)\b/i },
];

/** Lower-case keywords ranked by frequency, stopwords removed. */
export function extractKeywords(text, max = 6) {
  if (!text) return [];
  const counts = new Map();
  const words = String(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\-\s]/g, ' ')
    .split(/\s+/);
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w);
}

/** Suggest a Jira priority with human-readable reasons. */
export function scorePriority({ summary = '', description = '' } = {}) {
  const text = `${summary}\n${description}`;
  let score = 0;
  const reasons = [];
  for (const s of [...URGENCY_SIGNALS, ...LOW_SIGNALS]) {
    if (s.re.test(text)) {
      score += s.weight;
      reasons.push(s.reason);
    }
  }
  let priority;
  if (score >= 7) priority = 'Highest';
  else if (score >= 4) priority = 'High';
  else if (score >= 1) priority = 'Medium';
  else if (score >= -1) priority = 'Low';
  else priority = 'Lowest';
  if (reasons.length === 0) reasons.push('No urgency signals found');
  return { priority, score, reasons };
}

/** Best-matching category, or 'General'. */
export function classify({ summary = '', description = '' } = {}) {
  const text = `${summary}\n${description}`;
  for (const c of CATEGORIES) if (c.re.test(text)) return c.name;
  return 'General';
}

/**
 * Suggest an owner from similar resolved issues.
 * similar: [{ assignee: {accountId, displayName} | null, resolved: ISO string | null }]
 * Recent resolutions count more (half-life ~90 days).
 */
export function suggestAssignee(similar = [], now = Date.now()) {
  const tally = new Map();
  for (const issue of similar) {
    const a = issue && issue.assignee;
    if (!a || !a.accountId) continue;
    const resolvedAt = issue.resolved ? Date.parse(issue.resolved) : NaN;
    const ageDays = Number.isFinite(resolvedAt) ? Math.max(0, (now - resolvedAt) / 86400000) : 365;
    const weight = Math.pow(0.5, ageDays / 90);
    const cur = tally.get(a.accountId) || { accountId: a.accountId, displayName: a.displayName || a.accountId, weight: 0, count: 0 };
    cur.weight += weight;
    cur.count += 1;
    tally.set(a.accountId, cur);
  }
  const ranked = [...tally.values()].sort((x, y) => y.weight - x.weight);
  if (ranked.length === 0) return null;
  const top = ranked[0];
  return { accountId: top.accountId, displayName: top.displayName, resolvedSimilar: top.count };
}

function quote(term) {
  return `"${String(term).replace(/["\\]/g, '')}"`;
}

/** JQL for resolved issues that share keywords with the ticket. */
export function buildSimilarJql({ keywords, projectKey, excludeKey }) {
  const kws = (keywords || []).filter(Boolean).slice(0, 5);
  if (kws.length === 0) return null;
  const parts = [];
  if (projectKey) parts.push(`project = ${quote(projectKey)}`);
  parts.push('statusCategory = Done');
  if (excludeKey) parts.push(`key != ${quote(excludeKey)}`);
  parts.push('(' + kws.map((k) => `text ~ ${quote(k)}`).join(' OR ') + ')');
  return parts.join(' AND ') + ' ORDER BY resolved DESC';
}

/** CQL for Confluence pages (runbooks / KB) matching keywords. */
export function buildRunbookCql(keywords) {
  const kws = (keywords || []).filter(Boolean).slice(0, 5);
  if (kws.length === 0) return null;
  return 'type = page AND (' + kws.map((k) => `text ~ ${quote(k)}`).join(' OR ') + ') ORDER BY lastmodified DESC';
}

export const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]{0,9}-\d{1,9}$/;

export function normalizeIssueKey(key) {
  if (typeof key !== 'string') return null;
  const k = key.trim().toUpperCase();
  return ISSUE_KEY_RE.test(k) ? k : null;
}

/** Flatten Atlassian Document Format (or a plain string) to text. */
export function adfToText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('');
  let out = node.text || '';
  if (node.content) out += adfToText(node.content);
  if (['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(node.type)) out += '\n';
  return out;
}

/** Plain text (paragraphs separated by blank lines) to minimal ADF. */
export function textToAdf(text) {
  const paras = String(text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    type: 'doc',
    version: 1,
    content: paras.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
  };
}

/** The internal note Triage Lens posts when the user applies a suggestion. */
export function buildTriageNote({ priority, reasons = [], category, assignee, similarKeys = [], runbooks = [] }) {
  const lines = [`Triage Lens suggestion applied. Priority: ${priority}. Category: ${category}.`];
  if (reasons.length) lines.push(`Why: ${reasons.join('; ')}.`);
  if (assignee) lines.push(`Owner: ${assignee.displayName} (resolved ${assignee.resolvedSimilar} similar ticket(s)).`);
  if (similarKeys.length) lines.push(`Similar resolved tickets: ${similarKeys.join(', ')}.`);
  if (runbooks.length) lines.push(`Runbooks: ${runbooks.map((r) => r.title).join('; ')}.`);
  return lines.join('\n\n');
}
