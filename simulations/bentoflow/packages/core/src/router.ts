// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

import type { AnchorSide, BentoFlowSpec, EdgeSpec } from "../../schema/src/index.ts";
import type { PositionedLayout } from "./layout.ts";
import { DESIGN_TOKENS } from "./palettes.ts";
import { measureTextPx } from "./textMeasure.ts";

export interface Point { x: number; y: number; }
export interface Rect { id: string; x: number; y: number; width: number; height: number; }

export interface RoutedEdge {
  id: string;
  from: string;
  to: string;
  waypoints: Point[];
  pathD: string;
  color: string;
  style: "solid" | "dashed" | "bidirectional";
  label?: string;
  payload?: string;
  badgeText?: string; // Merged inside pill when label/payload exists
  labelBox?: { x: number; y: number; width: number; height: number };
  sequenceBadge?: { text: string; x: number; y: number }; // Standalone circle only when edge has no label
}

export interface SpatialReport {
  cardPenetrations: number;
  edgeCrossings: number;
  aspectRatio: number;
  untangledAnchors: number;
  reorderedCards: number;
  diagnostics: string[];
}

export function segmentIntersectsRect(a: Point, b: Point, r: Rect, pad = 4): boolean {
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  return maxX > r.x - pad && minX < r.x + r.width + pad && maxY > r.y - pad && minY < r.y + r.height + pad;
}

function segmentsProperlyCross(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const pHoriz = Math.abs(p1.y - p2.y) < 0.5;
  const qHoriz = Math.abs(q1.y - q2.y) < 0.5;
  if (pHoriz === qHoriz) return false;
  const h1 = pHoriz ? p1 : q1, h2 = pHoriz ? p2 : q2;
  const v1 = pHoriz ? q1 : p1, v2 = pHoriz ? q2 : p2;
  const hxMin = Math.min(h1.x, h2.x) + 1, hxMax = Math.max(h1.x, h2.x) - 1;
  const vyMin = Math.min(v1.y, v2.y) + 1, vyMax = Math.max(v1.y, v2.y) - 1;
  return v1.x > hxMin && v1.x < hxMax && h1.y > vyMin && h1.y < vyMax;
}

export function compileRoundedOrthogonalPath(waypoints: Point[], cornerRadius = 8): string {
  if (waypoints.length < 2) return "";
  const pts: Point[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = pts[pts.length - 1], cur = waypoints[i], next = waypoints[i + 1];
    const collinear = (Math.abs(prev.x - cur.x) < 0.5 && Math.abs(cur.x - next.x) < 0.5) ||
                      (Math.abs(prev.y - cur.y) < 0.5 && Math.abs(cur.y - next.y) < 0.5);
    if (!collinear) pts.push(cur);
  }
  pts.push(waypoints[waypoints.length - 1]);

  const cmds: string[] = [`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const r = Math.min(cornerRadius, d1 / 2, d2 / 2);
    if (r < 1.5) {
      cmds.push(`L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`);
      continue;
    }
    const inX = p1.x - ((p1.x - p0.x) / d1) * r;
    const inY = p1.y - ((p1.y - p0.y) / d1) * r;
    const outX = p1.x + ((p2.x - p1.x) / d2) * r;
    const outY = p1.y + ((p2.y - p1.y) / d2) * r;
    cmds.push(`L ${inX.toFixed(1)} ${inY.toFixed(1)} Q ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ${outX.toFixed(1)} ${outY.toFixed(1)}`);
  }
  const last = pts[pts.length - 1];
  cmds.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return cmds.join(" ");
}

function portCoord(box: Rect, side: AnchorSide, offset: number): { port: Point; stub: Point } {
  const STUB = 14;
  if (side === "right") {
    const y = Math.max(box.y + 12, Math.min(box.y + box.height - 12, box.y + box.height / 2 + offset));
    return { port: { x: box.x + box.width, y }, stub: { x: box.x + box.width + STUB, y } };
  }
  if (side === "left") {
    const y = Math.max(box.y + 12, Math.min(box.y + box.height - 12, box.y + box.height / 2 + offset));
    return { port: { x: box.x, y }, stub: { x: box.x - STUB, y } };
  }
  if (side === "bottom") {
    const x = Math.max(box.x + 16, Math.min(box.x + box.width - 16, box.x + box.width / 2 + offset));
    return { port: { x, y: box.y + box.height }, stub: { x, y: box.y + box.height + STUB } };
  }
  const x = Math.max(box.x + 16, Math.min(box.x + box.width - 16, box.x + box.width / 2 + offset));
  return { port: { x, y: box.y }, stub: { x, y: box.y - STUB } };
}

function routeAStarGutter(
  start: Point,
  goal: Point,
  xRails: number[],
  yRails: number[],
  obstacles: Rect[],
  priorSegments: Array<[Point, Point]>
): Point[] {
  const xs = Array.from(new Set([...xRails, start.x, goal.x])).sort((a, b) => a - b);
  const ys = Array.from(new Set([...yRails, start.y, goal.y])).sort((a, b) => a - b);
  const xiStart = xs.indexOf(start.x), yiStart = ys.indexOf(start.y);
  const xiGoal = xs.indexOf(goal.x), yiGoal = ys.indexOf(goal.y);

  type StateKey = string; // "xi,yi,dir" where dir: 0=none,1=H,2=V
  const gScore = new Map<StateKey, number>();
  const parent = new Map<StateKey, StateKey>();
  const open: Array<{ key: StateKey; xi: number; yi: number; dir: number; g: number; f: number }> = [];

  const h = (xi: number, yi: number) => Math.abs(xs[xi] - goal.x) + Math.abs(ys[yi] - goal.y);
  const initKey = `${xiStart},${yiStart},0`;
  gScore.set(initKey, 0);
  open.push({ key: initKey, xi: xiStart, yi: yiStart, dir: 0, g: 0, f: h(xiStart, yiStart) });

  let bestGoalKey: StateKey | null = null;
  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    if (cur.xi === xiGoal && cur.yi === yiGoal) {
      bestGoalKey = cur.key;
      break;
    }
    if (cur.g > (gScore.get(cur.key) ?? Infinity)) continue;

    const pCur = { x: xs[cur.xi], y: ys[cur.yi] };
    const neighbors: Array<[number, number, number]> = [
      [cur.xi + 1, cur.yi, 1],
      [cur.xi - 1, cur.yi, 1],
      [cur.xi, cur.yi + 1, 2],
      [cur.xi, cur.yi - 1, 2],
    ];
    for (const [nxi, nyi, ndir] of neighbors) {
      if (nxi < 0 || nyi < 0 || nxi >= xs.length || nyi >= ys.length) continue;
      const pNext = { x: xs[nxi], y: ys[nyi] };
      const dist = Math.abs(pNext.x - pCur.x) + Math.abs(pNext.y - pCur.y);
      const turnPenalty = cur.dir !== 0 && cur.dir !== ndir ? 28 : 0;
      const hitObstacle = obstacles.some((ob) => segmentIntersectsRect(pCur, pNext, ob, 5));
      const crossCount = priorSegments.filter(([s1, s2]) => segmentsProperlyCross(pCur, pNext, s1, s2)).length;
      const tentativeG = cur.g + dist + turnPenalty + (hitObstacle ? 12000 : 0) + crossCount * 90;
      const nKey = `${nxi},${nyi},${ndir}`;
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentativeG);
        parent.set(nKey, cur.key);
        open.push({ key: nKey, xi: nxi, yi: nyi, dir: ndir, g: tentativeG, f: tentativeG + h(nxi, nyi) });
      }
    }
  }

  if (!bestGoalKey) return [start, { x: goal.x, y: start.y }, goal];
  const rev: Point[] = [];
  let k: StateKey | undefined = bestGoalKey;
  while (k) {
    const [sxi, syi] = k.split(",").map(Number);
    rev.push({ x: xs[sxi], y: ys[syi] });
    k = parent.get(k);
  }
  return rev.reverse();
}

function pointAtArcFraction(waypoints: Point[], frac: number): Point {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += Math.hypot(waypoints[i + 1].x - waypoints[i].x, waypoints[i + 1].y - waypoints[i].y);
  }
  let target = total * frac;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg = Math.hypot(waypoints[i + 1].x - waypoints[i].x, waypoints[i + 1].y - waypoints[i].y);
    if (target <= seg && seg > 0) {
      const t = target / seg;
      return { x: waypoints[i].x + (waypoints[i + 1].x - waypoints[i].x) * t, y: waypoints[i].y + (waypoints[i + 1].y - waypoints[i].y) * t };
    }
    target -= seg;
  }
  return waypoints[waypoints.length - 1];
}

export function inspectAndUntangle(spec: BentoFlowSpec, initialLayout: PositionedLayout): { spec: BentoFlowSpec; untangledAnchors: number; reorderedCards: number } {
  const cloned: BentoFlowSpec = structuredClone(spec);
  let reorderedCards = 0;

  // 1. Reorder cards in horizontal rows to match mean X of upstream vertical callers
  for (const z of cloned.zones) {
    if ((z.layout ?? "column") === "row" && (z.cards?.length ?? 0) > 1) {
      const incomingMeanX = (cardId: string): number | null => {
        const callers = cloned.edges.filter((e) => e.to === cardId && e.targetAnchor === "top")
          .map((e) => initialLayout.boxById.get(e.from))
          .filter((b): b is Rect => Boolean(b));
        if (callers.length === 0) return null;
        return callers.reduce((s, b) => s + b.x + b.width / 2, 0) / callers.length;
      };
      const before = z.cards!.map((c) => c.id).join(",");
      z.cards!.sort((a, b) => {
        const xa = incomingMeanX(a.id), xb = incomingMeanX(b.id);
        if (xa === null || xb === null) return 0;
        return xa - xb;
      });
      if (z.cards!.map((c) => c.id).join(",") !== before) reorderedCards++;
    }
  }

  // 2. Snap suboptimal anchors when vertically aligned cards used right->left C-loops
  let untangledAnchors = 0;
  for (const e of cloned.edges) {
    const src = initialLayout.boxById.get(e.from);
    const dst = initialLayout.boxById.get(e.to);
    if (!src || !dst) continue;
    const dx = (dst.x + dst.width / 2) - (src.x + src.width / 2);
    const dy = (dst.y + dst.height / 2) - (src.y + src.height / 2);
    if (Math.abs(dx) < 36 && Math.abs(dy) > 48 && (e.sourceAnchor === "right" || e.sourceAnchor === "left")) {
      e.sourceAnchor = dy > 0 ? "bottom" : "top";
      e.targetAnchor = dy > 0 ? "top" : "bottom";
      untangledAnchors++;
    }
  }

  return { spec: cloned, untangledAnchors, reorderedCards };
}

export function routeEdgesOnLayout(spec: BentoFlowSpec, layout: PositionedLayout): { edges: RoutedEdge[]; report: SpatialReport } {
  // 1. Monotonic port distribution per (nodeId, side)
  type PortRef = { edgeIdx: number; isSource: boolean; otherCenter: Point };
  const portGroups = new Map<string, PortRef[]>();
  spec.edges.forEach((e, idx) => {
    const sb = layout.boxById.get(e.from)!, tb = layout.boxById.get(e.to)!;
    const tc = { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 };
    const sc = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 };
    const sk = `${e.from}:${e.sourceAnchor}`, tk = `${e.to}:${e.targetAnchor}`;
    portGroups.set(sk, [...(portGroups.get(sk) ?? []), { edgeIdx: idx, isSource: true, otherCenter: tc }]);
    portGroups.set(tk, [...(portGroups.get(tk) ?? []), { edgeIdx: idx, isSource: false, otherCenter: sc }]);
  });

  const srcOffsets = new Array<number>(spec.edges.length).fill(0);
  const dstOffsets = new Array<number>(spec.edges.length).fill(0);
  for (const [key, refs] of portGroups.entries()) {
    const side = key.split(":")[1] as AnchorSide;
    refs.sort((a, b) => (side === "left" || side === "right" ? a.otherCenter.y - b.otherCenter.y : a.otherCenter.x - b.otherCenter.x));
    refs.forEach((ref, i) => {
      const off = Math.round((i - (refs.length - 1) / 2) * 13);
      if (ref.isSource) srcOffsets[ref.edgeIdx] = off;
      else dstOffsets[ref.edgeIdx] = off;
    });
  }

  // 2. Build Hanan + gutter rail grid
  const xRails: number[] = [16, layout.width - 16];
  const yRails: number[] = [16, layout.height - 16];
  for (const z of layout.zones) {
    xRails.push(z.x - 14, z.x + z.width + 14);
    yRails.push(z.y - 14, z.y + z.height + 14);
  }
  for (const sz of layout.subZones) {
    xRails.push(sz.x - 10, sz.x + sz.width + 10);
    yRails.push(sz.y - 10, sz.y + sz.height + 10);
  }
  for (const c of layout.cards) {
    xRails.push(c.x - 13, c.x + c.width / 2, c.x + c.width + 13);
    yRails.push(c.y - 13, c.y + c.height / 2, c.y + c.height + 13);
  }

  const cardObstacles: Rect[] = layout.cards.map((c) => ({ id: c.id, x: c.x, y: c.y, width: c.width, height: c.height }));
  const routingObstacles: Rect[] = [...cardObstacles, ...layout.headerObstacles];
  const priorSegments: Array<[Point, Point]> = [];
  const rawWaypoints: Point[][] = [];

  const cardZoneMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const c of layout.cards) {
    const zb = layout.boxById.get(c.zoneId);
    if (zb) cardZoneMap.set(c.id, zb);
  }

  spec.edges.forEach((e, idx) => {
    const sb = layout.boxById.get(e.from)!, tb = layout.boxById.get(e.to)!;
    const sPort = portCoord(sb, e.sourceAnchor, srcOffsets[idx]);
    const tPort = portCoord(tb, e.targetAnchor, dstOffsets[idx]);
    const sz = cardZoneMap.get(e.from), tz = cardZoneMap.get(e.to);
    if (sz && tz && sz !== tz && e.sourceAnchor === "bottom" && tz.y > sz.y + sz.height) {
      sPort.stub = { x: sPort.port.x, y: sz.y + sz.height + 12 };
    }
    const activeObstacles = routingObstacles.filter((ob) => ob.id !== e.from && ob.id !== e.to);
    const coreRoute = routeAStarGutter(sPort.stub, tPort.stub, xRails, yRails, activeObstacles, priorSegments);
    const full = [sPort.port, ...coreRoute, tPort.port];
    rawWaypoints.push(full);
    for (let i = 1; i < full.length - 2; i++) {
      priorSegments.push([full[i], full[i + 1]]);
    }
  });

  // 3. Parallel collinear gutter segment lane nudging (9px separation)
  type SegRef = { eIdx: number; sIdx: number; horiz: boolean; coord: number; minSpan: number; maxSpan: number };
  const innerSegs: SegRef[] = [];
  rawWaypoints.forEach((pts, eIdx) => {
    for (let sIdx = 1; sIdx < pts.length - 2; sIdx++) {
      const a = pts[sIdx], b = pts[sIdx + 1];
      const horiz = Math.abs(a.y - b.y) < 0.5;
      const vert = Math.abs(a.x - b.x) < 0.5;
      if (!horiz && !vert) continue;
      innerSegs.push({
        eIdx, sIdx, horiz,
        coord: horiz ? Math.round(a.y) : Math.round(a.x),
        minSpan: horiz ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
        maxSpan: horiz ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
      });
    }
  });

  const nudged = new Set<string>();
  for (let i = 0; i < innerSegs.length; i++) {
    const sA = innerSegs[i];
    if (nudged.has(`${sA.eIdx}:${sA.sIdx}`)) continue;
    const group = innerSegs.filter((sB) =>
      sB.horiz === sA.horiz &&
      Math.abs(sB.coord - sA.coord) <= 2 &&
      Math.min(sA.maxSpan, sB.maxSpan) - Math.max(sA.minSpan, sB.minSpan) > 12
    );
    if (group.length > 1) {
      // Order lanes monotonically by the average coordinate of their adjacent stubs so lanes never twist
      group.sort((a, b) => {
        const pa = rawWaypoints[a.eIdx], pb = rawWaypoints[b.eIdx];
        const ma = a.horiz ? (pa[0].y + pa[pa.length - 1].y) / 2 : (pa[0].x + pa[pa.length - 1].x) / 2;
        const mb = b.horiz ? (pb[0].y + pb[pb.length - 1].y) / 2 : (pb[0].x + pb[pb.length - 1].x) / 2;
        return ma - mb;
      });
      group.forEach((g, rank) => {
        nudged.add(`${g.eIdx}:${g.sIdx}`);
        const delta = Math.round((rank - (group.length - 1) / 2) * 9);
        const pts = rawWaypoints[g.eIdx];
        if (g.horiz) {
          pts[g.sIdx].y += delta;
          pts[g.sIdx + 1].y += delta;
        } else {
          pts[g.sIdx].x += delta;
          pts[g.sIdx + 1].x += delta;
        }
      });
    }
  }

  // 4. Compile SVG paths, collision-free label pills, sequence badges, and spatial metrics
  const placedLabelBoxes: Rect[] = [];
  let cardPenetrations = 0;
  let edgeCrossings = 0;

  const routed: RoutedEdge[] = spec.edges.map((e: EdgeSpec, idx: number) => {
    const pts = rawWaypoints[idx];
    const activeObstacles = cardObstacles.filter((ob) => ob.id !== e.from && ob.id !== e.to);
    for (let i = 0; i < pts.length - 1; i++) {
      if (activeObstacles.some((ob) => segmentIntersectsRect(pts[i], pts[i + 1], ob, 2))) {
        cardPenetrations++;
      }
    }

    let labelBox: RoutedEdge["labelBox"];
    const hasPill = Boolean(e.label || e.payload);
    if (hasPill) {
      const badgeExtraW = e.sequenceBadge ? 18 : 0;
      const l1W = (e.label ? measureTextPx(e.label, 10.5, true) : 0) + badgeExtraW;
      const l2W = e.payload ? measureTextPx(e.payload, 9.5, false) : 0;
      const pw = Math.max(l1W, l2W) + 14;
      const ph = e.label && e.payload ? 32 : 20;
      const allLabelObstacles = [...cardObstacles, ...layout.headerObstacles];
      let bestTopLeft = { x: 0, y: 0 };
      let bestScore = -Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        if (segLen < 14) continue;
        const isHoriz = Math.abs(a.y - b.y) < 0.5;
        // On tight horizontal hops (< pw + 18), also evaluate lifting pill 15px above the wire so card borders & arrowheads stay clear
        const yShifts = isHoriz && segLen < pw + 18 ? [-16, 0, 16] : [0];
        for (const t of [0.5, 0.38, 0.62]) {
          for (const dy of yShifts) {
            const cx = a.x + (b.x - a.x) * t;
            const cy = a.y + (b.y - a.y) * t + dy;
            const box: Rect = { id: `lbl_${e.id}`, x: cx - pw / 2, y: cy - ph / 2, width: pw, height: ph };
            const hitsObs = allLabelObstacles.some((ob) => segmentIntersectsRect({ x: box.x, y: box.y }, { x: box.x + pw, y: box.y + ph }, ob, 2));
            const hitsPriorLbl = placedLabelBoxes.some((lb) => segmentIntersectsRect({ x: box.x, y: box.y }, { x: box.x + pw, y: box.y + ph }, lb, 4));
            const score = segLen - Math.abs(dy) * 0.5 - (hitsObs ? 4500 : 0) - (hitsPriorLbl ? 3000 : 0);
            if (score > bestScore) {
              bestScore = score;
              bestTopLeft = { x: Math.round(box.x), y: Math.round(box.y) };
            }
          }
        }
      }
      labelBox = { x: bestTopLeft.x, y: bestTopLeft.y, width: pw, height: ph };
      placedLabelBoxes.push({ id: `lbl_${e.id}`, ...labelBox });
    }

    const seqPt = e.sequenceBadge && !hasPill ? pointAtArcFraction(pts, 0.28) : null;
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      waypoints: pts,
      pathD: compileRoundedOrthogonalPath(pts, 8),
      color: e.color ?? DESIGN_TOKENS.defaultEdgeColor,
      style: e.style ?? "solid",
      label: e.label,
      payload: e.payload,
      badgeText: hasPill ? e.sequenceBadge : undefined,
      labelBox,
      sequenceBadge: seqPt && e.sequenceBadge ? { text: e.sequenceBadge, x: seqPt.x, y: seqPt.y } : undefined,
    };
  });

  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const pa = routed[i].waypoints, pb = routed[j].waypoints;
      for (let sa = 0; sa < pa.length - 1; sa++) {
        for (let sb = 0; sb < pb.length - 1; sb++) {
          if (segmentsProperlyCross(pa[sa], pa[sa + 1], pb[sb], pb[sb + 1])) edgeCrossings++;
        }
      }
    }
  }

  const aspectRatio = Number((layout.width / layout.height).toFixed(2));
  const diagnostics: string[] = [];
  if (cardPenetrations > 0) diagnostics.push(`Detected ${cardPenetrations} edge-card penetration(s).`);
  if (edgeCrossings > 0) diagnostics.push(`Detected ${edgeCrossings} orthogonal edge crossing(s).`);
  if (aspectRatio < 1.1) diagnostics.push(`Aspect ratio ${aspectRatio}:1 is too tall for 16:9 LMS viewport.`);

  return {
    edges: routed,
    report: { cardPenetrations, edgeCrossings, aspectRatio, untangledAnchors: 0, reorderedCards: 0, diagnostics },
  };
}
