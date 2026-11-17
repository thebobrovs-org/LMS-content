---
id: concept/oauth-2lo-vs-3lo
type: concept
status: proposed
title: "Two-legged OAuth when the agent acts as itself; three-legged when it acts on a user's data with consent"
scope: "OAuth 2.0 and OpenID Connect as applied to agent tool calls; the 2LO/3LO naming is industry shorthand for the client credentials and authorisation code grants"
sources:
  - "IETF RFC 6749, rfc-editor.org/rfc/rfc6749 (retrieved 2026-11-17: abstract on limited access on behalf of a resource owner or on the client's own behalf; 1.3.1, the resource owner's credentials are never shared with the client; 1.3.4, client credentials for resources under the client's control; 1.4, access tokens)"
  - "OpenID Connect Core 1.0 incorporating errata set 2, openid.net/specs/openid-connect-core-1_0.html (retrieved 2026-11-17: an identity layer on top of OAuth 2.0; the ID Token contains claims about the authentication of an end user)"
touches:
  - agentic-ai/agent-auth-oauth
tags: [agents, security, oauth]
terms: [oauth 2.0, openid connect]
related: [concept/agent-identity, concept/adk-auth-flow]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.3-agent-auth-oauth.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**Concept.** OAuth 2.0 authorises: a client gets an access token for limited access to protected resources. OpenID Connect authenticates: it adds an ID token with claims about the user's sign-in. For each agent tool call, decide whose authority it uses. **Two-legged** (client credentials): the agent acts as itself, on resources under its control, with no user. **Three-legged** (authorisation code with consent): the agent acts for a user, on that user's data; the user signs in only at the authorisation server, so their credentials are never shared with the client or the agent, and the token carries only the scopes the user approved.

**Why it matters for agents.** One powerful credential that reads every user's data is excessive agency; three-legged OAuth keeps the agent to what each user agreed to.
