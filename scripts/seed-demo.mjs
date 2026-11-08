// Seeds a demo Jira Service Management project with realistic IT tickets so Triage Lens has
// history to learn from. Run it yourself against YOUR demo site:
//
//   set JIRA_BASE=https://your-site.atlassian.net
//   set JIRA_EMAIL=you@example.com
//   set JIRA_TOKEN=<API token from id.atlassian.com>
//   set JIRA_PROJECT=IT
//   node scripts/seed-demo.mjs
//
// It creates resolved "history" tickets plus a few open ones to demo. It never prints the token.

const { JIRA_BASE, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT = 'IT', JIRA_ISSUE_TYPE = 'Task' } = process.env;
if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_TOKEN) {
  console.error('Set JIRA_BASE, JIRA_EMAIL and JIRA_TOKEN first (see the comment at the top of this file).');
  process.exit(1);
}
const auth = 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
const headers = { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' };

const adf = (text) => ({ type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

const HISTORY = [
  ['VPN disconnects every few minutes on home wifi', 'GlobalProtect VPN drops when on home wifi. Fixed by switching to the TCP gateway.'],
  ['VPN not connecting after laptop update', 'After the OS update VPN client fails. Reinstalled VPN client.'],
  ['VPN slow for remote staff', 'Latency on VPN for remote users. Moved them to the east gateway.'],
  ['Locked out of account after password reset', 'User locked out after password reset. Unlocked in Okta and reset MFA.'],
  ['Cannot log in to Okta - MFA push not arriving', 'MFA push not arriving. Re-enrolled Okta Verify.'],
  ['Password expired, cannot sign in to email', 'Password expired. Reset password and synced to Outlook.'],
  ['Phishing email reported by finance', 'Suspicious invoice email with link. Blocked sender, purged from mailboxes.'],
  ['Suspicious login alert from unknown country', 'Impossible-travel alert. Forced sign-out, reset password, enabled MFA.'],
  ['Laptop battery drains in two hours', 'Battery health 61%. Replaced battery under warranty.'],
  ['Docking station monitor not detected', 'Second monitor not detected via dock. Updated dock firmware.'],
  ['Printer on 2nd floor offline', 'Printer offline. Power cycled and re-added to print server.'],
  ['Outlook keeps crashing on startup', 'Outlook crash on startup. Removed corrupt add-in, repaired Office.'],
  ['Zoom audio not working in meeting room', 'Room system audio muted at the DSP. Unmuted and saved preset.'],
  ['Need license for Figma', 'Assigned a Figma license from the pool.'],
  ['Wi-Fi drops in conference room B', 'Access point overloaded. Added a second AP.'],
];

const OPEN = [
  ['URGENT: VPN down for the whole office', 'Nobody can connect to VPN since 9am. Production deploys blocked.'],
  ['Got a weird email asking me to verify my password', 'Link looked strange, I clicked it before I noticed. Is my account compromised?'],
  ['Question: how do I change my desktop background?', 'No rush, just curious.'],
];

async function jira(method, path, body) {
  const res = await fetch(`${JIRA_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? {} : res.json();
}

async function create(summary, description) {
  const r = await jira('POST', '/rest/api/3/issue', {
    fields: { project: { key: JIRA_PROJECT }, summary, description: adf(description), issuetype: { name: JIRA_ISSUE_TYPE } },
  });
  return r.key;
}

async function resolve(key) {
  const { transitions } = await jira('GET', `/rest/api/3/issue/${key}/transitions`);
  const done = transitions.find((t) => t.to?.statusCategory?.key === 'done');
  if (!done) return console.warn(`  no "done" transition for ${key}; resolve it by hand`);
  await jira('POST', `/rest/api/3/issue/${key}/transitions`, { transition: { id: done.id } });
}

const me = await jira('GET', '/rest/api/3/myself');
for (const [s, d] of HISTORY) {
  const key = await create(s, d);
  await jira('PUT', `/rest/api/3/issue/${key}/assignee`, { accountId: me.accountId });
  await resolve(key);
  console.log(`resolved ${key}  ${s}`);
}
for (const [s, d] of OPEN) console.log(`open     ${await create(s, d)}  ${s}`);
console.log('Done. Open one of the "open" tickets and ask Triage Lens to triage it.');
