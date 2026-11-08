# Demo video script (target 3:30, hard limit under 5:00)

Site: https://one-atlas-expf.atlassian.net, IT Support space (ITS), which already holds 1,000+ sample tickets.
Upload to YouTube as **Public**, then paste the link into Devpost.

## Before recording
- Pick 2–3 **unresolved** tickets in IT Support to triage on camera. ITS-6263 (the Dashloop change request) already shows the "triaged" result, which works well for the "after" shot. For a fresh "before", open the IT Support queue → Open/Waiting and pick, for example, a sync-error, access or laptop ticket.
- Optional: create one fresh ticket in IT Support titled "URGENT: VPN down for the whole office" with the description "Nobody can connect since 9am, production deploys blocked." It reliably shows Critical, Network and the reasons.
- Close other tabs, zoom the browser to 110%, and open the Rovo panel with Triage Lens selected.

## Script
**0:00–0:20 Problem.** Show the IT Support queue.
"Every ticket starts with the same four questions: how urgent is it, what kind of problem is it, who usually fixes it, and is there a runbook? The answers are already here, in a thousand resolved tickets and our Confluence pages."

**0:20–1:30 Triage a ticket.** Open the ticket, then in Rovo pick **Triage Lens** → "Triage this ticket".
Point out:
- suggested priority vs current, with the **reasons**
- the **category**
- the **suggested owner** and how many similar tickets they resolved, e.g. Mitch Davis on Dashloop sync errors
- the **similar resolved tickets** and the **Confluence runbook** it found ("Dashloop Synchronization Architecture")

**1:30–2:10 Human in the loop.** Say "yes, apply it". Show Rovo's **Please review** card, then click **Confirm**. Show the ticket: priority, assignee, labels `triaged-by-triage-lens` and `triage-<category>`, and the internal note.
"Two confirmations, and it only ever acts with the user's own permissions."

**2:10–2:40 It isn't just marking everything urgent.** Triage a question or low-impact request, for example a guest Wi-Fi code or a desktop question, and show Low with the reason "Request or question, not an incident".

**2:40–3:10 Works with any priority scheme.** Mention that this site uses Critical/Medium/Low, and that Triage Lens maps its suggestion onto whatever priorities the site has.

**3:10–3:30 MCP.** Show Admin → Connected apps → triage-lens → "Expose tools to MCP-compatible apps: Enabled", then (optionally) an MCP client calling `suggest-triage` via `https://mcp.atlassian.com/forge/e5a318a1-4afc-4307-9179-bd11f7f6ce83`.
"Same tools, same permissions, in Jira or from any MCP client."

**Close.** "Triage Lens: triage in one step, with evidence your team already has."
