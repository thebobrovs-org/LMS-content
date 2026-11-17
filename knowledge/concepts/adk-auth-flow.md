---
id: concept/adk-auth-flow
type: concept
status: proposed
title: "ADK pauses a tool that needs user consent, and resumes it with a token"
scope: "ADK (Python) tool authentication as documented on 2026-11-17 (adk-docs main). The Agent Identity auth manager is Preview"
sources:
  - "ADK documentation, \"Authenticating with tools\", github.com/google/adk-docs/blob/main/docs/tools-custom/authentication.md (retrieved 2026-11-17: authentication manager services recommended; AuthScheme and AuthCredential, credential types API_KEY, HTTP, OAUTH2, OPEN_ID_CONNECT, SERVICE_ACCOUNT; AuthConfig at tool and toolset level; adk_request_credential, redirect URI, auth response, token exchange and automatic retry)"
  - "ADK documentation, \"Agent Identity Auth Manager for ADK\", github.com/google/adk-docs/blob/main/docs/integrations/agent-identity.md (retrieved 2026-11-17: Google-managed credential lifecycle; Preview release)"
touches:
  - agentic-ai/agent-auth-oauth
tags: [agents, security, oauth, adk]
terms: [authconfig]
related: [concept/oauth-2lo-vs-3lo]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.3-agent-auth-oauth.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**Concept.** In ADK a tool's authentication is an **AuthScheme** (how the API expects credentials) plus an **AuthCredential** (the initial information, such as an OAuth client ID, secret and scopes), paired as an **AuthConfig**. ADK exchanges the credential for a token before the call. When a tool needs a user's consent and the session has no valid token, ADK pauses and emits an `adk_request_credential` event; the client app sends the user to the authorisation URL with its registered redirect URI, captures the callback, and returns it as the function response; ADK exchanges the code for tokens and automatically retries the tool call.

**Architecture points.** The agent never sees the user's password, only a scoped token. The client app must handle the event and the redirect. In production, ADK recommends an authentication manager service (Agent Identity's auth manager integrates with ADK, Preview at the time of writing) rather than self-managed token storage.
