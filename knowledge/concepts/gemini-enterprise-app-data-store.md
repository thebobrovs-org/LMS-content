---
id: concept/gemini-enterprise-app-data-store
type: concept
status: proposed
title: "A Gemini Enterprise app searches data stores; connectors fill them; results are filtered to what each user may read"
scope: "Connecting enterprise data to Gemini Enterprise search and assistant apps, as documented in November 2026"
sources:
  - "Google Cloud, \"About apps and data stores\", docs.cloud.google.com/gemini/enterprise/docs/apps-data-stores (retrieved 2026-11-17: an app provides search results, actions and agents to end users; a data store holds one type of data; structured, unstructured and third-party data stores; blended search connects several stores to one app; unstructured data imported through BigQuery isn't supported in blended search; CMEK must match across blended stores)"
  - "Google Cloud, \"Introduction to connectors and data stores\", docs.cloud.google.com/gemini/enterprise/docs/connectors/introduction-to-connectors-and-data-stores (retrieved 2026-11-17: federated and ingestion connectors; incremental sync every three hours by default; identity sync)"
  - "Google Cloud, \"Configure access controls for custom data sources\", docs.cloud.google.com/gemini/enterprise/docs/identity (retrieved 2026-11-17: identity provider or workforce identity pool; ACL metadata on imported documents; turning on access control is a one-time step when the store is created)"
touches:
  - agentic-ai/enterprise-data-gemini-enterprise
  - objective:agentic-ai/enterprise-data-gemini-enterprise#app-store-connector
  - objective:agentic-ai/enterprise-data-gemini-enterprise#secure-retrieval
  - item:agentic-ai/enterprise-data-gemini-enterprise#one-query-many-stores
  - item:agentic-ai/enterprise-data-gemini-enterprise#leaked-document
  - item:agentic-ai/enterprise-data-gemini-enterprise#source-must-not-copy
  - item:agentic-ai/enterprise-data-gemini-enterprise#jira-before-launch
tags: [gemini-enterprise, retrieval, google-cloud]
terms: [app, data store, connector, blended search, federated connector, ingestion connector, ACL]
related: [claim/gemini-enterprise-no-website-stores, claim/agent-search-formerly-vertex-ai-search]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/1.3-enterprise-data-gemini-enterprise.md"
reviewed: 2026-11-17
review-by: 2027-02-17
---

**Concept.** Three pieces, kept apart. An **app** is what users query (search results, actions and agents). A **data store** holds the content the app searches, one type of data per store (structured, unstructured or third-party); apps and stores are many-to-many, and **blended search** connects several stores to one app so one query spans them. A **connector** brings content from a source into one or more stores, either by **ingestion** (copied and kept in sync, incrementally every three hours by default, usually with better search quality) or by **federation** (each query sent to the source live).

**Permissions.** Retrieval must never widen what a user can read. Gemini Enterprise identifies the user through the identity provider (or a workforce identity pool) and filters results with the source's access lists: connectors bring them along, and for data you import yourself you add ACL metadata to each document in a store marked as access-controlled when it is created (this can't be added later).

**Limits.** Blended search excludes unstructured data imported through BigQuery, requires matching CMEK configuration, and is rate-limited below the Plus edition. Connector permission mapping has documented gaps (for example, Jira attachments on private comments don't inherit the comment's ACLs), so a sensitive source needs testing before launch.

**Canonical terms.** app (engine in the API), data store, connector, data connector, blended search, federated search, ingestion, ACL.
