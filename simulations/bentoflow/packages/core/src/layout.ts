// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

import type { BentoFlowSpec, CardSpec, SubZoneSpec, ZonePalette, ZoneSpec } from "../../schema/src/index.ts";
import { computeCardSize, measureTextPx } from "./textMeasure.ts";

export interface PositionedCard {
  id: string;
  zoneId: string;
  palette: ZonePalette;
  x: number;
  y: number;
  width: number;
  height: number;
  titleLines: string[];
  subtitle?: string;
  icon: string;
  badge?: string;
  shape: string;
}

export interface PositionedSubZone {
  id: string;
  zoneId: string;
  palette: ZonePalette;
  title: string;
  dashed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedZone {
  id: string;
  area: string;
  title: string;
  subtitle?: string;
  palette: ZonePalette;
  x: number;
  y: number;
  width: number;
  height: number;
  isPolyomino: boolean;
  contourPathD?: string; // Populated for L-shaped polyomino zones
  titleX: number;
  titleY: number;
  headerObstacle: { id: string; x: number; y: number; width: number; height: number };
}

export interface PositionedLayout {
  width: number;
  height: number;
  outerFrame?: { x: number; y: number; width: number; height: number; title: string; subtitle?: string; footerNote?: string };
  zones: PositionedZone[];
  subZones: PositionedSubZone[];
  cards: PositionedCard[];
  headerObstacles: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  boxById: Map<string, { id: string; x: number; y: number; width: number; height: number }>;
}

const ROW_CARD_GAP = 88;
const COL_CARD_GAP = 34;
const SUBZONE_PAD = 16;
const SUBZONE_HDR = 34;
const ZONE_PAD = 22;

function buildPolyominoRoundedPath(
  cells: Array<[number, number]>,
  colX: number[],
  colW: number[],
  rowY: number[],
  rowH: number[],
  radius = 12
): { d: string; earX: number; earY: number } {
  // Build fine rectilinear grid over unique X and Y coordinates of cell union (including bridged internal gaps)
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));
  const rects: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  for (const [r, c] of cells) {
    const x0 = colX[c];
    const y0 = rowY[r];
    const x1 = cellSet.has(`${r},${c + 1}`) ? colX[c + 1] : colX[c] + colW[c];
    const y1 = cellSet.has(`${r + 1},${c}`) ? rowY[r + 1] : rowY[r] + rowH[r];
    rects.push({ x0, y0, x1, y1 });
  }
  const xs = Array.from(new Set(rects.flatMap((rc) => [rc.x0, rc.x1]))).sort((a, b) => a - b);
  const ys = Array.from(new Set(rects.flatMap((rc) => [rc.y0, rc.y1]))).sort((a, b) => a - b);
  const inside = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= xs.length - 1 || gy >= ys.length - 1) return false;
    const mx = (xs[gx] + xs[gx + 1]) / 2;
    const my = (ys[gy] + ys[gy + 1]) / 2;
    return rects.some((rc) => mx > rc.x0 && mx < rc.x1 && my > rc.y0 && my < rc.y1);
  };

  // Extract directed clockwise boundary edges (interior on right in Y-down coordinates)
  type DirEdge = { x1: number; y1: number; x2: number; y2: number };
  const edges: DirEdge[] = [];
  for (let gy = 0; gy < ys.length - 1; gy++) {
    for (let gx = 0; gx < xs.length - 1; gx++) {
      if (!inside(gx, gy)) continue;
      if (!inside(gx, gy - 1)) edges.push({ x1: xs[gx], y1: ys[gy], x2: xs[gx + 1], y2: ys[gy] }); // Top -> right
      if (!inside(gx + 1, gy)) edges.push({ x1: xs[gx + 1], y1: ys[gy], x2: xs[gx + 1], y2: ys[gy + 1] }); // Right -> down
      if (!inside(gx, gy + 1)) edges.push({ x1: xs[gx + 1], y1: ys[gy + 1], x2: xs[gx], y2: ys[gy + 1] }); // Bottom -> left
      if (!inside(gx - 1, gy)) edges.push({ x1: xs[gx], y1: ys[gy + 1], x2: xs[gx], y2: ys[gy] }); // Left -> up
    }
  }
  if (edges.length === 0) return { d: "", earX: 0, earY: 0 };

  const loop: Array<{ x: number; y: number }> = [{ x: edges[0].x1, y: edges[0].y1 }];
  let cur = edges[0];
  const used = new Set<number>([0]);
  while (used.size < edges.length) {
    const nextIdx = edges.findIndex((e, idx) => !used.has(idx) && e.x1 === cur.x2 && e.y1 === cur.y2);
    if (nextIdx === -1) break;
    used.add(nextIdx);
    const nxt = edges[nextIdx];
    const prev = loop[loop.length - 1];
    const collinear = (prev.x === cur.x2 && cur.x2 === nxt.x2) || (prev.y === cur.y2 && cur.y2 === nxt.y2);
    if (!collinear) loop.push({ x: cur.x2, y: cur.y2 });
    cur = nxt;
  }

  // Emit rounded convex (sweep=1) and concave (sweep=0) SVG arc corners
  const cmds: string[] = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const pPrev = loop[(i - 1 + n) % n];
    const pCur = loop[i];
    const pNext = loop[(i + 1) % n];
    const dx1 = pCur.x - pPrev.x, dy1 = pCur.y - pPrev.y;
    const dx2 = pNext.x - pCur.x, dy2 = pNext.y - pCur.y;
    const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2);
    const r = Math.min(radius, len1 / 2, len2 / 2);
    const ux1 = dx1 / len1, uy1 = dy1 / len1;
    const ux2 = dx2 / len2, uy2 = dy2 / len2;
    const inX = pCur.x - ux1 * r, inY = pCur.y - uy1 * r;
    const outX = pCur.x + ux2 * r, outY = pCur.y + uy2 * r;
    const cross = ux1 * uy2 - uy1 * ux2; // >0 clockwise convex in Y-down, <0 concave
    const sweep = cross > 0 ? 1 : 0;
    if (i === 0) cmds.push(`M ${inX.toFixed(1)} ${inY.toFixed(1)}`);
    else cmds.push(`L ${inX.toFixed(1)} ${inY.toFixed(1)}`);
    cmds.push(`A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${outX.toFixed(1)} ${outY.toFixed(1)}`);
  }
  cmds.push("Z");
  const topMost = [...cells].sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))[0];
  return { d: cmds.join(" "), earX: colX[topMost[1]], earY: rowY[topMost[0]] };
}

export function computeBentoLayout(spec: BentoFlowSpec): PositionedLayout {
  const grid = spec.canvas.areas.map((r) => r.trim().split(/\s+/));
  const rows = grid.length;
  const cols = grid[0].length;
  const gridGap = Math.max(28, spec.canvas.gap ?? 32);
  const rootPad = Math.max(20, spec.canvas.padding ?? 24);
  const showOuter = spec.canvas.showOuterFrame !== false;
  const outerPad = showOuter ? 16 : 0;
  const outerHdr = showOuter ? (spec.subtitle ? 58 : 44) : 0;

  // Measure intrinsic sizes of every card, subZone, and zone
  const cardIntrinsic = new Map<string, { width: number; height: number; titleLines: string[] }>();
  const measureCardList = (cards: CardSpec[], dir: "row" | "column") => {
    const sizes = cards.map((c) => {
      const s = computeCardSize(c.title, c.subtitle, c.badge);
      cardIntrinsic.set(c.id, s);
      return s;
    });
    if (sizes.length === 0) return { w: 0, h: 0 };
    if (dir === "row") {
      const maxH = Math.max(...sizes.map((s) => s.height));
      cards.forEach((c) => { cardIntrinsic.get(c.id)!.height = maxH; });
      return { w: sizes.reduce((a, s) => a + s.width, 0) + (sizes.length - 1) * ROW_CARD_GAP, h: maxH };
    }
    const maxW = Math.max(...sizes.map((s) => s.width));
    cards.forEach((c) => { cardIntrinsic.get(c.id)!.width = maxW; });
    return { w: maxW, h: sizes.reduce((a, s) => a + s.height, 0) + (sizes.length - 1) * COL_CARD_GAP };
  };

  const subZoneMin = new Map<string, { w: number; h: number }>();
  const zoneMin = new Map<string, { w: number; h: number; hdrH: number; hdrW: number }>();

  for (const z of spec.zones) {
    const zDir = z.layout ?? "column";
    const hdrH = z.subtitle ? 54 : 40;
    const headerTextW = Math.max(measureTextPx(z.title, 15, true), z.subtitle ? measureTextPx(z.subtitle, 11.5, false) : 0) + 28;
    const blocks: Array<{ w: number; h: number }> = [];

    if ((z.cards?.length ?? 0) > 0) {
      blocks.push(measureCardList(z.cards!, zDir));
    }
    for (const sz of z.subZones ?? []) {
      const szDir = sz.layout ?? "row";
      const inner = measureCardList(sz.cards, szDir);
      const szTitleW = measureTextPx(sz.title, 13, true) + 28;
      const w = Math.max(szTitleW, inner.w + 2 * SUBZONE_PAD);
      const h = SUBZONE_HDR + inner.h + SUBZONE_PAD;
      subZoneMin.set(sz.id, { w, h });
      blocks.push({ w, h });
    }
    const contentW = blocks.length === 0 ? 180 : zDir === "row"
      ? blocks.reduce((a, b) => a + b.w, 0) + (blocks.length - 1) * ROW_CARD_GAP
      : Math.max(...blocks.map((b) => b.w));
    const contentH = blocks.length === 0 ? 60 : zDir === "column"
      ? blocks.reduce((a, b) => a + b.h, 0) + (blocks.length - 1) * 24
      : Math.max(...blocks.map((b) => b.h));

    zoneMin.set(z.id, {
      w: Math.max(headerTextW + 16, contentW + 2 * ZONE_PAD),
      h: hdrH + contentH + ZONE_PAD,
      hdrH,
      hdrW: headerTextW,
    });
  }

  // Solve matrix column widths and row heights
  const cellsByArea = new Map<string, Array<[number, number]>>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const list = cellsByArea.get(grid[r][c]) ?? [];
      list.push([r, c]);
      cellsByArea.set(grid[r][c], list);
    }
  }

  const colW = new Array<number>(cols).fill(200);
  const rowH = new Array<number>(rows).fill(140);

  const spans = spec.zones.map((z) => {
    const cells = cellsByArea.get(z.area)!;
    const rs = cells.map(([r]) => r), cs = cells.map(([, c]) => c);
    return {
      z,
      cells,
      r0: Math.min(...rs), r1: Math.max(...rs),
      c0: Math.min(...cs), c1: Math.max(...cs),
    };
  });

  // Pass 3a: single-track constraints first
  for (const sp of spans) {
    const zm = zoneMin.get(sp.z.id)!;
    if (sp.c0 === sp.c1) colW[sp.c0] = Math.max(colW[sp.c0], zm.w);
    if (sp.r0 === sp.r1) rowH[sp.r0] = Math.max(rowH[sp.r0], zm.h);
  }
  // Pass 3b: multi-track deficit distribution
  for (const sp of spans) {
    const zm = zoneMin.get(sp.z.id)!;
    if (sp.c1 > sp.c0) {
      const spanCols = sp.c1 - sp.c0 + 1;
      const curW = colW.slice(sp.c0, sp.c1 + 1).reduce((a, b) => a + b, 0) + (spanCols - 1) * gridGap;
      if (curW < zm.w) {
        const add = Math.ceil((zm.w - curW) / spanCols);
        for (let c = sp.c0; c <= sp.c1; c++) colW[c] += add;
      }
    }
    if (sp.r1 > sp.r0) {
      const spanRows = sp.r1 - sp.r0 + 1;
      const curH = rowH.slice(sp.r0, sp.r1 + 1).reduce((a, b) => a + b, 0) + (spanRows - 1) * gridGap;
      if (curH < zm.h) {
        const add = Math.ceil((zm.h - curH) / spanRows);
        for (let r = sp.r0; r <= sp.r1; r++) rowH[r] += add;
      }
    }
  }

  const colX: number[] = [];
  let cx = outerPad + rootPad;
  for (let c = 0; c < cols; c++) {
    colX.push(cx);
    cx += colW[c] + gridGap;
  }
  const rowY: number[] = [];
  let cy = outerPad + outerHdr + rootPad;
  for (let r = 0; r < rows; r++) {
    rowY.push(cy);
    cy += rowH[r] + gridGap;
  }

  const footerExtra = showOuter && spec.footerNote ? 28 : 0;
  const innerW = colW.reduce((a, b) => a + b, 0) + (cols - 1) * gridGap + 2 * rootPad;
  const innerH = outerHdr + rowH.reduce((a, b) => a + b, 0) + (rows - 1) * gridGap + 2 * rootPad + footerExtra;
  const totalW = innerW + 2 * outerPad;
  const totalH = innerH + 2 * outerPad;

  const positionedZones: PositionedZone[] = [];
  const positionedSubZones: PositionedSubZone[] = [];
  const positionedCards: PositionedCard[] = [];
  const headerObstacles: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
  const boxById = new Map<string, { id: string; x: number; y: number; width: number; height: number }>();

  for (const sp of spans) {
    const z = sp.z;
    const zm = zoneMin.get(z.id)!;
    const palette: ZonePalette = z.palette ?? "blue";
    const zx = colX[sp.c0];
    const zy = rowY[sp.r0];
    const zw = colX[sp.c1] + colW[sp.c1] - zx;
    const zh = rowY[sp.r1] + rowH[sp.r1] - zy;
    const rectAreaCount = (sp.r1 - sp.r0 + 1) * (sp.c1 - sp.c0 + 1);
    const isPolyomino = sp.cells.length < rectAreaCount;
    const poly = isPolyomino ? buildPolyominoRoundedPath(sp.cells, colX, colW, rowY, rowH, 12) : null;
    const titleX = (poly ? poly.earX : zx) + 16;
    const titleY = (poly ? poly.earY : zy) + 25;
    const hdrObs = {
      id: `hdr_${z.id}`,
      x: titleX - 4,
      y: (poly ? poly.earY : zy) + 6,
      width: zm.hdrW,
      height: zm.hdrH - 10,
    };
    headerObstacles.push(hdrObs);

    positionedZones.push({
      id: z.id,
      area: z.area,
      title: z.title,
      subtitle: z.subtitle,
      palette,
      x: zx,
      y: zy,
      width: zw,
      height: zh,
      isPolyomino,
      contourPathD: poly?.d,
      titleX,
      titleY,
      headerObstacle: hdrObs,
    });
    boxById.set(z.id, { id: z.id, x: zx, y: zy, width: zw, height: zh });

    // Place children centered inside the zone's primary largest sub-rectangle
    let bodyX = zx + ZONE_PAD;
    let bodyY = zy + zm.hdrH;
    let bodyW = zw - 2 * ZONE_PAD;
    let bodyH = zh - zm.hdrH - ZONE_PAD;
    if (isPolyomino) {
      const bottomRowFull = Array.from({ length: sp.c1 - sp.c0 + 1 }, (_, k) => `${sp.r1},${sp.c0 + k}`)
        .every((k) => sp.cells.some(([r, c]) => `${r},${c}` === k));
      if (bottomRowFull) {
        bodyX = colX[sp.c0] + ZONE_PAD;
        bodyY = rowY[sp.r1] + 20;
        bodyW = zw - 2 * ZONE_PAD;
        bodyH = rowH[sp.r1] - 40;
      } else {
        bodyX = colX[sp.c1] + ZONE_PAD;
        bodyW = colW[sp.c1] - 2 * ZONE_PAD;
      }
    }

    const zDir = z.layout ?? "column";
    const items: Array<{ kind: "cards"; cards: CardSpec[]; w: number; h: number } | { kind: "subzone"; sz: SubZoneSpec; w: number; h: number }> = [];
    if ((z.cards?.length ?? 0) > 0) {
      const dims = zDir === "row"
        ? { w: z.cards!.reduce((a, c) => a + cardIntrinsic.get(c.id)!.width, 0) + (z.cards!.length - 1) * ROW_CARD_GAP, h: cardIntrinsic.get(z.cards![0].id)!.height }
        : { w: cardIntrinsic.get(z.cards![0].id)!.width, h: z.cards!.reduce((a, c) => a + cardIntrinsic.get(c.id)!.height, 0) + (z.cards!.length - 1) * COL_CARD_GAP };
      items.push({ kind: "cards", cards: z.cards!, ...dims });
    }
    for (const sz of z.subZones ?? []) {
      const sm = subZoneMin.get(sz.id)!;
      items.push({ kind: "subzone", sz, w: zDir === "column" ? Math.max(sm.w, bodyW) : sm.w, h: sm.h });
    }

    const totalItemsW = zDir === "row" ? items.reduce((a, it) => a + it.w, 0) + Math.max(0, items.length - 1) * ROW_CARD_GAP : Math.max(0, ...items.map((it) => it.w));
    const totalItemsH = zDir === "column" ? items.reduce((a, it) => a + it.h, 0) + Math.max(0, items.length - 1) * 24 : Math.max(0, ...items.map((it) => it.h));

    let curX = bodyX + Math.max(0, Math.round((bodyW - totalItemsW) / 2));
    let curY = bodyY + Math.max(0, Math.round((bodyH - totalItemsH) / 2));

    const placeCards = (cards: CardSpec[], dir: "row" | "column", startX: number, startY: number, availW: number, availH: number) => {
      const stepGap = dir === "row" ? ROW_CARD_GAP : COL_CARD_GAP;
      const listW = dir === "row" ? cards.reduce((a, c) => a + cardIntrinsic.get(c.id)!.width, 0) + (cards.length - 1) * stepGap : cardIntrinsic.get(cards[0].id)!.width;
      const listH = dir === "column" ? cards.reduce((a, c) => a + cardIntrinsic.get(c.id)!.height, 0) + (cards.length - 1) * stepGap : cardIntrinsic.get(cards[0].id)!.height;
      let px = startX + Math.max(0, Math.round((availW - listW) / 2));
      let py = startY + Math.max(0, Math.round((availH - listH) / 2));
      for (const c of cards) {
        const ci = cardIntrinsic.get(c.id)!;
        positionedCards.push({
          id: c.id,
          zoneId: z.id,
          palette,
          x: px,
          y: py,
          width: ci.width,
          height: ci.height,
          titleLines: ci.titleLines,
          subtitle: c.subtitle,
          icon: c.icon ?? "Server",
          badge: c.badge,
          shape: c.shape ?? "rectangle",
        });
        boxById.set(c.id, { id: c.id, x: px, y: py, width: ci.width, height: ci.height });
        if (dir === "row") px += ci.width + stepGap;
        else py += ci.height + stepGap;
      }
    };

    for (const it of items) {
      if (it.kind === "cards") {
        placeCards(it.cards, zDir, curX, curY, zDir === "column" ? totalItemsW : it.w, zDir === "row" ? totalItemsH : it.h);
      } else {
        const szX = zDir === "column" ? bodyX + Math.max(0, Math.round((bodyW - it.w) / 2)) : curX;
        const szY = zDir === "row" ? bodyY + Math.max(0, Math.round((bodyH - it.h) / 2)) : curY;
        headerObstacles.push({
          id: `hdr_${it.sz.id}`,
          x: szX + 8,
          y: szY + 4,
          width: measureTextPx(it.sz.title, 13, true) + 16,
          height: 24,
        });
        positionedSubZones.push({
          id: it.sz.id,
          zoneId: z.id,
          palette,
          title: it.sz.title,
          dashed: Boolean(it.sz.dashed),
          x: szX,
          y: szY,
          width: it.w,
          height: it.h,
        });
        boxById.set(it.sz.id, { id: it.sz.id, x: szX, y: szY, width: it.w, height: it.h });
        placeCards(
          it.sz.cards,
          it.sz.layout ?? "row",
          szX + SUBZONE_PAD,
          szY + SUBZONE_HDR,
          it.w - 2 * SUBZONE_PAD,
          it.h - SUBZONE_HDR - SUBZONE_PAD
        );
      }
      if (zDir === "row") curX += it.w + ROW_CARD_GAP;
      else curY += it.h + 24;
    }
  }

  return {
    width: totalW,
    height: totalH,
    outerFrame: showOuter
      ? { x: outerPad, y: outerPad, width: innerW, height: innerH, title: spec.title, subtitle: spec.subtitle, footerNote: spec.footerNote }
      : undefined,
    zones: positionedZones,
    subZones: positionedSubZones,
    cards: positionedCards,
    headerObstacles,
    boxById,
  };
}
