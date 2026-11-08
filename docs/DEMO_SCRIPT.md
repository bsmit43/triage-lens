# Demo video script (target 3:30, hard limit under 5:00)

Upload to YouTube as **Public**, then paste the link into Devpost.

**0:00–0:20 Problem.** Show a Jira Service Management queue with untriaged tickets.
"Every ticket starts with the same questions: how urgent is it, what is it, who fixes it, and is there a runbook? The answers are already here, in tickets we've resolved."

**0:20–1:30 Triage an urgent ticket.** Open "URGENT: VPN down for the whole office". Open Rovo, pick Triage Lens, click "Triage this ticket".
Point out:
- suggested priority **Highest**, with reasons (service down, many users, production, urgent)
- category **Network**
- suggested owner, with the count of similar tickets they resolved
- the similar resolved VPN tickets and the VPN runbook link

**1:30–2:10 Human in the loop.** Say "Yes, apply it." Show the ticket updating: priority, assignee, labels `triaged-by-triage-lens` and `triage-network`, and the internal note.

**2:10–2:40 A different case.** Triage "Question: how do I change my desktop background?" and show **Lowest** with the reason "Request or question, not an incident". It isn't just marking everything urgent.

**2:40–3:10 Security ticket.** Triage the phishing ticket and show **High**, category **Security**, and the owner who handled past phishing tickets.

**3:10–3:30 MCP.** Show the admin toggle that exposes the tools, then an external MCP client (for example Claude) calling `suggest-triage` on a ticket.
"Same tools, same permissions, inside Jira or from any MCP client."

**Close.** "Triage Lens: triage in one step, with evidence your team already has."
