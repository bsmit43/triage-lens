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

## Links (paste into the Devpost form)
- **Code:** https://github.com/bsmit43/triage-lens
- **Installation link (Jira):** https://developer.atlassian.com/console/install/e5a318a1-4afc-4307-9179-bd11f7f6ce83?signature=AYABeJNKtAKIv75YQIqbd9VqKgsAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucB03APsN8dcbuS1RoGlulB9wAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDIBsn4ChkBqPtmCDXwIBEIA7bHhIXxEvc%2FNqEYygWrgoUfCFcAysCN6EsrnIDlPzOQ3T2Kyij%2FiGtwtvjLhrcdDDXeR8S8sV2xFPJ50AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgHXC8oRJVcUYjCC2qrB6rHwAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM24ajq14iEx2h12xsAgEQgDtqex1i1N17rGKik854m7YkfWAvoqWZjaFxOX9Cv3U4ZgdVs1dhXx1i7tfwvnOEPYCOLXwTT%2FbSlbjyiQAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAT2RHGlmSSQcrfCyQUUkAnIAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxXn3mtZmXqX%2BMymicCARCAO0SVufcEJMHyn%2BH%2F4AADnoGz%2FybcKPRyGshD%2B3N0zgZKcBr5u%2BKAwsHsldn%2BcFqwkQSBhy0y8uNR2JejAgAAAAAMAAAQAAAAAAAAAAAAAAAAAGcmac%2BujGwAChY09XOtSgL%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADKqdmd0r6XcpuuUK5MxrSbobuiL0DN8hJMp64jDm3ba4O6ytRehXYLb5XHA6OTsmntvEcJ9xvADOs4RGaGUQEiA1b8%3D&product=jira
  (For Confluence runbook search, use the same link with `product=confluence` at the end.)
- **Demo video:** https://youtu.be/zrNPO4GTI4Q

## Testing instructions for judges
1. Open the installation link and install Triage Lens on your Jira site, then on Confluence on the same site if you want runbook search. Approve the requested scopes.
2. Open any Jira Service Management ticket. Ideally use a project with some resolved tickets, so owner suggestions and similar tickets have history to draw on.
3. Open **Rovo** (Ask Rovo, top right), click the agent picker, search for **Triage Lens**, and select it.
4. Type **"Triage this ticket"**, or **"Triage <KEY>"**. You'll get a priority with reasons, a category, a suggested owner, similar resolved tickets and Confluence runbooks.
5. Reply **"yes, apply it"**. Rovo shows a **Please review** card. Click **Confirm**, and the ticket's priority, assignee and labels update and an internal note is added.
6. **MCP (bonus):** in Atlassian Administration → Apps → Sites → your site → Connected apps → triage-lens, click **Enable tools** under "Expose tools to MCP-compatible apps". Then connect any MCP client to `https://mcp.atlassian.com/forge/e5a318a1-4afc-4307-9179-bd11f7f6ce83` and call `suggest-triage`.

Triage Lens works with any priority scheme (Highest/High/… or Critical/Medium/Low or P1–P4). It maps its suggestion onto the site's own priorities.
