import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHandlers } from '../src/handlers.js';

function fakeClient({ confluenceFails = false } = {}) {
  const calls = [];
  const issue = {
    key: 'IT-9',
    fields: {
      summary: 'VPN down for the whole office',
      description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Urgent: nobody can connect to VPN' }] }] },
      priority: { name: 'Medium' },
      status: { name: 'Open' },
      assignee: null,
      reporter: { displayName: 'Rita' },
      labels: [],
      project: { key: 'IT' },
      issuetype: { name: 'Incident' },
    },
  };
  return {
    calls,
    async jira(method, op, args) {
      calls.push({ method, op, args });
      if (op === 'issue' && method === 'GET') return issue;
      if (op === 'search') {
        return {
          issues: [
            { key: 'IT-1', fields: { summary: 'VPN outage', resolutiondate: new Date().toISOString(), assignee: { accountId: 'acc-bob', displayName: 'Bob' }, resolution: { name: 'Done' } } },
            { key: 'IT-2', fields: { summary: 'VPN slow', resolutiondate: new Date().toISOString(), assignee: { accountId: 'acc-bob', displayName: 'Bob' }, resolution: { name: 'Done' } } },
          ],
        };
      }
      return {};
    },
    async confluence(method, op, args) {
      calls.push({ method, op, args });
      if (confluenceFails) throw new Error('no confluence');
      return { _links: { base: 'https://x.atlassian.net/wiki' }, results: [{ title: 'VPN runbook', url: '/spaces/IT/pages/1', excerpt: '<b>Restart</b> the gateway' }] };
    },
  };
}

test('suggestTriage combines priority, owner, similar tickets and runbooks', async () => {
  const c = fakeClient();
  const r = await makeHandlers(c).suggestTriage({ issueKey: 'it-9' });
  assert.equal(r.issueKey, 'IT-9');
  assert.equal(r.suggestedPriority, 'Highest');
  assert.equal(r.suggestedCategory, 'Network');
  assert.equal(r.suggestedAssignee.accountId, 'acc-bob');
  assert.equal(r.suggestedAssignee.resolvedSimilar, 2);
  assert.deepEqual(r.similarResolved.map((s) => s.key), ['IT-1', 'IT-2']);
  assert.equal(r.runbooks[0].url, 'https://x.atlassian.net/wiki/spaces/IT/pages/1');
  assert.equal(r.runbooks[0].excerpt, 'Restart the gateway');
  const search = c.calls.find((x) => x.op === 'search');
  assert.match(search.args.jql, /key != "IT-9"/);
  assert.ok(!c.calls.some((x) => x.method === 'PUT'), 'suggest must not write');
});

test('suggestTriage uses the issue from context when no key is passed', async () => {
  const r = await makeHandlers(fakeClient()).suggestTriage({ context: { jira: { issueKey: 'IT-9' } } });
  assert.equal(r.issueKey, 'IT-9');
});

test('suggestTriage still works when Confluence is unavailable', async () => {
  const r = await makeHandlers(fakeClient({ confluenceFails: true })).suggestTriage({ issueKey: 'IT-9' });
  assert.deepEqual(r.runbooks, []);
});

test('bad issue keys are rejected without calling Jira', async () => {
  const c = fakeClient();
  const r = await makeHandlers(c).suggestTriage({ issueKey: 'not a key' });
  assert.ok(r.error);
  assert.equal(c.calls.length, 0);
});

test('applyTriage validates priority and writes fields, labels and a comment', async () => {
  const c = fakeClient();
  const h = makeHandlers(c);
  const bad = await h.applyTriage({ issueKey: 'IT-9', priority: 'Super urgent' });
  assert.ok(bad.error);
  assert.ok(!c.calls.some((x) => x.method !== 'GET'), 'a rejected priority must not write anything');

  const ok = await h.applyTriage({ issueKey: 'IT-9', priority: 'High', assigneeAccountId: 'acc-bob', category: 'Network', note: 'VPN outage' });
  assert.equal(ok.commentAdded, true);
  const put = c.calls.find((x) => x.method === 'PUT');
  assert.deepEqual(put.args.body.fields, { priority: { name: 'High' }, assignee: { accountId: 'acc-bob' } });
  assert.deepEqual(put.args.body.update.labels, [{ add: 'triaged-by-triage-lens' }, { add: 'triage-network' }]);
  const comment = c.calls.find((x) => x.op === 'comment');
  assert.equal(comment.args.body.body.content[0].content[0].text, 'VPN outage');
});

test('applyTriage ignores a malformed accountId', async () => {
  const c = fakeClient();
  await makeHandlers(c).applyTriage({ issueKey: 'IT-9', priority: 'Low', assigneeAccountId: 'x"; DROP' });
  const put = c.calls.find((x) => x.method === 'PUT');
  assert.equal(put.args.body.fields.assignee, undefined);
});

test('findRunbooks needs a query', async () => {
  const h = makeHandlers(fakeClient());
  assert.ok((await h.findRunbooks({ query: '' })).error);
  const r = await h.findRunbooks({ query: 'vpn disconnects on wifi' });
  assert.equal(r.runbooks[0].title, 'VPN runbook');
});

function clientWithPriorities(names) {
  const c = fakeClient();
  const base = c.jira;
  c.jira = async (method, op, args) => {
    if (op === 'priorities') {
      c.calls.push({ method, op, args });
      return names.map((name, i) => ({ id: String(i), name }));
    }
    return base(method, op, args);
  };
  return c;
}

test('suggestTriage reports priority in the site scheme (Critical/Medium/Low)', async () => {
  const c = clientWithPriorities(['Critical', 'Medium', 'Low']);
  const r = await makeHandlers(c).suggestTriage({ issueKey: 'IT-9' });
  assert.equal(r.urgencyLevel, 'Highest');
  assert.equal(r.suggestedPriority, 'Critical');
});

test('applyTriage maps level names onto the site scheme and rejects unknown names', async () => {
  const c = clientWithPriorities(['Critical', 'Medium', 'Low']);
  const h = makeHandlers(c);
  await h.applyTriage({ issueKey: 'IT-9', priority: 'High' });
  const put = c.calls.find((x) => x.method === 'PUT');
  assert.equal(put.args.body.fields.priority.name, 'Critical');
  const bad = await h.applyTriage({ issueKey: 'IT-9', priority: 'Whenever' });
  assert.match(bad.error, /Critical, Medium, Low/);
});

test('findSimilarTickets clamps maxResults', async () => {
  const c = fakeClient();
  await makeHandlers(c).findSimilarTickets({ issueKey: 'IT-9', maxResults: 500 });
  assert.equal(c.calls.find((x) => x.op === 'search').args.maxResults, 20);
});
