# Devpost submission: Triage Lens

**Category:** Apps for Software Teams (IT service management)
**Bonus prizes:** Best Agents (Rovo agent), Best app with Atlassian MCP (`rovo:mcp`)
**Deadline:** Tuesday, December 22, 2026, 12:00 pm Pacific Time

## Tagline
Triage any IT ticket in one step, with evidence from tickets your team already resolved.

## Inspiration
On a service desk, the first five minutes of every ticket go to the same four questions: how urgent is this, what kind of problem is it, who usually fixes it, and is there a runbook? The answers are already on the site, in resolved tickets and Confluence pages. Nobody has time to dig them up for every ticket.

## What it does
Triage Lens is a Rovo agent for Jira Service Management. Ask it to triage a ticket and it returns:
- a suggested priority, with the specific reasons behind it
- a category
- a suggested owner: the person who resolved the most similar tickets recently
- the similar resolved tickets and matching Confluence runbooks it used as evidence

When the agent confirms the suggestion with the user, Triage Lens applies it: priority, owner, labels, and an internal note explaining the decision. The same tools are exposed through a `rovo:mcp` server, so external AI clients can triage tickets with the same permissions model.

## How we built it
- Forge app with `rovo:agent`, five `action` modules and one `rovo:mcp` module, running on the nodejs24.x runtime
- Jira REST API v3 (`/search/jql`, issue, comment) and Confluence CQL search, called `asUser()` so the agent never exceeds the user's permissions
- Deterministic, unit-tested triage engine (keyword extraction, urgency scoring, recency-weighted owner suggestion). The model narrates; the rules decide, so every suggestion is explainable
- 20 unit tests with Node's built-in test runner; the API client is injected so handlers are tested without a live site

## Challenges
- Keeping the agent safe: inputs from the model are validated (issue keys, priority allow-list, account IDs), JQL/CQL terms are escaped, and the write action requires explicit confirmation
- Making suggestions explainable enough for an agent to trust them

## Accomplishments
- One action replaces four manual lookups
- Works with nothing but the data teams already have. No setup or training data needed

## What we learned
Rovo actions and `rovo:mcp` let one set of tools serve both the in-product agent and external AI clients.

## What's next
- Learn the team's own urgency keywords from past priority changes
- Duplicate detection and linking
- Publish to the Atlassian Marketplace

## Built with
forge, rovo, mcp, jira-service-management, confluence, javascript, node.js
