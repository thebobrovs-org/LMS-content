// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

// Built-in vendor-neutral vector icons adapted from Lucide (ISC License, https://lucide.dev)
export interface IconEntry {
  key: string;
  aliases?: string[];
  svgBody: string; // Inner 24x24 stroke/path elements
}

export interface IconPack {
  namespace: string;
  entries: IconEntry[];
}

const CORE_LUCIDE_ENTRIES: IconEntry[] = [
  { key: "Laptop", aliases: ["Browser", "Client", "SPA"], svgBody: `<rect width="18" height="12" x="3" y="4" rx="2"/><line x1="2" x2="22" y1="20" y2="20"/>` },
  { key: "Globe", aliases: ["Internet", "CDN", "Gateway", "API"], svgBody: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>` },
  { key: "ShieldCheck", aliases: ["Shield", "WAF", "Security", "Auth"], svgBody: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>` },
  { key: "Lock", aliases: ["Token", "JWT", "OAuth", "TLS"], svgBody: `<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>` },
  { key: "Key", aliases: ["PKCE", "Secret", "KMS"], svgBody: `<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>` },
  { key: "Server", aliases: ["Service", "Backend", "Compute", "CloudRun"], svgBody: `<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>` },
  { key: "Database", aliases: ["SQL", "Postgres", "Firestore", "Store", "VectorDB"], svgBody: `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>` },
  { key: "HardDrive", aliases: ["Storage", "Bucket", "Blob"], svgBody: `<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>` },
  { key: "Cpu", aliases: ["Worker", "Engine", "Runtime", "MCP"], svgBody: `<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>` },
  { key: "Sparkles", aliases: ["AI", "LLM", "Gemini", "Model"], svgBody: `<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4"/>` },
  { key: "Bot", aliases: ["Agent", "Orchestrator"], svgBody: `<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>` },
  { key: "User", aliases: ["Learner", "Student", "Actor"], svgBody: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>` },
  { key: "Layers", aliases: ["Queue", "Stream", "PubSub", "Cache"], svgBody: `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>` },
  { key: "Search", aliases: ["Retriever", "Index", "RAG"], svgBody: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>` },
  { key: "Activity", aliases: ["Telemetry", "Metrics", "Trace"], svgBody: `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>` },
  { key: "MessageSquare", aliases: ["Chat", "Prompt", "Message", "Reply"], svgBody: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` },
  { key: "Workflow", aliases: ["Router", "Pipeline"], svgBody: `<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>` },
];

export class IconRegistry {
  private packs = new Map<string, Map<string, IconEntry>>();
  private order: string[] = [];

  constructor() {
    this.registerPack({ namespace: "generic", entries: CORE_LUCIDE_ENTRIES });
  }

  registerPack(pack: IconPack): void {
    const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
    const m = new Map<string, IconEntry>();
    for (const e of pack.entries) {
      m.set(norm(e.key), e);
      for (const a of e.aliases ?? []) m.set(norm(a), e);
    }
    const ns = pack.namespace.toLowerCase();
    this.packs.set(ns, m);
    if (!this.order.includes(ns)) this.order.unshift(ns);
  }

  resolve(key?: string): IconEntry {
    const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
    if (key) {
      if (key.includes(":")) {
        const [ns, k] = key.split(":", 2);
        const hit = this.packs.get(ns.toLowerCase())?.get(norm(k));
        if (hit) return hit;
      } else {
        for (const ns of this.order) {
          const hit = this.packs.get(ns)?.get(norm(key));
          if (hit) return hit;
        }
      }
    }
    return CORE_LUCIDE_ENTRIES[5]; // Fallback: Server
  }
}

export const defaultIcons = new IconRegistry();
