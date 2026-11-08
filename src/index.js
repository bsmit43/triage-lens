// Forge entry point: wires the handlers to the real Atlassian APIs.
// Calls run asUser(), so the agent can only see and change what the invoking user can.
import api, { route } from '@forge/api';
import { makeHandlers } from './handlers.js';

async function readJson(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Atlassian API ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return {};
  return res.json();
}

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

const client = {
  async jira(method, op, args) {
    const user = api.asUser();
    switch (op) {
      case 'issue':
        if (method === 'GET') {
          return readJson(await user.requestJira(route`/rest/api/3/issue/${args.key}?fields=${args.fields}`, { headers: JSON_HEADERS }));
        }
        return readJson(await user.requestJira(route`/rest/api/3/issue/${args.key}`, {
          method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(args.body),
        }));
      case 'priorities':
        return readJson(await user.requestJira(route`/rest/api/3/priority`, { headers: JSON_HEADERS }));
      case 'search':
        return readJson(await user.requestJira(route`/rest/api/3/search/jql`, {
          method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(args),
        }));
      case 'comment':
        return readJson(await user.requestJira(route`/rest/api/3/issue/${args.key}/comment`, {
          method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(args.body),
        }));
      default:
        throw new Error(`Unknown Jira op ${op}`);
    }
  },
  async confluence(method, op, args) {
    if (op !== 'search') throw new Error(`Unknown Confluence op ${op}`);
    return readJson(await api.asUser().requestConfluence(
      route`/wiki/rest/api/search?cql=${args.cql}&limit=${args.limit}`,
      { headers: { Accept: 'application/json' } },
    ));
  },
};

const handlers = makeHandlers(client);

// Never leak stack traces to the agent; return a short, honest error instead.
function safe(fn) {
  return async (payload, context) => {
    try {
      return await fn(payload, context);
    } catch (e) {
      console.error(e);
      if (e.status === 401 || e.status === 403) return { error: 'You do not have permission to do that on this ticket.' };
      if (e.status === 404) return { error: 'I could not find that ticket, or you cannot see it.' };
      return { error: 'Something went wrong talking to Jira. Nothing was changed.' };
    }
  };
}

export const getTicketContext = safe(handlers.getTicketContext);
export const findSimilarTickets = safe(handlers.findSimilarTickets);
export const findRunbooks = safe(handlers.findRunbooks);
export const suggestTriage = safe(handlers.suggestTriage);
export const applyTriage = safe(handlers.applyTriage);
