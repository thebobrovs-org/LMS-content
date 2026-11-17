---
id: claim/gemini-enterprise-no-website-stores
type: claim
status: proposed
title: "Website data stores can't be connected to Gemini Enterprise search and assistant apps"
scope: "Gemini Enterprise, as documented in November 2026"
sources:
  - "Google Cloud, \"About apps and data stores\", docs.cloud.google.com/gemini/enterprise/docs/apps-data-stores (updated 2026-11-10, retrieved 2026-11-17: \"You can't connect website data stores to your Gemini Enterprise search and assistant apps.\")"
  - "Google Cloud, Agent Search documentation, docs.cloud.google.com/generative-ai-app-builder/docs (retrieved 2026-11-17: website data stores and domain verification for generative answers; the Discovery Engine API shared with Gemini Enterprise)"
touches:
  - agentic-ai/enterprise-data-gemini-enterprise
  - objective:agentic-ai/enterprise-data-gemini-enterprise#choose-store-type
  - item:agentic-ai/enterprise-data-gemini-enterprise#public-site
  - item:agentic-ai/enterprise-data-gemini-enterprise#product-catalogue
tags: [gemini-enterprise, retrieval, google-cloud]
related: [concept/gemini-enterprise-app-data-store]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/1.3-enterprise-data-gemini-enterprise.md"
reviewed: 2026-11-17
review-by: 2027-02-17
---

**Claim.** A Gemini Enterprise search or assistant app can't take a website data store. Website search, including domain verification for generative answers, is an Agent Search feature; to use a site's content in Gemini Enterprise, bring it in another way, such as exported documents in Cloud Storage.

**Limits.** Agent Search and Gemini Enterprise share the Discovery Engine API, so API references and older pages describe website stores alongside other store types; the restriction is stated on the Gemini Enterprise apps page. Product capabilities change often, so this record carries a short review date.
