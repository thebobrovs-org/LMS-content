/* flow-kit v1: copied verbatim from simulations/kit/flow-kit.js. Edit it there, never here. */
// Zones, boxes and arrows from a few lines of data, stepped one path at a time
// (skills/lms-authoring-simulations/SKILL.md, "Flow diagrams"). A sim's main.js is this block, then
// its SPEC, then `FlowKit.mount(SPEC)`. The kit lays the boxes on the grid the spec gives, draws each
// zone around its boxes, routes every arrow orthogonally around the boxes, and runs the predict card,
// the steps, the caption, the readout and the one checkpoint through the sim SDK. It draws in the sim
// kit's tokens (style.css starts with sim-kit.css, then flow-kit.css), so light and dark come free.
// Below 480 px of drawing width it lays the same boxes out again in one or two columns at full size
// instead of shrinking the laptop layout. Classic script, no imports, no network.
var FlowKit = (function () {
  "use strict";

  var NODE_H = 46, MARGIN = 12, PAD = 9, HEAD = 22, GAP_X = 20, GAP_Y = 26, CHANNEL = 18;
  var SIDE = 26, NARROW_BELOW = 480, MAX_CELL = 168, MIN_CELL = 124;
  var HUES = ["primary", "violet", "teal", "green", "red", "amber", "orange", "rose", "gold", "neutral"];

  // ---- Text measure: average glyph widths of the kit's system sans (Inter, Segoe UI, SF) --------------
  function textWidth(s, size, bold) {
    return String(s).length * size * (bold ? 0.6 : 0.54);
  }

  // ---- Spec checks (the gate runs these too) ---------------------------------------------------------
  function check(spec) {
    var out = [];
    var ids = {};
    var zones = {};
    (spec.zones || []).forEach(function (z) {
      if (zones[z.id]) out.push("zone " + z.id + " is listed twice");
      zones[z.id] = z;
      if (z.hue && HUES.indexOf(z.hue) < 0) out.push("zone " + z.id + ": no kit hue " + z.hue);
    });
    (spec.zones || []).forEach(function (z) {
      if (z.in && !zones[z.in]) out.push("zone " + z.id + " sits in an unknown zone " + z.in);
    });
    var cells = {};
    (spec.nodes || []).forEach(function (n) {
      if (ids[n.id]) out.push("node " + n.id + " is listed twice");
      ids[n.id] = n;
      if (n.zone && !zones[n.zone]) out.push("node " + n.id + " sits in an unknown zone " + n.zone);
      if (!Array.isArray(n.at) || n.at.length !== 2) out.push("node " + n.id + " needs at: [column, row]");
      else {
        var key = n.at.join(",");
        if (cells[key]) out.push("nodes " + cells[key] + " and " + n.id + " share the cell " + key);
        cells[key] = n.id;
      }
      if (n.hue && HUES.indexOf(n.hue) < 0) out.push("node " + n.id + ": no kit hue " + n.hue);
    });
    // A zone is the rectangle of cells around its boxes; a box of another zone can't sit inside it.
    (spec.zones || []).forEach(function (z) {
      var inZone = function (n) { return chainOf(spec, n.zone).indexOf(z.id) >= 0; };
      var mine = (spec.nodes || []).filter(function (n) { return Array.isArray(n.at) && inZone(n); });
      if (!mine.length) { out.push("zone " + z.id + " holds no box"); return; }
      var c0 = Math.min.apply(null, mine.map(function (n) { return n.at[0]; })), c1 = Math.max.apply(null, mine.map(function (n) { return n.at[0]; }));
      var r0 = Math.min.apply(null, mine.map(function (n) { return n.at[1]; })), r1 = Math.max.apply(null, mine.map(function (n) { return n.at[1]; }));
      (spec.nodes || []).forEach(function (n) {
        if (Array.isArray(n.at) && !inZone(n) && n.at[0] >= c0 && n.at[0] <= c1 && n.at[1] >= r0 && n.at[1] <= r1) out.push("node " + n.id + " sits inside zone " + z.id + "'s cells but isn't in it");
      });
    });
    var edges = {};
    (spec.edges || []).forEach(function (e) {
      if (edges[e.id]) out.push("edge " + e.id + " is listed twice");
      edges[e.id] = e;
      if (!ids[e.from]) out.push("edge " + e.id + " starts at an unknown node " + e.from);
      if (!ids[e.to]) out.push("edge " + e.id + " ends at an unknown node " + e.to);
    });
    (spec.steps || []).forEach(function (s, i) {
      (s.edges || []).forEach(function (id) { if (!edges[id]) out.push("step " + (i + 1) + " follows an unknown edge " + id); });
      if (s.at && !ids[s.at]) out.push("step " + (i + 1) + " stops at an unknown node " + s.at);
      if (!s.label || !s.text) out.push("step " + (i + 1) + " needs a label and a text");
    });
    if (spec.predict) {
      var opts = spec.predict.options || [];
      if (!opts.some(function (o) { return o.id === spec.predict.answer; })) out.push("the predict answer is not one of its options");
      if (!(spec.predict.revealAt >= 1 && spec.predict.revealAt <= (spec.steps || []).length)) out.push("predict.revealAt must name a step (1-based)");
    }
    if (!spec.checkpoint || !(spec.checkpoint.step >= 1 && spec.checkpoint.step <= (spec.steps || []).length)) out.push("checkpoint.step must name a step (1-based)");
    return out;
  }

  // ---- Layout ----------------------------------------------------------------------------------------
  function chainOf(spec, zoneId) {
    var byId = {};
    (spec.zones || []).forEach(function (z) { byId[z.id] = z; });
    var chain = [];
    for (var z = byId[zoneId]; z; z = byId[z.in]) chain.unshift(z.id);
    return chain;
  }

  /** The cells for the narrow layout: each group of boxes that share a zone, in reading order, in `cols` columns. */
  function reflow(spec, cols) {
    var groups = [];
    var byKey = {};
    spec.nodes.forEach(function (n) {
      var key = n.zone || "";
      if (!byKey[key]) { byKey[key] = { key: key, nodes: [] }; groups.push(byKey[key]); }
      byKey[key].nodes.push(n);
    });
    var order = function (a, b) { return a.at[1] - b.at[1] || a.at[0] - b.at[0]; };
    groups.forEach(function (g) { g.nodes.sort(order); g.first = g.nodes[0]; });
    // Keep a zone's groups together: sort by the top-level zone's first box, then by the group's first box.
    var top = function (g) {
      var c = chainOf(spec, g.key);
      var root = c[0] || "";
      var firsts = groups.filter(function (h) { return (chainOf(spec, h.key)[0] || "") === root; }).map(function (h) { return h.first; }).sort(order);
      return firsts[0];
    };
    groups.sort(function (a, b) { return order(top(a), top(b)) || order(a.first, b.first); });
    var at = {};
    var row = 0;
    groups.forEach(function (g) {
      var k = g.nodes.length === 1 ? 1 : cols;
      g.nodes.forEach(function (n, i) { at[n.id] = [i % k, row + Math.floor(i / k)]; });
      row += Math.ceil(g.nodes.length / k);
    });
    return at;
  }

  /**
   * Positions for every box, zone, arrow and label. `width` is the drawing's width on screen: at
   * NARROW_BELOW or more the spec's own grid is used; below it the boxes reflow into one or two columns.
   */
  function layout(spec, width) {
    if (width >= NARROW_BELOW) {
      var at = {};
      spec.nodes.forEach(function (n) { at[n.id] = n.at; });
      return geometry(spec, at, spec.cellWidth || 150, MARGIN, false, true);
    }
    // Narrow: two columns when the widest label fits, else one; the boxes take the width that is left.
    for (var cols = 2; cols >= 1; cols--) {
      var cells = reflow(spec, cols);
      var extra = geometry(spec, cells, 0, SIDE, true, false).width;
      var cellW = Math.min(cols === 1 ? 2 * MAX_CELL : MAX_CELL, Math.floor((width - extra) / cols));
      if (cols === 2 && (cellW < MIN_CELL || cellW < widest(spec) + 16)) continue;
      return geometry(spec, cells, cellW, SIDE, true, true);
    }
  }

  function geometry(spec, at, cellW, mx, narrow, withRoutes) {
    var chains = {};
    spec.nodes.forEach(function (n) { chains[n.id] = chainOf(spec, n.zone); });
    var ncols = 0, nrows = 0;
    spec.nodes.forEach(function (n) { ncols = Math.max(ncols, at[n.id][0] + 1); nrows = Math.max(nrows, at[n.id][1] + 1); });

    // Each zone's extent in cells, so gaps can make room for the zones that open and close there.
    var ext = {};
    spec.nodes.forEach(function (n) {
      chains[n.id].forEach(function (z) {
        var e = ext[z] || (ext[z] = { c0: 1e9, c1: -1, r0: 1e9, r1: -1 });
        e.c0 = Math.min(e.c0, at[n.id][0]); e.c1 = Math.max(e.c1, at[n.id][0]);
        e.r0 = Math.min(e.r0, at[n.id][1]); e.r1 = Math.max(e.r1, at[n.id][1]);
      });
    });
    // Per column (row), the most zones that open or close there around any one box in it.
    var leftPad = [], rightPad = [], topPad = [], bottomPad = [];
    var c, r;
    for (c = 0; c < ncols; c++) { leftPad[c] = 0; rightPad[c] = 0; }
    for (r = 0; r < nrows; r++) { topPad[r] = 0; bottomPad[r] = 0; }
    spec.nodes.forEach(function (n) {
      var nc = at[n.id][0], nr = at[n.id][1];
      var k = function (fn) { return chains[n.id].filter(function (z) { return fn(ext[z]); }).length; };
      leftPad[nc] = Math.max(leftPad[nc], k(function (e) { return e.c0 === nc; }) * PAD);
      rightPad[nc] = Math.max(rightPad[nc], k(function (e) { return e.c1 === nc; }) * PAD);
      topPad[nr] = Math.max(topPad[nr], k(function (e) { return e.r0 === nr; }) * (PAD + HEAD));
      bottomPad[nr] = Math.max(bottomPad[nr], k(function (e) { return e.r1 === nr; }) * PAD);
    });
    var colX = [], rowY = [];
    var x = mx + leftPad[0];
    for (c = 0; c < ncols; c++) {
      colX[c] = x;
      if (c + 1 < ncols) x += cellW + Math.max(GAP_X, rightPad[c] + leftPad[c + 1] + CHANNEL);
    }
    var y = MARGIN + topPad[0];
    for (r = 0; r < nrows; r++) {
      rowY[r] = y;
      if (r + 1 < nrows) y += NODE_H + Math.max(GAP_Y, bottomPad[r] + topPad[r + 1] + CHANNEL);
    }
    var W = colX[ncols - 1] + cellW + rightPad[ncols - 1] + mx;
    var H = rowY[nrows - 1] + NODE_H + bottomPad[nrows - 1] + MARGIN;

    var boxes = {};
    spec.nodes.forEach(function (n) {
      boxes[n.id] = { id: n.id, x: colX[at[n.id][0]], y: rowY[at[n.id][1]], w: cellW, h: NODE_H, col: at[n.id][0], row: at[n.id][1] };
    });

    // Zones: innermost first, each around its own boxes and the zones inside it.
    var zoneBoxes = {};
    var zones = (spec.zones || []).slice().sort(function (a, b) { return chainOf(spec, b.id).length - chainOf(spec, a.id).length; });
    zones.forEach(function (z) {
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      var take = function (b) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); };
      spec.nodes.forEach(function (n) { if (n.zone === z.id) take(boxes[n.id]); });
      (spec.zones || []).forEach(function (k) { if (k.in === z.id && zoneBoxes[k.id]) take(zoneBoxes[k.id]); });
      if (x0 === 1e9) return;
      zoneBoxes[z.id] = { id: z.id, x: x0 - PAD, y: y0 - PAD - HEAD, w: x1 - x0 + 2 * PAD, h: y1 - y0 + 2 * PAD + HEAD };
    });

    // Free channels between rows and gutters between columns, for the arrows.
    var channelY = function (r) { // between row r and r + 1; -1 is above the first row
      if (r < 0) return rowY[0] - topPad[0] - MARGIN / 2;
      if (r >= nrows - 1) return rowY[nrows - 1] + NODE_H + bottomPad[nrows - 1] + MARGIN / 2;
      var a = rowY[r] + NODE_H + bottomPad[r];
      var b = rowY[r + 1] - topPad[r + 1];
      return (a + b) / 2;
    };
    var gutterX = function (c) { // between column c and c + 1; -1 is left of the first column
      if (c < 0) return colX[0] - leftPad[0] - mx / 2;
      if (c >= ncols - 1) return colX[ncols - 1] + cellW + rightPad[ncols - 1] + mx / 2;
      var a = colX[c] + cellW + rightPad[c];
      var b = colX[c + 1] - leftPad[c + 1];
      return (a + b) / 2;
    };

    if (!withRoutes) return { width: Math.ceil(W), height: Math.ceil(H) };
    var routes = route(spec, boxes, zoneBoxes, channelY, gutterX, W);
    // Each zone's title goes in its header band, left-aligned, moved right past any arrow crossing the band.
    (spec.zones || []).forEach(function (z) {
      var b = zoneBoxes[z.id];
      if (!b) return;
      b.title = narrow && z.short && textWidth(z.title, 12, true) > b.w - 14 ? z.short : z.title; // `short`: for narrow frames
      var tw = textWidth(b.title, 12, true);
      var xs = [];
      Object.keys(routes).forEach(function (k) {
        var pts = routes[k].pts;
        for (var i = 0; i + 1 < pts.length; i++) {
          var p0 = pts[i], p1 = pts[i + 1];
          if (p0[0] === p1[0] && Math.max(p0[1], p1[1]) > b.y + 2 && Math.min(p0[1], p1[1]) < b.y + HEAD) xs.push(p0[0]);
          if (p0[1] === p1[1] && p0[1] > b.y && p0[1] < b.y + HEAD) xs.push(Math.min(p0[0], p1[0]), Math.max(p0[0], p1[0]));
        }
      });
      xs.sort(function (a, c) { return a - c; });
      var tx = b.x + 9;
      xs.forEach(function (x) { if (x > tx - 6 && x < tx + tw + 6) tx = x + 8; });
      b.titleClear = tx + tw <= b.x + b.w - 6;
      b.titleX = b.titleClear ? tx : b.x + 9; // no clear gap: left, over the arrows, on its halo
      b.titleW = tw;
    });
    return { narrow: narrow, width: Math.ceil(W), height: Math.ceil(H), boxes: boxes, zones: zoneBoxes, routes: routes };
  }

  function widest(spec) {
    var w = 0;
    spec.nodes.forEach(function (n) { w = Math.max(w, textWidth(n.label, 12, true), n.sub ? textWidth(n.sub, 10.5, false) : 0); });
    return w;
  }

  // ---- Routing: a few orthogonal shapes per arrow, scored; the best one that clears the boxes wins ----
  function route(spec, boxes, zoneBoxes, channelY, gutterX, W) {
    var clampX = function (x) { return Math.max(3, Math.min(W - 3, x)); };
    var sides = {}; // "node:side" -> list of { edge, other }
    var plan = spec.edges.map(function (e) {
      var s = boxes[e.from], t = boxes[e.to];
      var ss, ts;
      if (t.row > s.row) { ss = "b"; ts = "t"; }
      else if (t.row < s.row) { ss = "t"; ts = "b"; }
      else if (t.col > s.col) { ss = "r"; ts = "l"; }
      else { ss = "l"; ts = "r"; }
      var p = { e: e, s: s, t: t, ss: ss, ts: ts };
      (sides[e.from + ":" + ss] = sides[e.from + ":" + ss] || []).push({ p: p, end: "s", other: t });
      (sides[e.to + ":" + ts] = sides[e.to + ":" + ts] || []).push({ p: p, end: "t", other: s });
      return p;
    });
    // Spread several arrows on one side of a box, ordered by where their other end is.
    Object.keys(sides).forEach(function (k) {
      var list = sides[k];
      var side = k.split(":")[1];
      var horiz = side === "t" || side === "b";
      list.sort(function (a, b) { return horiz ? a.other.x - b.other.x : a.other.y - b.other.y; });
      list.forEach(function (it, i) {
        var off = (i - (list.length - 1) / 2) * (horiz ? 22 : 12);
        it.p[it.end + "off"] = off;
      });
    });
    var port = function (b, side, off) {
      if (side === "b") return [b.x + b.w / 2 + off, b.y + b.h];
      if (side === "t") return [b.x + b.w / 2 + off, b.y];
      if (side === "r") return [b.x + b.w, b.y + b.h / 2 + off];
      return [b.x, b.y + b.h / 2 + off];
    };
    var obstacles = Object.keys(boxes).map(function (k) { return boxes[k]; });
    var placed = [];
    var out = {};
    plan.forEach(function (p) {
      var a = port(p.s, p.ss, p.soff || 0);
      var b = port(p.t, p.ts, p.toff || 0);
      var cands = [];
      var lanes = [0, -6, 6, -12, 12];
      if (p.ss === "b" || p.ss === "t") {
        var down = p.ss === "b";
        if (Math.abs(a[0] - b[0]) < 0.5) cands.push([a, b]);
        lanes.forEach(function (ln) {
          var cyT = channelY(down ? p.t.row - 1 : p.t.row) + ln;
          var cyS = channelY(down ? p.s.row : p.s.row - 1) + ln;
          cands.push([a, [a[0], cyT], [b[0], cyT], b]);
          cands.push([a, [a[0], cyS], [b[0], cyS], b]);
          [p.t.col - 1, p.t.col, p.s.col - 1, p.s.col].forEach(function (gc) {
            var gx = clampX(gutterX(gc) + ln);
            cands.push([a, [a[0], cyS], [gx, cyS], [gx, cyT], [b[0], cyT], b]);
          });
        });
      } else {
        var right = p.ss === "r";
        if (Math.abs(a[1] - b[1]) < 0.5) cands.push([a, b]);
        lanes.forEach(function (ln) {
          var gS = clampX(gutterX(right ? p.s.col : p.s.col - 1) + ln);
          var gT = clampX(gutterX(right ? p.t.col - 1 : p.t.col) + ln);
          cands.push([a, [gS, a[1]], [gS, b[1]], b]);
          cands.push([a, [gT, a[1]], [gT, b[1]], b]);
          [p.s.row - 1, p.s.row].forEach(function (cr) {
            var cy = channelY(cr) + ln;
            cands.push([a, [gS, a[1]], [gS, cy], [gT, cy], [gT, b[1]], b]);
          });
        });
      }
      var best = null;
      cands.forEach(function (pts) {
        pts = tidy(pts);
        var hits = 0, overlaps = 0, len = 0;
        for (var i = 0; i + 1 < pts.length; i++) {
          var p0 = pts[i], p1 = pts[i + 1];
          len += Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]);
          obstacles.forEach(function (o) {
            var inset = (o === p.s || o === p.t) ? 1.5 : -3;
            if (segHitsRect(p0, p1, o, inset)) hits++;
          });
          placed.forEach(function (q) { if (collinearOverlap(p0, p1, q[0], q[1]) > 4) overlaps++; });
        }
        var score = hits * 10000 + overlaps * 80 + len + (pts.length - 2) * 30;
        if (!best || score < best.score) best = { pts: pts, score: score, hits: hits };
      });
      for (var i = 0; i + 1 < best.pts.length; i++) placed.push([best.pts[i], best.pts[i + 1]]);
      out[p.e.id] = { id: p.e.id, pts: best.pts, hits: best.hits };
    });
    return out;
  }

  function tidy(pts) {
    var out = [];
    pts.forEach(function (q) {
      var last = out[out.length - 1];
      if (last && Math.abs(last[0] - q[0]) < 0.5 && Math.abs(last[1] - q[1]) < 0.5) return;
      out.push([Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]);
    });
    // Drop middle points on a straight run.
    for (var i = 1; i + 1 < out.length; ) {
      var a = out[i - 1], b = out[i], c = out[i + 1];
      if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) out.splice(i, 1);
      else i++;
    }
    return out;
  }

  function segHitsRect(p0, p1, r, inset) {
    var x0 = Math.min(p0[0], p1[0]), x1 = Math.max(p0[0], p1[0]);
    var y0 = Math.min(p0[1], p1[1]), y1 = Math.max(p0[1], p1[1]);
    return x1 > r.x + inset && x0 < r.x + r.w - inset && y1 > r.y + inset && y0 < r.y + r.h - inset;
  }

  function collinearOverlap(a0, a1, b0, b1) {
    if (a0[1] === a1[1] && b0[1] === b1[1] && Math.abs(a0[1] - b0[1]) < 2) {
      return Math.min(Math.max(a0[0], a1[0]), Math.max(b0[0], b1[0])) - Math.max(Math.min(a0[0], a1[0]), Math.min(b0[0], b1[0]));
    }
    if (a0[0] === a1[0] && b0[0] === b1[0] && Math.abs(a0[0] - b0[0]) < 2) {
      return Math.min(Math.max(a0[1], a1[1]), Math.max(b0[1], b1[1])) - Math.max(Math.min(a0[1], a1[1]), Math.min(b0[1], b1[1]));
    }
    return 0;
  }

  /**
   * Where an arrow's label goes: the middle of its longest level segment that holds it, else of its longest
   * segment, kept inside the drawing.
   */
  function labelSpot(pts, w, W) {
    var best = null;
    for (var pass = 0; pass < 2 && !best; pass++) {
      var top = 0;
      for (var i = 0; i + 1 < pts.length; i++) {
        var level = pts[i][1] === pts[i + 1][1];
        var l = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
        if (pass === 0 && (!level || l < w + 12)) continue;
        if (l > top) { top = l; best = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; }
      }
    }
    return { x: Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, best[0])), y: best[1] };
  }

  function pathLength(pts) {
    var l = 0;
    for (var i = 0; i + 1 < pts.length; i++) l += Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
    return l;
  }

  function pointAt(pts, d) {
    for (var i = 0; i + 1 < pts.length; i++) {
      var l = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
      if (d <= l || i + 2 === pts.length) {
        var t = l ? Math.min(1, d / l) : 1;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
      }
      d -= l;
    }
    return pts[pts.length - 1];
  }

  // ---- Drawing ---------------------------------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  function drawSvg(spec, L) {
    var parts = [];
    var zoneList = (spec.zones || []).slice().sort(function (a, b) { return chainOf(spec, a.id).length - chainOf(spec, b.id).length; });
    zoneList.forEach(function (z) {
      var b = L.zones[z.id];
      if (!b) return;
      parts.push('<g class="fk-zone fk-h-' + (z.hue || "neutral") + '"><rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="10"/></g>');
    });
    var titles = zoneList.filter(function (z) { return L.zones[z.id]; }).map(function (z) {
      var b = L.zones[z.id];
      return '<text class="k-label fk-zt" x="' + b.titleX + '" y="' + (b.y + 16) + '">' + esc(b.title) + "</text>";
    }).join("");
    spec.edges.forEach(function (e) {
      var r = L.routes[e.id];
      var d = "M" + r.pts.map(function (q) { return q[0] + " " + q[1]; }).join(" L");
      var n = r.pts.length;
      var tip = r.pts[n - 1], from = r.pts[n - 2];
      var dx = Math.sign(tip[0] - from[0]), dy = Math.sign(tip[1] - from[1]);
      var head = "M" + tip[0] + " " + tip[1] + " L" + (tip[0] - dx * 8 - dy * 4) + " " + (tip[1] - dy * 8 - dx * 4) + " L" + (tip[0] - dx * 8 + dy * 4) + " " + (tip[1] - dy * 8 + dx * 4) + " Z";
      var label = "";
      if (e.label) {
        var w = textWidth(e.label, 10.5, false) + 10;
        var spot = labelSpot(r.pts, w, L.width);
        label = '<g class="fk-lbl" transform="translate(' + spot.x + "," + spot.y + ')"><rect x="' + (-w / 2) + '" y="-8" width="' + w + '" height="16" rx="8"/><text class="k-small" y="3.5">' + esc(e.label) + "</text></g>";
      }
      parts.push('<g class="fk-edge" data-edge="' + esc(e.id) + '"><path class="fk-line" d="' + d + '"/><path class="fk-head" d="' + head + '"/>' + label + "</g>");
    });
    spec.nodes.forEach(function (nd) {
      var b = L.boxes[nd.id];
      var hue = nd.hue || (spec.zones || []).filter(function (z) { return z.id === nd.zone; }).map(function (z) { return z.hue; })[0] || "neutral";
      var cx = b.x + b.w / 2;
      parts.push('<g class="fk-node fk-h-' + hue + '" data-node="' + esc(nd.id) + '"><rect class="fk-box" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="8"/>' +
        '<text class="k-label" x="' + cx + '" y="' + (b.y + (nd.sub ? 19 : 27)) + '">' + esc(nd.label) + "</text>" +
        (nd.sub ? '<text class="k-small" x="' + cx + '" y="' + (b.y + 35) + '">' + esc(nd.sub) + "</text>" : "") + "</g>");
    });
    parts.push('<g class="fk-titles">' + titles + "</g>");
    parts.push('<circle class="fk-token" id="fk-token" r="6" cx="-20" cy="-20"/>');
    return parts.join("");
  }

  // ---- The sim ---------------------------------------------------------------------------------------
  function mount(spec) {
    var app = document.getElementById("app");
    var steps = spec.steps;
    var state = { step: 0, picked: null, fired: false, reduced: false, mode: null, anim: 0 };
    var L = null;
    var els = {};
    var sim = window.createSim({
      onInit: function (init) {
        applyTheme(init && init.theme);
        state.reduced = !!(init && init.reducedMotion);
        document.documentElement.classList.toggle("reduced", state.reduced);
        if (!els.svg) build();
      },
    });
    // Without a host (a preview), start anyway.
    setTimeout(function () { if (!els.svg) build(); }, 300);

    function applyTheme(theme) {
      if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
      else delete document.documentElement.dataset.theme;
    }
    function reportSize() {
      requestAnimationFrame(function () { sim.resize(document.body.scrollHeight + 8); });
    }

    function build() {
      var p = spec.predict;
      app.innerHTML =
        (p ? '<details class="panel predict" open><summary class="q">' + esc(p.question) + '</summary><div class="chips" role="group" aria-label="Your prediction">' +
          p.options.map(function (o) { return '<button class="chip" type="button" data-predict="' + esc(o.id) + '" aria-pressed="false">' + esc(o.label) + "</button>"; }).join("") +
          '</div><p class="verdict" id="verdict"></p></details>' : "") +
        '<section class="panel stage"><div class="view scroll" tabindex="0" role="region" aria-label="Diagram"><svg id="svg" role="img" aria-label="' + esc(spec.title) + '"></svg></div>' +
        '<div class="side"><p class="caption" id="caption" role="status"></p>' +
        '<nav class="fk-steps" aria-label="Steps">' + steps.map(function (s, i) { return '<button class="pill" type="button" data-step="' + (i + 1) + '">' + (i + 1) + " · " + esc(s.label) + "</button>"; }).join("") + "</nav>" +
        '<div class="controls"><div class="buttons"><button type="button" id="back">Back</button><button type="button" id="step" class="primary">Step</button><button type="button" id="reset">Reset</button></div></div>' +
        '<p class="fk-readout" id="readout"></p></div></section>' +
        (spec.legend ? '<p class="legend">' + esc(spec.legend) + "</p>" : "");
      els.svg = app.querySelector("#svg");
      els.caption = app.querySelector("#caption");
      els.readout = app.querySelector("#readout");
      els.verdict = app.querySelector("#verdict");
      els.view = app.querySelector(".view");
      els.pills = Array.prototype.slice.call(app.querySelectorAll("[data-step]"));
      els.chips = Array.prototype.slice.call(app.querySelectorAll("[data-predict]"));
      app.querySelector("#step").addEventListener("click", function () { go(Math.min(steps.length, state.step + 1)); });
      app.querySelector("#back").addEventListener("click", function () { go(Math.max(0, state.step - 1)); });
      app.querySelector("#reset").addEventListener("click", function () { state.picked = null; go(0); });
      els.pills.forEach(function (b) { b.addEventListener("click", function () { go(+b.getAttribute("data-step")); }); });
      els.chips.forEach(function (b) { b.addEventListener("click", function () { state.picked = b.getAttribute("data-predict"); update(); }); });
      document.addEventListener("visibilitychange", function () { if (document.hidden) finishMotion(); });
      if (typeof ResizeObserver === "function") new ResizeObserver(function () { draw(false); }).observe(els.view);
      draw(true);
      update();
    }

    /** Lay out for the drawing's width; redraw only when the layout mode changes. */
    function draw(force) {
      var w = (els.view && els.view.clientWidth) || 700;
      var mode = w < NARROW_BELOW ? "narrow:" + Math.round(w / 8) : "wide";
      if (!force && mode === state.mode) return;
      state.mode = mode;
      L = layout(spec, w);
      els.svg.setAttribute("viewBox", "0 0 " + L.width + " " + L.height);
      els.svg.setAttribute("width", String(L.width));
      els.svg.innerHTML = drawSvg(spec, L);
      paint();
      reportSize();
    }

    function go(n) {
      var from = state.step;
      state.step = n;
      update();
      if (n > from && n === from + 1) animate(steps[n - 1]);
      else finishMotion();
    }

    /** Edge and box states for the current step: now, seen (an earlier step), or neither. */
    function paint() {
      if (!L) return;
      var now = {}, seen = {}, here = {}, been = {};
      steps.slice(0, state.step).forEach(function (s, i) {
        var cur = i === state.step - 1;
        (s.edges || []).forEach(function (id) {
          (cur ? now : seen)[id] = true;
          spec.edges.forEach(function (e) { if (e.id === id) { been[e.from] = true; been[e.to] = true; } });
        });
        if (cur && s.at) here[s.at] = true;
      });
      Array.prototype.forEach.call(els.svg.querySelectorAll(".fk-edge"), function (g) {
        var id = g.getAttribute("data-edge");
        g.setAttribute("class", "fk-edge" + (now[id] ? " fk-now" : seen[id] ? " fk-seen" : ""));
      });
      Array.prototype.forEach.call(els.svg.querySelectorAll(".fk-node"), function (g) {
        var id = g.getAttribute("data-node");
        var base = g.getAttribute("class").replace(/ fk-(here|been)/g, "");
        g.setAttribute("class", base + (here[id] ? " fk-here" : been[id] ? " fk-been" : ""));
      });
      if (!state.anim) placeToken(1);
    }

    function update() {
      var s = steps[state.step - 1];
      els.caption.textContent = s ? s.text : spec.intro;
      els.readout.textContent = s && s.readout ? s.readout : spec.readout || "";
      els.readout.hidden = !els.readout.textContent;
      els.pills.forEach(function (b, i) {
        if (i === state.step - 1) b.setAttribute("aria-current", "step");
        else b.removeAttribute("aria-current");
      });
      els.chips.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-predict") === state.picked)); });
      var p = spec.predict;
      if (els.verdict) {
        if (p && state.step >= p.revealAt) {
          var right = state.picked === p.answer;
          var pick = p.options.filter(function (o) { return o.id === state.picked; })[0];
          els.verdict.textContent = (pick ? "You picked: " + pick.label + ". " + (right ? "Right. " : "Not so. ") : "") + p.why;
        } else els.verdict.textContent = "";
      }
      if (!state.fired && state.step === spec.checkpoint.step) {
        state.fired = true;
        sim.checkpoint(spec.checkpoint.id);
      }
      paint();
      reportSize();
    }

    // ---- Motion: one token runs the step's arrows in order, once, then stops ----------------------------
    function stepPath(s) {
      var pts = [];
      (s && s.edges || []).forEach(function (id) { if (L.routes[id]) pts = pts.concat(L.routes[id].pts); });
      return pts;
    }
    function placeToken(t) {
      var tok = els.svg.querySelector("#fk-token");
      var pts = stepPath(steps[state.step - 1]);
      if (!tok) return;
      if (!pts.length) { tok.setAttribute("cx", "-20"); tok.setAttribute("cy", "-20"); return; }
      var q = pointAt(pts, pathLength(pts) * t);
      tok.setAttribute("cx", String(Math.round(q[0] * 10) / 10));
      tok.setAttribute("cy", String(Math.round(q[1] * 10) / 10));
    }
    function finishMotion() {
      if (state.anim) cancelAnimationFrame(state.anim);
      state.anim = 0;
      placeToken(1);
    }
    function animate(s) {
      finishMotion();
      var reducedNow = state.reduced || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (reducedNow || document.hidden || !s || !(s.edges || []).length) return;
      var dur = Math.min(1400, 450 * s.edges.length);
      var t0 = null;
      var tick = function (now) {
        if (t0 === null) t0 = now;
        var t = Math.min(1, (now - t0) / dur);
        placeToken(t);
        state.anim = t < 1 ? requestAnimationFrame(tick) : 0;
      };
      state.anim = requestAnimationFrame(tick);
    }
  }

  return { mount: mount, layout: layout, check: check, textWidth: textWidth, segHitsRect: segHitsRect, NARROW_BELOW: NARROW_BELOW, NODE_H: NODE_H };
})();
/* end flow-kit v1 */

// hybrid-agent-flow: the sales-quote design from "Low-code or code" (topics/agentic-ai/low-code-or-code.mdx),
// stepped one path at a time. The experience stays low-code in Gemini Enterprise; pricing and drafting live in
// code. The last step is the path a migration plan forgets: the same registered ADK agent opened directly,
// outside the workflow, where the console's Model Armor settings don't apply. Every claim is the lesson's.
var SPEC = {
  title: "A hybrid agent: a Workflow Builder workflow in Gemini Enterprise calling an MCP server on Cloud Run and an ADK agent on Agent Runtime",
  cellWidth: 138,
  intro: "Sales quotes, the hybrid way: staff work in Gemini Enterprise, pricing is a tested calculation in code, and an ADK agent does the drafting. Press Step to follow one quote.",
  predict: {
    question: "An employee opens the registered ADK agent directly. Does the console's Model Armor setting screen it?",
    options: [
      { id: "yes", label: "Yes, the console covers it" },
      { id: "own", label: "No, the agent screens in its own code" },
      { id: "workflow", label: "Only after the workflow has run" },
    ],
    answer: "own",
    revealAt: 5,
    why: "Google documents that Model Armor settings in the Gemini Enterprise console don't automatically protect registered ADK or A2A agents: they configure screening in their own code.",
  },
  zones: [
    { id: "low", title: "Low-code: Gemini Enterprise", short: "Gemini Enterprise", hue: "orange" },
    { id: "wf", title: "Workflow Builder workflow", short: "Workflow Builder", hue: "orange", in: "low" },
    { id: "code", title: "Code-built: your project", short: "Your project", hue: "teal" },
  ],
  nodes: [
    { id: "people", label: "Employees", sub: "sales staff", at: [2, 0] },
    { id: "mcpstep", label: "MCP step", sub: "calls pricing tools", zone: "wf", at: [0, 1] },
    { id: "agentstep", label: "Agent step", sub: "existing-agent step", zone: "wf", at: [1, 1] },
    { id: "approve", label: "Human approval", sub: "a person signs off", zone: "wf", at: [2, 1] },
    { id: "registered", label: "Registered agent", sub: "beside low-code ones", zone: "low", hue: "teal", at: [3, 1] },
    { id: "mcp", label: "MCP server", sub: "on Cloud Run", zone: "code", at: [0, 2] },
    { id: "pricing", label: "Pricing API", sub: "internal, tested", zone: "code", at: [1, 2] },
    { id: "adk", label: "ADK agent", sub: "on Agent Runtime", zone: "code", at: [3, 2] },
  ],
  edges: [
    { id: "start", from: "people", to: "mcpstep", label: "starts a quote" },
    { id: "call", from: "mcpstep", to: "mcp" },
    { id: "price", from: "mcp", to: "pricing" },
    { id: "next", from: "mcpstep", to: "agentstep" },
    { id: "run", from: "agentstep", to: "adk", label: "runs" },
    { id: "signoff", from: "agentstep", to: "approve" },
    { id: "direct", from: "people", to: "registered", label: "opens it directly" },
    { id: "deployed", from: "registered", to: "adk" },
  ],
  steps: [
    { label: "Start", edges: ["start"], at: "mcpstep", text: "An employee starts the quote workflow in Gemini Enterprise. Everything they see is low-code: a Workflow Builder workflow.", readout: "Low-code: runs inside the platform's sign-in and sharing." },
    { label: "Price", edges: ["call", "price"], at: "pricing", text: "The MCP step calls the MCP server on Cloud Run, which exposes pricing as tools and wraps the internal pricing API. The tested calculation stays in code the finance engineers own.", readout: "Code-built: needs its own identity, evaluation and screening." },
    { label: "Draft", edges: ["next", "run"], at: "adk", text: "The existing-agent step runs the ADK agent on Agent Runtime for the drafting that needs many tools. It can, because the agent is registered in Gemini Enterprise and shared.", readout: "Code-built: needs its own identity, evaluation and screening." },
    { label: "Approve", edges: ["signoff"], at: "approve", text: "A person signs the quote off in a human approval step, back in the low-code workflow.", readout: "Low-code: runs inside the platform's sign-in and sharing." },
    { label: "Direct", edges: ["direct", "deployed"], at: "adk", text: "Registered, the same agent also sits beside the low-code agents, so an employee can open it directly. That path skips the workflow, and the console's Model Armor settings don't screen it.", readout: "Decide early where identity, evaluation and screening live for each part." },
  ],
  checkpoint: { id: "observe-direct-path", step: 5 },
  legend: "Orange: low-code, in Gemini Enterprise. Teal: code-built, in your project. Blue: the step you are on.",
};

FlowKit.mount(SPEC);
