// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

import { defaultIcons, type IconRegistry } from "../../icons/src/index.ts";
import { validateBentoFlowSpec, type BentoFlowSpec } from "../../schema/src/index.ts";
import { computeBentoLayout, type PositionedCard, type PositionedLayout } from "./layout.ts";
import { BENTO_PALETTES, DESIGN_TOKENS } from "./palettes.ts";
import { inspectAndUntangle, routeEdgesOnLayout, type RoutedEdge, type SpatialReport } from "./router.ts";
import { measureTextPx } from "./textMeasure.ts";

export interface CompiledDiagram {
  spec: BentoFlowSpec;
  layout: PositionedLayout;
  edges: RoutedEdge[];
  report: SpatialReport;
  svgXml: string;
  innerSvgBody: string;
}

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeHexColor(rawColor: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor.toLowerCase() : "#1a73e8";
}

function renderCardShapeSvg(c: PositionedCard): string {
  const { width: w, height: h, shape } = c;
  const baseAttr = `fill="${DESIGN_TOKENS.cardFill}" stroke="${DESIGN_TOKENS.cardStroke}" stroke-width="1" filter="url(#bf-card-shadow)" class="bf-card-surface"`;
  if (shape === "pill") {
    return `<rect width="${w}" height="${h}" rx="${Math.round(h / 2)}" ${baseAttr}/>`;
  }
  if (shape === "hexagon") {
    const k = 12;
    return `<polygon points="${k},0 ${w - k},0 ${w},${h / 2} ${w - k},${h} ${k},${h} 0,${h / 2}" ${baseAttr}/>`;
  }
  if (shape === "cylinder") {
    return `<rect y="4" width="${w}" height="${h - 4}" rx="8" ${baseAttr}/><ellipse cx="${w / 2}" cy="6" rx="${w / 2 - 2}" ry="4.5" fill="#f8fafc" stroke="${DESIGN_TOKENS.cardStroke}" stroke-width="1"/>`;
  }
  return `<rect width="${w}" height="${h}" rx="8" ${baseAttr}/>`;
}

export function compileBentoFlow(rawSpec: BentoFlowSpec, icons: IconRegistry = defaultIcons): CompiledDiagram {
  const validation = validateBentoFlowSpec(rawSpec);
  if (!validation.valid) {
    throw new Error(`Invalid BentoFlowSpec:\n  - ${validation.errors.join("\n  - ")}`);
  }

  const initialLayout = computeBentoLayout(rawSpec);
  const { spec, untangledAnchors, reorderedCards } = inspectAndUntangle(rawSpec, initialLayout);
  const layout = untangledAnchors > 0 || reorderedCards > 0 ? computeBentoLayout(spec) : initialLayout;
  const { edges, report } = routeEdgesOnLayout(spec, layout);
  report.untangledAnchors = untangledAnchors;
  report.reorderedCards = reorderedCards;

  // Collect unique edge colors for matching SVG arrowhead markers
  const uniqueColors = Array.from(new Set(edges.map((e) => normalizeHexColor(e.color))));
  const colorId = (hex: string) => normalizeHexColor(hex).replace(/[^0-9a-f]/g, "");

  const defsParts: string[] = [
    `<defs>`,
    `  <filter id="bf-card-shadow" x="-8%" y="-8%" width="116%" height="128%">`,
    `    <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.065"/>`,
    `  </filter>`,
    `  <filter id="bf-packet-glow" x="-40%" y="-40%" width="180%" height="180%">`,
    `    <feDropShadow dx="0" dy="2" stdDeviation="3.5" flood-color="#1d4ed8" flood-opacity="0.38"/>`,
    `  </filter>`,
  ];
  for (const col of uniqueColors) {
    const cid = escXml(colorId(col));
    defsParts.push(
      `  <marker id="bf-arr-${cid}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">` +
      `<path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill="${escXml(col)}"/></marker>`
    );
  }
  defsParts.push(`</defs>`);

  const bodyParts: string[] = [...defsParts];

  // 1. Background & Outer Root Frame
  bodyParts.push(`<rect width="${layout.width}" height="${layout.height}" fill="#ffffff"/>`);
  if (layout.outerFrame) {
    const of = layout.outerFrame;
    bodyParts.push(
      `<g class="bf-outer-frame">`,
      `  <rect x="${of.x}" y="${of.y}" width="${of.width}" height="${of.height}" rx="16" fill="${DESIGN_TOKENS.outerFrameFill}" stroke="${DESIGN_TOKENS.outerFrameStroke}" stroke-width="1.5"/>`,
      `  <text x="${of.x + 24}" y="${of.y + 32}" font-size="19" font-weight="700" fill="${DESIGN_TOKENS.titleColor}">${escXml(of.title)}</text>`,
      of.subtitle
        ? `  <text x="${of.x + 24}" y="${of.y + 50}" font-size="12.5" font-weight="400" fill="${DESIGN_TOKENS.subtitleColor}">${escXml(of.subtitle)}</text>`
        : "",
      of.footerNote
        ? `  <text x="${of.x + of.width / 2}" y="${of.y + of.height - 16}" text-anchor="middle" font-size="12.5" font-weight="500" fill="#475569">${escXml(of.footerNote)}</text>`
        : "",
      `</g>`
    );
  }

  // 2. Primary Zones (Rectangular or L-Polyomino)
  for (const z of layout.zones) {
    const pal = BENTO_PALETTES[z.palette];
    const shapeXml = z.isPolyomino && z.contourPathD
      ? `<path d="${z.contourPathD}" fill="${pal.zoneFill}" stroke="${pal.zoneStroke}" stroke-width="1.5"/>`
      : `<rect x="${z.x}" y="${z.y}" width="${z.width}" height="${z.height}" rx="12" fill="${pal.zoneFill}" stroke="${pal.zoneStroke}" stroke-width="1.5"/>`;
    bodyParts.push(
      `<g class="bf-zone" data-zone-id="${escXml(z.id)}">`,
      `  ${shapeXml}`,
      `  <text x="${z.titleX}" y="${z.titleY}" font-size="14.5" font-weight="700" fill="${DESIGN_TOKENS.titleColor}">${escXml(z.title)}</text>`,
      z.subtitle
        ? `  <text x="${z.titleX}" y="${z.titleY + 16}" font-size="11.5" fill="${DESIGN_TOKENS.subtitleColor}">${escXml(z.subtitle)}</text>`
        : "",
      `</g>`
    );
  }

  // 3. Tinted Sub-Zones
  for (const sz of layout.subZones) {
    const pal = BENTO_PALETTES[sz.palette];
    const dashAttr = sz.dashed ? ` stroke-dasharray="5 4"` : "";
    bodyParts.push(
      `<g class="bf-subzone" data-subzone-id="${escXml(sz.id)}">`,
      `  <rect x="${sz.x}" y="${sz.y}" width="${sz.width}" height="${sz.height}" rx="10" fill="${pal.subZoneFill}" stroke="${pal.subZoneStroke}" stroke-width="1"${dashAttr}/>`,
      `  <text x="${sz.x + 12}" y="${sz.y + 21}" font-size="12.5" font-weight="600" fill="${DESIGN_TOKENS.titleColor}">${escXml(sz.title)}</text>`,
      `</g>`
    );
  }

  // 4. Elevated Service Cards (`renderOrder: nodes-first`)
  for (const c of layout.cards) {
    const pal = BENTO_PALETTES[c.palette];
    const iconEntry = icons.resolve(c.icon);
    const hasSub = Boolean(c.subtitle);
    const titleXml = c.titleLines.length === 1
      ? `<text x="50" y="${hasSub ? 25.5 : 33.5}" font-size="13.5" font-weight="600" fill="${DESIGN_TOKENS.titleColor}">${escXml(c.titleLines[0])}</text>`
      : `<text x="50" y="24" font-size="13" font-weight="600" fill="${DESIGN_TOKENS.titleColor}">${escXml(c.titleLines[0])}</text>` +
        `<text x="50" y="40" font-size="13" font-weight="600" fill="${DESIGN_TOKENS.titleColor}">${escXml(c.titleLines[1])}</text>`;
    const subXml = hasSub
      ? `<text x="50" y="${c.titleLines.length > 1 ? 55 : 42.5}" font-size="11" fill="${DESIGN_TOKENS.subtitleColor}">${escXml(c.subtitle!)}</text>`
      : "";
    let badgeXml = "";
    if (c.badge) {
      const bw = measureTextPx(c.badge, 9.5, true) + 12;
      const bx = c.width - bw - 7;
      badgeXml =
        `<rect x="${bx}" y="6" width="${bw}" height="15" rx="7.5" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>` +
        `<text x="${bx + bw / 2}" y="16.5" text-anchor="middle" font-size="9.5" font-weight="600" fill="#1d4ed8">${escXml(c.badge)}</text>`;
    }

    bodyParts.push(
      `<g class="bf-card" data-card-id="${escXml(c.id)}" data-accent="${pal.accent}" transform="translate(${c.x}, ${c.y})">`,
      `  ${renderCardShapeSvg(c)}`,
      `  <rect class="bf-card-ring" x="-2" y="-2" width="${c.width + 4}" height="${c.height + 4}" rx="10" fill="none" stroke="${pal.accent}" stroke-width="2.5" opacity="0"/>`,
      `  <rect x="10" y="${Math.round((c.height - 32) / 2)}" width="32" height="32" rx="7" fill="${pal.iconWellFill}" stroke="${pal.zoneStroke}" stroke-width="0.75"/>`,
      `  <svg x="16" y="${Math.round((c.height - 20) / 2)}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${pal.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconEntry.svgBody}</svg>`,
      `  ${titleXml}`,
      `  ${subXml}`,
      `  ${badgeXml}`,
      `</g>`
    );
  }

  // 5. Orthogonal Connectors, Sequence Badges & Pill Labels
  for (const e of edges) {
    const safeEdgeColor = normalizeHexColor(e.color);
    const cid = escXml(colorId(safeEdgeColor));
    const dash = e.style === "dashed" ? ` stroke-dasharray="6 4"` : "";
    const mStart = e.style === "bidirectional" ? ` marker-start="url(#bf-arr-${cid})"` : "";
    const mEnd = ` marker-end="url(#bf-arr-${cid})"`;

    let badgeXml = "";
    if (e.sequenceBadge) {
      badgeXml =
        `<circle cx="${e.sequenceBadge.x.toFixed(1)}" cy="${e.sequenceBadge.y.toFixed(1)}" r="9.5" fill="${escXml(safeEdgeColor)}" stroke="#ffffff" stroke-width="1.5"/>` +
        `<text x="${e.sequenceBadge.x.toFixed(1)}" y="${(e.sequenceBadge.y + 3.5).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#ffffff">${escXml(e.sequenceBadge.text)}</text>`;
    }

    let lblXml = "";
    if (e.labelBox && (e.label || e.payload)) {
      const lb = e.labelBox;
      lblXml = `<rect x="${lb.x}" y="${lb.y}" width="${lb.width}" height="${lb.height}" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>`;
      let textCenterX = lb.x + lb.width / 2;
      if (e.badgeText) {
        const bx = lb.x + 10.5;
        const by = lb.y + (e.label && e.payload ? 10.5 : lb.height / 2);
        lblXml +=
          `<circle cx="${bx}" cy="${by}" r="7.5" fill="${escXml(safeEdgeColor)}"/>` +
          `<text x="${bx}" y="${(by + 3.2).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#ffffff">${escXml(e.badgeText)}</text>`;
        textCenterX = lb.x + 18 + (lb.width - 22) / 2;
      }
      if (e.label && e.payload) {
        lblXml += `<text x="${textCenterX.toFixed(1)}" y="${lb.y + 13.5}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#334155">${escXml(e.label)}</text>`;
        lblXml += `<text x="${(lb.x + lb.width / 2).toFixed(1)}" y="${lb.y + 26}" text-anchor="middle" font-family='${escXml(DESIGN_TOKENS.monoFamily)}' font-size="9.5" fill="#64748b">${escXml(e.payload)}</text>`;
      } else if (e.label) {
        lblXml += `<text x="${textCenterX.toFixed(1)}" y="${lb.y + 13.8}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#334155">${escXml(e.label)}</text>`;
      } else if (e.payload) {
        lblXml += `<text x="${textCenterX.toFixed(1)}" y="${lb.y + 13.8}" text-anchor="middle" font-family='${escXml(DESIGN_TOKENS.monoFamily)}' font-size="9.5" fill="#475569">${escXml(e.payload)}</text>`;
      }
    }

    bodyParts.push(
      `<g class="bf-edge" data-edge-id="${escXml(e.id)}" data-from="${escXml(e.from)}" data-to="${escXml(e.to)}">`,
      `  <path class="bf-edge-wire" data-edge-id="${escXml(e.id)}" d="${e.pathD}" fill="none" stroke="${escXml(safeEdgeColor)}" stroke-width="2" stroke-linecap="round"${dash}${mStart}${mEnd}/>`,
      `  ${lblXml}`,
      `  ${badgeXml}`,
      `</g>`
    );
  }

  const innerSvgBody = bodyParts.filter(Boolean).join("\n");
  const svgXml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" style="font-family: ${escXml(DESIGN_TOKENS.fontFamily)}; background: #ffffff;">`,
    innerSvgBody,
    `</svg>`,
  ].join("\n");

  return { spec, layout, edges, report, svgXml, innerSvgBody };
}
