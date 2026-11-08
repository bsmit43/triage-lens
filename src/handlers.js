// Action handlers. Atlassian API access is injected (`client`) so handlers are unit-testable;
// src/index.js wires them to the real @forge/api client.
import {
  PRIORITIES,
  extractKeywords,
  scorePriority,
  classify,
  suggestAssignee,
  buildSimilarJql,
  buildRunbookCql,
  normalizeIssueKey,
  mapToSitePriority,
  adfToText,
  textToAdf,
  buildTriageNote,
} from './triage.js';

const MAX_DESC_CHARS = 4000;

function resolveIssueKey(payload) {
  const raw = payload?.issueKey ?? payload?.context?.jira?.issueKey;
  return normalizeIssueKey(raw);
}

function badKey() {
  return { error: 'Please give me a valid Jira issue key, for example IT-123.' };
}

/**
 * client shape:
 *   jira(method, path, body?) -> parsed JSON (throws {status, message} on failure)
 *   confluence(method, path, body?) -> parsed JSON
 * Paths are built by the caller with encodeURIComponent; index.js uses @forge/api `route` instead.
 */
export function makeHandlers(client) {
  let sitePriorities = null;
  async function getSitePriorities() {
    if (sitePriorities) return sitePriorities;
    try {
      const res = await client.jira('GET', 'priorities', {});
      const list = Array.isArray(res) ? res : res.values || [];
      sitePriorities = list.map((p) => p.name).filter(Boolean);
    } catch {
      sitePriorities = [];
    }
    return sitePriorities;
  }

  async function loadIssue(key) {
    const issue = await client.jira('GET', 'issue', {
      key,
      fields: 'summary,description,priority,status,assignee,reporter,labels,project,created,issuetype',
    });
    const f = issue.fields || {};
    return {
      key: issue.key,
      summary: f.summary || '',
      description: adfToText(f.description).slice(0, MAX_DESC_CHARS),
      priority: f.priority?.name || null,
      status: f.status?.name || null,
      assignee: f.assignee ? { accountId: f.assignee.accountId, displayName: f.assignee.displayName } : null,
      reporter: f.reporter?.displayName || null,
      labels: f.labels || [],
      projectKey: f.project?.key || null,
      issueType: f.issuetype?.name || null,
      created: f.created || null,
    };
  }

  async function searchSimilar(issue, max) {
    const keywords = extractKeywords(`${issue.summary} ${issue.summary} ${issue.description}`);
    const jql = buildSimilarJql({ keywords, projectKey: issue.projectKey, excludeKey: issue.key });
    if (!jql) return { keywords, similar: [] };
    const res = await client.jira('POST', 'search', {
      jql,
      maxResults: max,
      fields: ['summary', 'assignee', 'resolutiondate', 'priority', 'resolution'],
    });
    const similar = (res.issues || []).map((i) => ({
      key: i.key,
      summary: i.fields?.summary || '',
      priority: i.fields?.priority?.name || null,
      resolution: i.fields?.resolution?.name || null,
      resolved: i.fields?.resolutiondate || null,
      assignee: i.fields?.assignee ? { accountId: i.fields.assignee.accountId, displayName: i.fields.assignee.displayName } : null,
    }));
    return { keywords, similar };
  }

  async function searchRunbooks(keywords, max = 5) {
    const cql = buildRunbookCql(keywords);
    if (!cql) return [];
    try {
      const res = await client.confluence('GET', 'search', { cql, limit: max });
      return (res.results || []).map((r) => ({
        title: r.title || r.content?.title || 'Untitled',
        url: r.url ? `${res._links?.base || ''}${r.url}` : null,
        excerpt: (r.excerpt || '').replace(/<[^>]+>/g, '').slice(0, 200),
      }));
    } catch {
      // Confluence may not be installed on the site; triage still works without runbooks.
      return [];
    }
  }

  return {
    async getTicketContext(payload) {
      const key = resolveIssueKey(payload);
      if (!key) return badKey();
      return await loadIssue(key);
    },

    async findSimilarTickets(payload) {
      const key = resolveIssueKey(payload);
      if (!key) return badKey();
      const max = Math.min(Math.max(parseInt(payload?.maxResults, 10) || 5, 1), 20);
      const issue = await loadIssue(key);
      const { keywords, similar } = await searchSimilar(issue, max);
      return { issueKey: key, keywords, similar };
    },

    async findRunbooks(payload) {
      const keywords = extractKeywords(payload?.query || '');
      if (keywords.length === 0) return { error: 'Tell me what to search for, for example "vpn disconnects".' };
      return { keywords, runbooks: await searchRunbooks(keywords) };
    },

    async suggestTriage(payload) {
      const key = resolveIssueKey(payload);
      if (!key) return badKey();
      const issue = await loadIssue(key);
      const { keywords, similar } = await searchSimilar(issue, 10);
      const { priority: level, reasons } = scorePriority(issue);
      const priority = mapToSitePriority(level, await getSitePriorities()) || level;
      const category = classify(issue);
      const assignee = suggestAssignee(similar);
      const runbooks = await searchRunbooks(keywords, 3);
      return {
        issueKey: key,
        summary: issue.summary,
        currentPriority: issue.priority,
        currentAssignee: issue.assignee?.displayName || null,
        suggestedPriority: priority,
        urgencyLevel: level,
        reasons,
        suggestedCategory: category,
        suggestedAssignee: assignee,
        similarResolved: similar.slice(0, 5).map(({ key: k, summary, resolution }) => ({ key: k, summary, resolution })),
        runbooks,
        note: 'These are suggestions. Ask the user to confirm before calling apply-triage.',
      };
    },

    async applyTriage(payload) {
      const key = resolveIssueKey(payload);
      if (!key) return badKey();
      const names = await getSitePriorities();
      const priority = mapToSitePriority(payload?.priority, names);
      if (!priority) {
        const allowed = names.length ? names : PRIORITIES;
        return { error: `Priority must be one of: ${allowed.join(', ')}.` };
      }
      const accountId = typeof payload?.assigneeAccountId === 'string' && /^[\w:-]{1,128}$/.test(payload.assigneeAccountId)
        ? payload.assigneeAccountId
        : null;
      const category = typeof payload?.category === 'string' ? payload.category.trim().slice(0, 40) : '';
      const label = category ? 'triage-' + category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : null;

      const update = { labels: [{ add: 'triaged-by-triage-lens' }] };
      if (label) update.labels.push({ add: label });
      const fields = { priority: { name: priority } };
      if (accountId) fields.assignee = { accountId };

      await client.jira('PUT', 'issue', { key, body: { fields, update } });

      const noteText = typeof payload?.note === 'string' && payload.note.trim()
        ? payload.note.trim().slice(0, 3000)
        : buildTriageNote({ priority, category: category || 'General' });
      await client.jira('POST', 'comment', { key, body: { body: textToAdf(noteText) } });

      return { issueKey: key, applied: { priority, assigneeAccountId: accountId, labels: update.labels.map((l) => l.add) }, commentAdded: true };
    },
  };
}
