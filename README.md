# Triage Lens

**A Rovo agent and MCP server that triages IT service desk tickets in Jira Service Management, using the evidence already on your site.**

Service desks lose time on the first five minutes of every ticket: how urgent is it, what kind of problem is it, who usually fixes this, and is there a runbook? Triage Lens answers all four in one step:

- **Priority with reasons.** It scores urgency signals in the ticket (outage, security, many users affected, locked out, production, explicit urgency, questions and cosmetic requests) and explains every point.
- **Category.** Security, Access, Network, Hardware, Email & Collaboration, Software or General.
- **Owner.** Whoever has resolved the most *similar* tickets recently. Similarity is keyword search over resolved tickets in the same project, weighted by recency.
- **Similar resolved tickets and runbooks.** It cites the past tickets and the Confluence pages it used.

Nothing changes until a person says yes. Then `apply-triage` sets the priority and owner, adds labels, and posts an internal note explaining why. Every call runs **as the invoking user**, so the agent can never see or change more than that person can.

The same five tools are exposed through **`rovo:mcp`**, so external AI clients (Claude, Cursor, VS Code and others) can triage tickets too once a site admin enables it.

## Tools

| Action | Verb | What it does |
|---|---|---|
| `suggest-triage` | GET | Priority, reasons, category, owner, similar tickets and runbooks for one ticket |
| `apply-triage` | UPDATE | Applies a confirmed decision and posts an internal note |
| `get-ticket-context` | GET | Ticket fields as plain text |
| `find-similar-tickets` | GET | Resolved tickets sharing keywords, with who resolved them |
| `find-runbooks` | GET | Confluence pages matching a problem description |

## Setup (about 20 minutes)

1. **Node.js.** The Forge CLI needs Node 22.23.4 or later on 22.x, or 24.22.1 or later on 24.x. Check with `node --version`; update from nodejs.org if needed.
2. **Forge CLI.** `npm install -g @forge/cli`, then `forge --version`.
3. **API token.** At id.atlassian.com → Security → API tokens, choose **Create API token with scopes** and select **Forge**.
4. **Log in.** `forge login` (enter your email and the token).
5. **Register the app.** In this folder: `forge register triage-lens`. This writes your real app ID into `manifest.yml`.
6. **Install dependencies.** `npm install`, then `npm test` (should show 20 passing).
7. **Deploy.** `forge lint`, then `forge deploy`.
8. **Install on a site.** `forge install --demo-site` (Atlassian provisions a demo site), or `forge install` for an existing developer site. Install into **Jira**, and into **Confluence** too if you want runbook search.
9. **Seed demo data (optional).** Create a Jira Service Management project with key `IT`, then run `scripts/seed-demo.mjs` (instructions at the top of the file). Add two or three Confluence pages titled, for example, "VPN troubleshooting runbook".
10. **Try it.** Open Rovo chat, pick **Triage Lens**, and say "Triage IT-16".
11. **Enable MCP (bonus prize).** Atlassian Administration → Apps → Sites → your site → Connected apps → Triage Lens → turn on the tools. The endpoint is `https://mcp.atlassian.com/forge/<appId>`.

## Development

- `npm test` runs the unit tests (`node --test`). All triage logic lives in `src/triage.js` and is pure; API access is injected in `src/handlers.js`, so the handlers are tested with a fake client.
- `forge tunnel` for live reload while testing on your site, and `forge logs` for errors.

## Design notes

- **Deterministic first.** Priority and category come from transparent rules, not a model, so the reasons are auditable and repeatable. Rovo's model only explains the results and handles the conversation.
- **Human in the loop.** The prompt and the action descriptions both require explicit confirmation before `apply-triage`.
- **Untrusted inputs.** Issue keys are validated with a strict regex, priorities against an allow-list, and account IDs against a pattern. JQL and CQL terms are quoted and stripped of quotes. The agent prompt tells it to treat ticket text as data.
- **Fails safe.** Errors return a short message and change nothing. If Confluence is not installed, triage still works without runbooks.

## Scopes

`read:jira-work`, `write:jira-work`, `read:jira-user`, `search:confluence`, `read:confluence-content.summary`.
