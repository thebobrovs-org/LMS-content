// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

export type ZonePalette = "blue" | "green" | "coral" | "amber" | "purple" | "teal" | "neutral";
export type AnchorSide = "top" | "bottom" | "left" | "right";
export type CardShape = "rectangle" | "pill" | "cylinder" | "hexagon" | "diamond";

export interface CardSpec {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  shape?: CardShape;
  badge?: string;
}

export interface SubZoneSpec {
  id: string;
  title: string;
  layout?: "row" | "column";
  dashed?: boolean;
  cards: CardSpec[];
}

export interface ZoneSpec {
  id: string;
  area: string;
  title: string;
  subtitle?: string;
  palette?: ZonePalette;
  layout?: "row" | "column";
  cards?: CardSpec[];
  subZones?: SubZoneSpec[];
}

export interface EdgeSpec {
  id: string;
  from: string;
  to: string;
  sourceAnchor: AnchorSide;
  targetAnchor: AnchorSide;
  label?: string;
  payload?: string;
  sequenceBadge?: string;
  style?: "solid" | "dashed" | "bidirectional";
  color?: string;
}

export interface FlowStepSpec {
  stepNumber: number;
  pillLabel?: string;
  activeEdgeIds: string[];
  sequentialEdges?: boolean;
  packetLabel: string;
  packetIcon?: string;
  reverse?: boolean;
  durationMs?: number;
  narrationTitle: string;
  narrationBody: string;
  threat?: string;
  guardrail?: string;
  mechanism?: string;
}

export interface BentoFlowSpec {
  version?: "1.0";
  title: string;
  subtitle?: string;
  footerNote?: string;
  canvas: {
    areas: string[];
    gap?: number;
    padding?: number;
    showOuterFrame?: boolean;
  };
  zones: ZoneSpec[];
  edges: EdgeSpec[];
  steps: FlowStepSpec[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: BentoFlowSpec;
}

const VALID_PALETTES = new Set<string>(["blue", "green", "coral", "amber", "purple", "teal", "neutral"]);
const VALID_ANCHORS = new Set<string>(["top", "bottom", "left", "right"]);
const VALID_SHAPES = new Set<string>(["rectangle", "pill", "cylinder", "hexagon", "diamond"]);
const VALID_EDGE_STYLES = new Set<string>(["solid", "dashed", "bidirectional"]);
const SAFE_ID_RE = /^[a-zA-Z0-9_.-]{1,64}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function validateBentoFlowSpec(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Spec must be a non-null JSON object."], warnings };
  }
  const spec = raw as BentoFlowSpec;
  if (!spec.title || typeof spec.title !== "string") errors.push("Missing top-level 'title'.");
  if (!spec.canvas || !Array.isArray(spec.canvas.areas) || spec.canvas.areas.length === 0) {
    errors.push("Missing 'canvas.areas' 2D row strings.");
    return { valid: false, errors, warnings };
  }

  const grid = spec.canvas.areas.map((row) => String(row).trim().split(/\s+/).filter(Boolean));
  const cols = grid[0]?.length ?? 0;
  if (cols === 0) errors.push("First row of 'canvas.areas' is empty.");
  const cellsByArea = new Map<string, Array<[number, number]>>();
  for (let r = 0; r < grid.length; r++) {
    if (grid[r].length !== cols) {
      errors.push(`Zero-Orphan violation: canvas.areas row ${r} has ${grid[r].length} columns, expected ${cols}.`);
    }
    for (let c = 0; c < grid[r].length; c++) {
      const slot = grid[r][c];
      if (slot === "." || slot === "_") {
        errors.push(`Zero-Orphan violation: empty slot '${slot}' at (${r}, ${c}).`);
      }
      const list = cellsByArea.get(slot) ?? [];
      list.push([r, c]);
      cellsByArea.set(slot, list);
    }
  }

  // Contiguity check (4-connected orthogonal region: rectangle or L-polyomino)
  for (const [areaName, cells] of cellsByArea.entries()) {
    const keySet = new Set(cells.map(([r, c]) => `${r},${c}`));
    const visited = new Set<string>();
    const queue: Array<[number, number]> = [cells[0]];
    visited.add(`${cells[0][0]},${cells[0][1]}`);
    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = `${cr + dr},${cc + dc}`;
        if (keySet.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push([cr + dr, cc + dc]);
        }
      }
    }
    if (visited.size !== cells.length) {
      errors.push(`Area '${areaName}' is disconnected; cells must form a contiguous orthogonal region.`);
    }
  }

  const declaredIds = new Set<string>();
  const zoneAreas = new Set<string>();
  for (const z of spec.zones ?? []) {
    if (!z.id || !SAFE_ID_RE.test(z.id)) errors.push(`Zone ID '${z.id}' must match /^[a-zA-Z0-9_.-]{1,64}$/.`);
    if (declaredIds.has(z.id)) errors.push(`Duplicate ID '${z.id}'.`);
    declaredIds.add(z.id);
    zoneAreas.add(z.area);
    if (!cellsByArea.has(z.area)) {
      errors.push(`Zone '${z.id}' references area '${z.area}' not present in canvas.areas.`);
    }
    if (z.palette && !VALID_PALETTES.has(z.palette)) {
      errors.push(`Zone '${z.id}' has invalid palette '${z.palette}'.`);
    }
    if ((z.layout ?? "column") === "column" && (z.cards?.length ?? 0) > 4) {
      warnings.push(`Zone '${z.id}' stacks ${z.cards!.length} cards vertically (>4); split into row or subZones.`);
    }
    for (const c of z.cards ?? []) {
      if (!c.id || !SAFE_ID_RE.test(c.id)) errors.push(`Card ID '${c.id}' must match /^[a-zA-Z0-9_.-]{1,64}$/.`);
      if (declaredIds.has(c.id)) errors.push(`Duplicate card ID '${c.id}'.`);
      if (c.shape && !VALID_SHAPES.has(c.shape)) errors.push(`Card '${c.id}' has invalid shape '${c.shape}'.`);
      declaredIds.add(c.id);
    }
    for (const sz of z.subZones ?? []) {
      if (!sz.id || !SAFE_ID_RE.test(sz.id)) errors.push(`SubZone ID '${sz.id}' must match /^[a-zA-Z0-9_.-]{1,64}$/.`);
      if (declaredIds.has(sz.id)) errors.push(`Duplicate subZone ID '${sz.id}'.`);
      declaredIds.add(sz.id);
      if ((sz.layout ?? "row") === "column" && sz.cards.length > 4) {
        warnings.push(`SubZone '${sz.id}' stacks ${sz.cards.length} cards vertically (>4).`);
      }
      for (const c of sz.cards) {
        if (!c.id || !SAFE_ID_RE.test(c.id)) errors.push(`Card ID '${c.id}' must match /^[a-zA-Z0-9_.-]{1,64}$/.`);
        if (declaredIds.has(c.id)) errors.push(`Duplicate card ID '${c.id}'.`);
        if (c.shape && !VALID_SHAPES.has(c.shape)) errors.push(`Card '${c.id}' has invalid shape '${c.shape}'.`);
        declaredIds.add(c.id);
      }
    }
  }
  for (const areaName of cellsByArea.keys()) {
    if (!zoneAreas.has(areaName)) {
      errors.push(`Area slot '${areaName}' in canvas.areas has no matching Zone.`);
    }
  }

  const edgeIds = new Set<string>();
  for (const e of spec.edges ?? []) {
    if (!e.id || !SAFE_ID_RE.test(e.id)) errors.push(`Edge ID '${e.id}' must match /^[a-zA-Z0-9_.-]{1,64}$/.`);
    if (edgeIds.has(e.id)) errors.push(`Duplicate edge ID '${e.id}'.`);
    edgeIds.add(e.id);
    if (!declaredIds.has(e.from)) errors.push(`Edge '${e.id}' references unknown source '${e.from}'.`);
    if (!declaredIds.has(e.to)) errors.push(`Edge '${e.id}' references unknown target '${e.to}'.`);
    if (e.from === e.to) errors.push(`Edge '${e.id}' cannot self-loop on '${e.from}'.`);
    if (!VALID_ANCHORS.has(e.sourceAnchor) || !VALID_ANCHORS.has(e.targetAnchor)) {
      errors.push(`Edge '${e.id}' has invalid sourceAnchor/targetAnchor.`);
    }
    if (e.style !== undefined && !VALID_EDGE_STYLES.has(e.style)) {
      errors.push(`Edge '${e.id}' has invalid style '${e.style}'.`);
    }
    if (e.color !== undefined && (typeof e.color !== "string" || !HEX_COLOR_RE.test(e.color))) {
      errors.push(`Edge '${e.id}' color '${String(e.color)}' must be a 6-digit hex color (#RRGGBB).`);
    }
  }

  for (const st of spec.steps ?? []) {
    if (!Array.isArray(st.activeEdgeIds) || st.activeEdgeIds.length === 0) {
      errors.push(`Step ${st.stepNumber} has empty activeEdgeIds.`);
    }
    for (const eid of st.activeEdgeIds ?? []) {
      if (!edgeIds.has(eid)) {
        errors.push(`Step ${st.stepNumber} references undeclared edge '${eid}'.`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, normalized: errors.length === 0 ? spec : undefined };
}

export const AGENT_SYSTEM_PROMPT = `You are an expert Technical Architecture & Instructional Flow Designer.
Generate a BentoFlowSpec JSON diagram that teaches a technical concept inside a 16:9 LMS viewport:
1. Tile canvas.areas with zero empty cells (e.g. ["z1 z2", "z3 z3"], ["z1 z2", "z1 z3"], or ["z1 z1 z1", "z2 z3 z3", "z4 z4 z4"]).
2. Never stack >4 cards in a vertical column; group 4-6 cards into layout: "row" or 2 subZones.
3. Keep card.title <= 20 chars, card.subtitle <= 26 chars, and edge.label <= 14 chars.
4. Wire planarly: horizontal neighbors right->left, vertical stacks bottom->top, ordered left-to-right to avoid X-crossings.
5. Author 4-8 clear pedagogical steps with learner-friendly narrationTitle and narrationBody.`;
