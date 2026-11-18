/* flow-kit v2: copied verbatim from simulations/kit/flow-kit.js. Edit it there, never here. */
// Zones, boxes and arrows from a few lines of data, stepped one path at a time
// (skills/lms-authoring-simulations/SKILL.md, "Flow diagrams"). A sim's main.js is this block, then
// its SPEC, then `FlowKit.mount(SPEC)`. The kit lays the boxes on the grid the spec gives, draws each
// zone around its boxes, routes every arrow orthogonally around the boxes, and runs the predict card,
// the steps, the caption, the readout and the one checkpoint through the sim SDK. It draws in the sim
// kit's tokens (style.css starts with sim-kit.css, then flow-kit.css), so light and dark come free.
// Below 480 px of drawing width it lays the same boxes out again in one or two columns at full size
// instead of shrinking the laptop layout. Classic script, no imports, no network.
// v2 adds explore mode: a spec with no steps, whose boxes (and zones) carry an `info` card, becomes a clickable
// map. Clicking a box, or Tab then Enter, opens its card; arrow keys move between boxes, Escape closes the card.
// One `ask` ("which box?") is the learner's prediction: they answer by clicking a box, and the one checkpoint
// fires when they find the right one (the design standard's one checkpoint, no quest chain).
// v2 also adds `density: "compact"` (40 px boxes), `span` (a box across several columns), two-line labels ("\n")
// and zones titled on their left (`titleSide: "left"`, for stacked layers).
var FlowKit = (function () {
  "use strict";

  var NODE_H = 46, COMPACT_H = 36, MARGIN = 12, PAD = 9, HEAD = 22, GAP_X = 20, GAP_Y = 26, CHANNEL = 18;
  var COMPACT_GAP = 14, LEFT_TITLE = 104, INFO_WORDS = 60, INFO_FACTS = 3;
  var SIDE = 26, SIDE_COLUMN = 300, NARROW_BELOW = 480, MAX_CELL = 168, MIN_CELL = 124;
  var HUES = ["primary", "violet", "teal", "green", "red", "amber", "orange", "rose", "gold", "neutral"];

  // ---- Text measure: average glyph widths of the kit's system sans (Inter, Segoe UI, SF) --------------
  function textWidth(s, size, bold) {
    return String(s).length * size * (bold ? 0.58 : 0.56);
  }
  /** A box's label as lines: one, or two when the author breaks it with "\n". */
  function lines(label) {
    return String(label).split("\n");
  }
  /** The width of a box's widest text line: its label lines in bold 12 px, its sub in 10.5 px. */
  function textNeed(n) {
    var t = 0;
    lines(n.label).forEach(function (l) { t = Math.max(t, textWidth(l, 12, true)); });
    return Math.max(t, n.sub ? textWidth(n.sub, 10.5, false) : 0);
  }
  function nodeH(spec) { return spec.density === "compact" ? COMPACT_H : NODE_H; }
  /** Explore mode: no steps to follow; the boxes open info cards instead. */
  function isExplore(spec) { return !(spec.steps && spec.steps.length); }
  function spanOf(n, narrow) { return narrow ? 1 : Math.max(1, n.span || 1); }
  function leftTitled(z, narrow) { return !narrow && z.titleSide === "left"; }
  function words(s) { return String(s || "").split(/\s+/).filter(Boolean).length; }

  // ---- Icons: a small inline set, drawn as 1.5 px strokes in the box's hue (24-unit grid) -------------
  var ICONS = {
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.1.8 3.5 2.8 3.5 5.6"/>',
    server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    agent: '<path d="M12 3l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/><path d="M9 13v2M15 13v2"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9h3.5M2.5 15h3.5M18 9h3.5M18 15h3.5"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
    flow: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h4a2 2 0 0 1 2 2v7"/>',
    tool: '<path d="M14.5 5.5a4 4 0 0 0-5 5L4 16v4h4l5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18-3-3-3-15 0-18"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    check: '<path d="M9 13l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="4"/>',
  };
  /** The width a box leaves for its text: all of it, less the icon well when it has an icon. */
  function textRoom(node, w, icons) {
    return node.icon && icons !== false ? w - 50 : w - 12;
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
    // Zones nest as a tree: following `in` from any zone must end, never come back to a zone it passed.
    var cyclic = false;
    (spec.zones || []).forEach(function (z) {
      var seen = [z.id];
      for (var k = zones[z.in]; k; k = zones[k.in]) {
        if (seen.indexOf(k.id) >= 0) { out.push("zone " + z.id + " sits inside itself: " + seen.concat(k.id).join(" in ")); cyclic = true; break; }
        seen.push(k.id);
      }
    });
    if (cyclic) return out;
    var cells = {};
    (spec.nodes || []).forEach(function (n) {
      if (ids[n.id]) out.push("node " + n.id + " is listed twice");
      ids[n.id] = n;
      if (n.zone && !zones[n.zone]) out.push("node " + n.id + " sits in an unknown zone " + n.zone);
      if (!Array.isArray(n.at) || n.at.length !== 2) out.push("node " + n.id + " needs at: [column, row]");
      else {
        for (var sc = 0; sc < spanOf(n); sc++) {
          var key = (n.at[0] + sc) + "," + n.at[1];
          if (cells[key]) out.push("nodes " + cells[key] + " and " + n.id + " share the cell " + key);
          cells[key] = n.id;
        }
      }
      if (lines(n.label).length > 2) out.push("node " + n.id + ": a label has at most two lines");
      if (lines(n.label).length > 1 && n.sub) out.push("node " + n.id + ": a two-line label leaves no room for a sub");
      if (n.hue && HUES.indexOf(n.hue) < 0) out.push("node " + n.id + ": no kit hue " + n.hue);
      if (n.icon && !ICONS[n.icon]) out.push("node " + n.id + ": no icon " + n.icon + " (the kit has " + Object.keys(ICONS).join(", ") + ")");
    });
    // A zone is the rectangle of cells around its boxes; a box of another zone can't sit inside it.
    (spec.zones || []).forEach(function (z) {
      var inZone = function (n) { return chainOf(spec, n.zone).indexOf(z.id) >= 0; };
      var mine = (spec.nodes || []).filter(function (n) { return Array.isArray(n.at) && inZone(n); });
      if (!mine.length) { out.push("zone " + z.id + " holds no box"); return; }
      var c0 = Math.min.apply(null, mine.map(function (n) { return n.at[0]; })), c1 = Math.max.apply(null, mine.map(function (n) { return n.at[0] + spanOf(n) - 1; }));
      var r0 = Math.min.apply(null, mine.map(function (n) { return n.at[1]; })), r1 = Math.max.apply(null, mine.map(function (n) { return n.at[1]; }));
      (spec.nodes || []).forEach(function (n) {
        if (Array.isArray(n.at) && !inZone(n) && n.at[0] + spanOf(n) - 1 >= c0 && n.at[0] <= c1 && n.at[1] >= r0 && n.at[1] <= r1) out.push("node " + n.id + " sits inside zone " + z.id + "'s cells but isn't in it");
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
    if (isExplore(spec)) {
      var infoErr = function (who, info) {
        if (!info) return;
        if (!info.text) out.push(who + ": its info card needs a text");
        if (words(info.text) > INFO_WORDS) out.push(who + ": its info text is " + words(info.text) + " words, over " + INFO_WORDS);
        if ((info.facts || []).length > INFO_FACTS) out.push(who + ": at most " + INFO_FACTS + " facts on a card");
        (info.facts || []).forEach(function (f) { if (!Array.isArray(f) || f.length !== 2) out.push(who + ": each fact is [label, value]"); });
        if (info.covered && !(info.covered.topic && info.covered.title)) out.push(who + ": covered needs a topic id and its title");
      };
      (spec.nodes || []).forEach(function (n) {
        if (!n.info) out.push("node " + n.id + " needs an info card in explore mode");
        infoErr("node " + n.id, n.info);
      });
      (spec.zones || []).forEach(function (z) { infoErr("zone " + z.id, z.info); });
      var a = spec.ask;
      if (!a || !a.question || !a.why) out.push("explore mode needs an ask: a question, its answer and why");
      else if (!ids[a.answer]) out.push("the ask answers with an unknown node " + a.answer);
      if (spec.quests) out.push("one ask, not a chain of quests: a sim fires one checkpoint");
      if (!spec.checkpoint || !/^observe-/.test(spec.checkpoint.id || "")) out.push("the checkpoint needs an observe-* id");
      if (spec.predict) out.push("explore mode asks with ask, not a predict card");
      return out;
    }
    (spec.nodes || []).forEach(function (n) { if (n.span > 1 || n.info) out.push("node " + n.id + ": span and info cards are for explore mode"); });
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
    // Stop at a zone already in the chain, so a cycle (which check() reports) can't loop forever.
    for (var z = byId[zoneId]; z && chain.indexOf(z.id) < 0; z = byId[z.in]) chain.unshift(z.id);
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
    // The spec's own grid whenever it fits the width as drawn; otherwise reflow, so labels never shrink.
    var at = {};
    spec.nodes.forEach(function (n) { at[n.id] = n.at; });
    if (width >= NARROW_BELOW && geometry(spec, at, spec.cellWidth || 150, MARGIN, false, false).width <= width) {
      return geometry(spec, at, spec.cellWidth || 150, MARGIN, false, true);
    }
    // Narrow: two columns when the widest label fits, else one; the boxes take the width that is left.
    for (var cols = 2; cols >= 1; cols--) {
      var cells = reflow(spec, cols);
      var extra = geometry(spec, cells, 0, SIDE, true, false).width;
      var cellW = Math.max(40, Math.min(cols === 1 ? 2 * MAX_CELL : MAX_CELL, Math.floor((width - extra) / cols)));
      if (cols === 2 && (cellW < MIN_CELL || cellW < widest(spec))) continue;
      return geometry(spec, cells, cellW, SIDE, true, true);
    }
  }

  /**
   * Where the drawing goes in a stage `content` px wide (inside its padding): beside the controls when
   * `two` (the kit's two columns, from 900 px) and the spec's grid fits the column there; stacked above
   * them, full width, when the grid only fits that way; else beside them, reflowed. Returns the column
   * width the drawing is laid out for, and whether to stack.
   */
  function plan(spec, content, two) {
    var at = {};
    spec.nodes.forEach(function (n) { at[n.id] = n.at; });
    var wide = geometry(spec, at, spec.cellWidth || 150, MARGIN, false, false).width;
    var beside = content - SIDE_COLUMN - 16;
    if (!two) return { stack: false, column: content };
    if (wide <= beside) return { stack: false, column: beside };
    if (wide <= content) return { stack: true, column: content };
    // Explore mode reads the drawing and its card together, so it never squeezes the drawing beside the card.
    if (isExplore(spec)) return { stack: true, column: content };
    return { stack: false, column: beside };
  }

  function geometry(spec, at, cellW, mx, narrow, withRoutes) {
    var chains = {};
    var zoneById = {};
    (spec.zones || []).forEach(function (z) { zoneById[z.id] = z; });
    var nh = nodeH(spec);
    var compact = spec.density === "compact";
    // With no arrows there are no channels to keep, only a small gap between neighbouring zones.
    var channel = (spec.edges || []).length ? CHANNEL : 6;
    var pad = compact ? 6 : PAD;
    var gapX = compact ? COMPACT_GAP : GAP_X, gapY = compact ? COMPACT_GAP : GAP_Y;
    var leftW = spec.zoneTitleWidth || LEFT_TITLE;
    spec.nodes.forEach(function (n) { chains[n.id] = chainOf(spec, n.zone); });
    var ncols = 0, nrows = 0;
    spec.nodes.forEach(function (n) { ncols = Math.max(ncols, at[n.id][0] + spanOf(n, narrow)); nrows = Math.max(nrows, at[n.id][1] + 1); });

    // Each zone's extent in cells, so gaps can make room for the zones that open and close there.
    var ext = {};
    spec.nodes.forEach(function (n) {
      chains[n.id].forEach(function (z) {
        var e = ext[z] || (ext[z] = { c0: 1e9, c1: -1, r0: 1e9, r1: -1 });
        e.c0 = Math.min(e.c0, at[n.id][0]); e.c1 = Math.max(e.c1, at[n.id][0] + spanOf(n, narrow) - 1);
        e.r0 = Math.min(e.r0, at[n.id][1]); e.r1 = Math.max(e.r1, at[n.id][1]);
      });
    });
    // What a zone adds where it opens: a header band on top, or (titleSide "left") a title column on its left.
    var openLeft = function (z) { return pad + (leftTitled(zoneById[z], narrow) ? leftW : 0); };
    var openTop = function (z) { return pad + (leftTitled(zoneById[z], narrow) ? 0 : HEAD); };
    var sum = function (list, fn) { var t = 0; list.forEach(function (z) { t += fn(z); }); return t; };
    // Per column (row), the most zones that open or close there around any one box in it.
    var leftPad = [], rightPad = [], topPad = [], bottomPad = [];
    var c, r;
    for (c = 0; c < ncols; c++) { leftPad[c] = 0; rightPad[c] = 0; }
    for (r = 0; r < nrows; r++) { topPad[r] = 0; bottomPad[r] = 0; }
    spec.nodes.forEach(function (n) {
      var nc = at[n.id][0], nr = at[n.id][1], ne = nc + spanOf(n, narrow) - 1;
      var opens = function (fn) { return chains[n.id].filter(function (z) { return fn(ext[z]); }); };
      leftPad[nc] = Math.max(leftPad[nc], sum(opens(function (e) { return e.c0 === nc; }), openLeft));
      rightPad[ne] = Math.max(rightPad[ne], opens(function (e) { return e.c1 === ne; }).length * pad);
      topPad[nr] = Math.max(topPad[nr], sum(opens(function (e) { return e.r0 === nr; }), openTop));
      bottomPad[nr] = Math.max(bottomPad[nr], opens(function (e) { return e.r1 === nr; }).length * pad);
    });
    var colX = [], rowY = [];
    var x = mx + leftPad[0];
    for (c = 0; c < ncols; c++) {
      colX[c] = x;
      if (c + 1 < ncols) x += cellW + Math.max(gapX, rightPad[c] + leftPad[c + 1] + channel);
    }
    var y = MARGIN + topPad[0];
    for (r = 0; r < nrows; r++) {
      rowY[r] = y;
      if (r + 1 < nrows) y += nh + Math.max(gapY, bottomPad[r] + topPad[r + 1] + channel);
    }
    var W = colX[ncols - 1] + cellW + rightPad[ncols - 1] + mx;
    var H = rowY[nrows - 1] + nh + bottomPad[nrows - 1] + MARGIN;

    var boxes = {};
    spec.nodes.forEach(function (n) {
      var c0 = at[n.id][0], c1 = c0 + spanOf(n, narrow) - 1;
      boxes[n.id] = { id: n.id, x: colX[c0], y: rowY[at[n.id][1]], w: colX[c1] + cellW - colX[c0], h: nh, col: c0, row: at[n.id][1] };
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
      var lw = leftTitled(z, narrow) ? leftW : 0, hd = leftTitled(z, narrow) ? 0 : HEAD;
      zoneBoxes[z.id] = { id: z.id, x: x0 - pad - lw, y: y0 - pad - hd, w: x1 - x0 + 2 * pad + lw, h: y1 - y0 + 2 * pad + hd, left: lw > 0 };
    });

    // Free channels between rows and gutters between columns, for the arrows.
    var channelY = function (r) { // between row r and r + 1; -1 is above the first row
      if (r < 0) return rowY[0] - topPad[0] - MARGIN / 2;
      if (r >= nrows - 1) return rowY[nrows - 1] + nh + bottomPad[nrows - 1] + MARGIN / 2;
      var a = rowY[r] + nh + bottomPad[r];
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
      if (b.left) { // a title column on the zone's left: the title, and its sub under it, centred on the zone's height
        b.titleX = b.x + 10; b.titleW = Math.max(tw, z.sub ? textWidth(z.sub, 10.5, false) : 0); b.titleClear = true;
        b.titleY = b.y + b.h / 2 + (z.sub ? -2 : 4); b.room = leftW - 6;
        return;
      }
      b.titleY = b.y + 16; b.room = b.w - 14;
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
    // A narrow frame too tight for the icon wells drops them, so the labels keep their full size.
    var icons = spec.nodes.every(function (n) {
      return textNeed(n) <= textRoom(n, boxes[n.id].w, true);
    });
    return { narrow: narrow, icons: icons, width: Math.ceil(W), height: Math.ceil(H), boxes: boxes, zones: zoneBoxes, routes: routes };
  }

  /** The narrowest box every label fits in. */
  function widest(spec) {
    var w = 0;
    spec.nodes.forEach(function (n) {
      w = Math.max(w, textNeed(n) + (n.icon ? 50 : 12));
    });
    return w;
  }

  // ---- Routing: a few orthogonal shapes per arrow, scored; the best one that clears the boxes wins ----
  function route(spec, boxes, zoneBoxes, channelY, gutterX, W) {
    var clampX = function (x) { return Math.max(3, Math.min(W - 3, x)); };
    var sides = {}; // "node:side" -> list of { edge, other }
    var plan = (spec.edges || []).map(function (e) {
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
    var firstStep = {};
    (spec.steps || []).forEach(function (st, i) { (st.edges || []).forEach(function (id) { if (!firstStep[id]) firstStep[id] = i + 1; }); });
    var zoneList = (spec.zones || []).slice().sort(function (a, b) { return chainOf(spec, a.id).length - chainOf(spec, b.id).length; });
    zoneList.forEach(function (z) {
      var b = L.zones[z.id];
      if (!b) return;
      parts.push('<g class="fk-zone fk-h-' + (z.hue || "neutral") + '"><rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="10"/></g>');
    });
    var explore = isExplore(spec);
    var titles = zoneList.filter(function (z) { return L.zones[z.id]; }).map(function (z) {
      var b = L.zones[z.id];
      var t = '<text class="k-label fk-zt" x="' + b.titleX + '" y="' + b.titleY + '">' + esc(b.title) + "</text>" +
        (b.left && z.sub ? '<text class="k-small fk-zt" x="' + b.titleX + '" y="' + (b.titleY + 14) + '">' + esc(z.sub) + "</text>" : "");
      if (!(explore && z.info)) return t;
      // A zone with a card: its title is a button too (a hit area behind the words).
      var hx = b.titleX - 4, hy = b.left ? b.titleY - 14 : b.y + 3, hw = b.titleW + 8, hh = b.left && z.sub ? 32 : 18;
      return '<g class="fk-zpick" data-pick="' + esc(z.id) + '" role="button" tabindex="0" aria-pressed="false" aria-label="' + esc(z.title + ", layer: more info") + '">' +
        '<rect class="fk-hit" x="' + hx + '" y="' + hy + '" width="' + hw + '" height="' + hh + '" rx="4"/>' + t + "</g>";
    }).join("");
    (spec.edges || []).forEach(function (e) {
      var r = L.routes[e.id];
      var d = "M" + r.pts.map(function (q) { return q[0] + " " + q[1]; }).join(" L");
      var n = r.pts.length;
      var tip = r.pts[n - 1], from = r.pts[n - 2];
      var dx = Math.sign(tip[0] - from[0]), dy = Math.sign(tip[1] - from[1]);
      var head = "M" + tip[0] + " " + tip[1] + " L" + (tip[0] - dx * 8 - dy * 4) + " " + (tip[1] - dy * 8 - dx * 4) + " L" + (tip[0] - dx * 8 + dy * 4) + " " + (tip[1] - dy * 8 + dx * 4) + " Z";
      var label = "";
      var num = firstStep[e.id];
      if (e.label || num) {
        // A numbered badge (the step that first runs this arrow), then the label, in one pill.
        var tw = e.label ? textWidth(e.label, 10.5, false) : 0;
        var w = (num ? 18 : 0) + (e.label ? tw + 10 : 0) + (num && !e.label ? 0 : 0);
        var spot = labelSpot(r.pts, Math.max(w, 18), L.width);
        var x0 = -w / 2;
        label = '<g class="fk-lbl" transform="translate(' + spot.x + "," + spot.y + ')">' +
          (e.label ? '<rect x="' + x0 + '" y="-8" width="' + w + '" height="16" rx="8"/>' : "") +
          (num ? '<circle class="fk-num" cx="' + (x0 + 8) + '" cy="0" r="7"/><text class="fk-num-t" x="' + (x0 + 8) + '" y="3.5">' + num + "</text>" : "") +
          (e.label ? '<text class="k-small" x="' + (x0 + (num ? 18 : 5) + tw / 2) + '" y="3.5">' + esc(e.label) + "</text>" : "") + "</g>";
      }
      parts.push('<g class="fk-edge" data-edge="' + esc(e.id) + '"><path class="fk-line" d="' + d + '"/><path class="fk-head" d="' + head + '"/>' + label + "</g>");
    });
    spec.nodes.forEach(function (nd) {
      var b = L.boxes[nd.id];
      var hue = nd.hue || (spec.zones || []).filter(function (z) { return z.id === nd.zone; }).map(function (z) { return z.hue; })[0] || "neutral";
      var icon = L.icons && nd.icon && ICONS[nd.icon];
      var tx = icon ? b.x + 42 : b.x + b.w / 2;
      // Text baselines: one label line centred; a label and its sub, or two label lines, as a pair around the middle.
      var ls = lines(nd.label), two = ls.length > 1 || !!nd.sub;
      var y1 = b.y + (two ? b.h / 2 - 3 : b.h / 2 + 4), y2 = b.y + b.h / 2 + 12;
      var who = esc(lines(nd.label).join(" ") + (nd.sub ? " (" + nd.sub + ")" : ""));
      parts.push('<g class="fk-node fk-h-' + hue + (icon ? " fk-has-icon" : "") + (explore ? " fk-pick" : "") + '" data-node="' + esc(nd.id) + '"' +
        (explore ? ' data-pick="' + esc(nd.id) + '" role="button" tabindex="0" aria-pressed="false" aria-label="' + who + ': more info"' : "") +
        '><rect class="fk-box" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="8"/>' +
        (icon ? '<rect class="fk-well" x="' + (b.x + 8) + '" y="' + (b.y + b.h / 2 - 13) + '" width="26" height="26" rx="6"/><g class="fk-icon" transform="translate(' + (b.x + 12) + "," + (b.y + b.h / 2 - 9) + ') scale(.75)">' + icon + "</g>" : "") +
        '<text class="k-label" x="' + tx + '" y="' + y1 + '">' + esc(ls[0]) + "</text>" +
        (ls[1] ? '<text class="k-label" x="' + tx + '" y="' + y2 + '">' + esc(ls[1]) + "</text>" : "") +
        (nd.sub ? '<text class="k-small" x="' + tx + '" y="' + y2 + '">' + esc(nd.sub) + "</text>" : "") + "</g>");
    });
    parts.push('<g class="fk-titles">' + titles + "</g>");
    parts.push('<circle class="fk-token" id="fk-token" r="6" cx="-20" cy="-20"/>');
    parts.push('<g class="fk-check" id="fk-check" transform="translate(-40,-40)"><circle r="8"/><path d="M-3.5 0l2.5 2.5 4.5-5"/></g>');
    return parts.join("");
  }

  // ---- The sim ---------------------------------------------------------------------------------------
  function mount(spec) {
    if (isExplore(spec)) return mountExplore(spec);
    var app = document.getElementById("app");
    var steps = spec.steps;
    var state = { step: 0, picked: null, armed: false, fired: false, reduced: false, mode: null, anim: 0, playing: false, timer: 0, speed: 1 };
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
          '</div><p class="verdict" id="verdict" aria-live="polite"></p></details>' : "") +
        '<section class="panel stage"><div class="view scroll" tabindex="0" role="region" aria-label="Diagram"><svg id="svg" role="img" aria-label="' + esc(spec.title) + '"></svg></div>' +
        '<div class="side"><p class="caption" id="caption" role="status"><strong class="fk-cap-h" id="cap-h"></strong><span id="cap-t"></span></p>' +
        '<nav class="fk-steps" aria-label="Steps"><button class="pill" type="button" data-step="0">Overview</button>' + steps.map(function (s, i) { return '<button class="pill" type="button" data-step="' + (i + 1) + '">' + (i + 1) + " · " + esc(s.label) + "</button>"; }).join("") + "</nav>" +
        '<div class="controls fk-ctl"><div class="buttons"><button type="button" id="back">Back</button><button type="button" id="step" class="primary">Step</button><button type="button" id="play">Play</button><button type="button" id="speed" aria-label="Speed 1x">1×</button><button type="button" id="reset">Reset</button></div></div>' +
        '<p class="fk-readout" id="readout"></p></div></section>' +
        (spec.legend ? '<p class="legend">' + esc(spec.legend) + "</p>" : "");
      els.svg = app.querySelector("#svg");
      els.capH = app.querySelector("#cap-h");
      els.capT = app.querySelector("#cap-t");
      els.readout = app.querySelector("#readout");
      els.verdict = app.querySelector("#verdict");
      els.view = app.querySelector(".view");
      els.pills = Array.prototype.slice.call(app.querySelectorAll("[data-step]"));
      els.chips = Array.prototype.slice.call(app.querySelectorAll("[data-predict]"));
      els.play = app.querySelector("#play");
      els.speed = app.querySelector("#speed");
      app.querySelector("#step").addEventListener("click", function () { stop(); go(Math.min(steps.length, state.step + 1)); });
      app.querySelector("#back").addEventListener("click", function () { stop(); go(Math.max(0, state.step - 1)); });
      app.querySelector("#reset").addEventListener("click", function () { stop(); state.picked = null; state.armed = false; go(0); });
      els.play.addEventListener("click", function () { if (state.playing) stop(); else play(); });
      els.speed.addEventListener("click", function () {
        var speeds = [1, 1.5, 2, 0.5];
        state.speed = speeds[(speeds.indexOf(state.speed) + 1) % speeds.length];
        els.speed.textContent = state.speed + "×";
        els.speed.setAttribute("aria-label", "Speed " + state.speed + "x");
      });
      els.pills.forEach(function (b) { b.addEventListener("click", function () { stop(); go(+b.getAttribute("data-step")); }); });
      // A pick counts once the learner runs to the reveal after making it: picked before the reveal step, or
      // picked after it and then stepped back before it again.
      els.chips.forEach(function (b) {
        b.addEventListener("click", function () {
          state.picked = b.getAttribute("data-predict");
          state.armed = !spec.predict || state.step < spec.predict.revealAt;
          update();
        });
      });
      document.addEventListener("visibilitychange", function () { if (document.hidden) { stop(); finishMotion(); } });
      if (typeof ResizeObserver === "function") new ResizeObserver(function () { draw(false); }).observe(app.querySelector(".stage"));
      draw(true);
      update();
    }

    /** Lay out for the drawing's width; redraw only when the layout mode changes. */
    function draw(force) {
      // Two columns only when the spec's grid fits beside the controls at full size; else stack (flow-kit.css).
      var stage = app.querySelector(".stage");
      var two = !!(window.matchMedia && window.matchMedia("(min-width: 900px)").matches);
      var where = plan(spec, Math.max(0, ((stage && stage.clientWidth) || 728) - 28), two);
      if (stage) stage.classList.toggle("fk-stack", where.stack);
      var w = Math.min(where.column, (els.view && els.view.clientWidth) || where.column);
      var next = layout(spec, w);
      var mode = next.narrow ? "narrow:" + next.width + "x" + next.height : "wide";
      if (!force && mode === state.mode) return;
      state.mode = mode;
      L = next;
      els.svg.setAttribute("viewBox", "0 0 " + L.width + " " + L.height);
      els.svg.setAttribute("width", String(L.width));
      els.svg.style.maxWidth = "min(100%, " + L.width + "px)"; // never drawn larger than laid out, so labels stay 12 px
      els.svg.innerHTML = drawSvg(spec, L);
      paint();
      reportSize();
    }

    function go(n) {
      var from = state.step;
      state.step = n;
      if (spec.predict && state.picked && n < spec.predict.revealAt) state.armed = true;
      update();
      if (n > from && n === from + 1) animate(steps[n - 1]);
      else finishMotion();
    }

    /** The drawing's accessible name: the diagram, then the step on screen, the arrows it runs and the box it reaches. */
    function describe() {
      var s = steps[state.step - 1];
      if (!s) return spec.title + ". Overview: no step yet.";
      var name = function (id) { return spec.nodes.filter(function (n) { return n.id === id; }).map(function (n) { return n.label; })[0] || id; };
      var arrows = (s.edges || []).map(function (id) {
        var e = spec.edges.filter(function (x) { return x.id === id; })[0];
        return e ? name(e.from) + " to " + name(e.to) : id;
      });
      return spec.title + ". Step " + state.step + " of " + steps.length + ", " + s.label + ": " + arrows.join(", then ") + (s.at ? ". Reached: " + name(s.at) + "." : ".");
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
      els.capH.textContent = s ? "Step " + state.step + " of " + steps.length + " · " + s.label : "";
      els.capT.textContent = s ? s.text : spec.intro;
      els.readout.textContent = s && s.readout ? s.readout : spec.readout || "";
      els.readout.hidden = !els.readout.textContent;
      els.pills.forEach(function (b, i) {
        if (i === state.step) b.setAttribute("aria-current", "step");
        else b.removeAttribute("aria-current");
      });
      els.chips.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-predict") === state.picked)); });
      var p = spec.predict;
      var revealed = !p || (state.step >= p.revealAt && state.picked && state.armed);
      if (els.verdict) {
        if (p && state.step >= p.revealAt) {
          var pick = p.options.filter(function (o) { return o.id === state.picked; })[0];
          if (!pick) els.verdict.textContent = "Make your prediction above first, then step to here again to check it.";
          else if (!state.armed) els.verdict.textContent = "You picked: " + pick.label + ". Step back and run to here again to check it.";
          else els.verdict.textContent = "You picked: " + pick.label + ". " + (state.picked === p.answer ? "Right. " : "Not so. ") + p.why;
        } else els.verdict.textContent = "";
      }
      els.svg.setAttribute("aria-label", describe());
      // The checkpoint: the learner reached the step with a prediction committed before it.
      if (!state.fired && revealed && state.step >= spec.checkpoint.step) {
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
      // The check badge sits on the box the step reaches, once the token is there.
      var chk = els.svg.querySelector("#fk-check");
      var s = steps[state.step - 1];
      var b = s && s.at && t >= 1 ? L.boxes[s.at] : null;
      if (chk) chk.setAttribute("transform", b ? "translate(" + (b.x + b.w - 4) + "," + (b.y + 4) + ")" : "translate(-40,-40)");
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
    /** Play: step on from here to the end, one step each beat; any other control stops it. */
    function play() {
      state.playing = true;
      els.play.textContent = "Pause";
      if (state.step >= steps.length) go(0);
      beat();
    }
    function beat() {
      if (!state.playing) return;
      if (state.step >= steps.length) { stop(); return; }
      go(state.step + 1);
      var s = steps[state.step - 1];
      var wait = (Math.min(1400, 450 * ((s && s.edges) || []).length) + 1400) / state.speed;
      state.timer = setTimeout(beat, wait);
    }
    function stop() {
      if (state.timer) clearTimeout(state.timer);
      state.timer = 0;
      if (state.playing) { state.playing = false; els.play.textContent = "Play"; }
    }
    function animate(s) {
      finishMotion();
      var reducedNow = state.reduced || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (reducedNow || document.hidden || !s || !(s.edges || []).length) return;
      var dur = Math.min(1400, 450 * s.edges.length) / state.speed;
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

  // ---- Explore mode: a map whose boxes open info cards ------------------------------------------------
  /** The card for a box or a zone: its name, its former name, its text, a few facts, and the lesson that covers it. */
  function cardHtml(name, info) {
    if (!info) return "";
    return '<h3 class="fk-card-h">' + esc(name) + "</h3>" +
      (info.formerly ? '<p class="fk-card-was">was ' + esc(info.formerly) + "</p>" : "") +
      '<p class="fk-card-t">' + esc(info.text) + "</p>" +
      ((info.facts || []).length || info.covered ? '<dl class="fk-card-f">' +
        (info.facts || []).map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") +
        (info.covered ? "<div><dt>Covered in</dt><dd>" + esc(info.covered.title) + "</dd></div>" : "") + "</dl>" : "");
  }

  function mountExplore(spec) {
    var app = document.getElementById("app");
    var ask = spec.ask;
    var state = { picked: null, solved: false, tries: 0, fired: false, mode: null };
    var L = null;
    var els = {};
    var items = {}; // id -> { name, info }
    spec.nodes.forEach(function (n) { items[n.id] = { name: lines(n.label).join(" "), info: n.info }; });
    (spec.zones || []).forEach(function (z) { if (z.info) items[z.id] = { name: z.title, info: z.info }; });
    var sim = window.createSim({
      onInit: function (init) {
        applyTheme(init && init.theme);
        if (!els.svg) build();
      },
    });
    setTimeout(function () { if (!els.svg) build(); }, 300);

    function applyTheme(theme) {
      if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
      else delete document.documentElement.dataset.theme;
    }
    function reportSize() {
      requestAnimationFrame(function () { sim.resize(document.body.scrollHeight + 8); });
    }

    function build() {
      // Every card sits, hidden, in one grid cell behind the live one, so the panel is as tall as the tallest
      // card from the start and opening a card never moves the page.
      var sizer = '<div class="fk-card fk-sizer" aria-hidden="true">' + cardHtml("", { text: spec.intro }) + "</div>" +
        Object.keys(items).map(function (id) { return '<div class="fk-card fk-sizer" aria-hidden="true">' + cardHtml(items[id].name, items[id].info) + "</div>"; }).join("");
      app.innerHTML =
        '<section class="panel stage fk-explore"><div class="view scroll" tabindex="0" role="region" aria-label="Map"><svg id="svg" role="group" aria-label="' + esc(spec.title) + '"></svg></div>' +
        '<div class="side"><div class="fk-cards">' + sizer + '<div class="fk-card" id="card" aria-live="polite"></div></div>' +
        '<div class="fk-ask"><p class="caption" id="caption" role="status"></p>' +
        '<div class="controls fk-ctl"><div class="buttons"><button type="button" id="reset">Reset</button></div></div></div>' +
        "</div></section>" +
        (spec.legend ? '<p class="legend">' + esc(spec.legend) + "</p>" : "");
      els.svg = app.querySelector("#svg");
      els.card = app.querySelector("#card");
      els.caption = app.querySelector("#caption");
      els.view = app.querySelector(".view");
      els.svg.addEventListener("click", function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest("[data-pick]") : null;
        if (t) pick(t.getAttribute("data-pick"));
      });
      els.svg.addEventListener("keydown", onKey);
      app.querySelector("#reset").addEventListener("click", function () {
        state.picked = null; state.solved = false; state.tries = 0;
        update();
      });
      if (typeof ResizeObserver === "function") new ResizeObserver(function () { draw(false); }).observe(app.querySelector(".stage"));
      draw(true);
      update();
    }

    /** Lay out for the width there is: beside the card when the grid fits there, else full width above it. */
    function draw(force) {
      var stage = app.querySelector(".stage");
      var two = !!(window.matchMedia && window.matchMedia("(min-width: 900px)").matches);
      var where = plan(spec, Math.max(0, ((stage && stage.clientWidth) || 728) - 28), two);
      if (stage) stage.classList.toggle("fk-stack", where.stack);
      var w = Math.min(where.column, (els.view && els.view.clientWidth) || where.column);
      var next = layout(spec, w);
      var mode = next.narrow ? "narrow:" + next.width + "x" + next.height : "wide";
      if (!force && mode === state.mode) return;
      var focused = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-pick");
      state.mode = mode;
      L = next;
      els.svg.setAttribute("viewBox", "0 0 " + L.width + " " + L.height);
      els.svg.setAttribute("width", String(L.width));
      els.svg.style.maxWidth = "min(100%, " + L.width + "px)";
      els.svg.innerHTML = drawSvg(spec, L);
      paint();
      if (focused) focusPick(focused);
      reportSize();
    }

    function pick(id) {
      if (!items[id]) return;
      state.picked = id;
      if (!state.solved) {
        state.tries++;
        state.solved = id === ask.answer;
      }
      update();
    }

    function update() {
      var it = state.picked && items[state.picked];
      els.card.innerHTML = it ? cardHtml(it.name, it.info) : cardHtml("", { text: spec.intro });
      els.card.classList.toggle("fk-card-intro", !it);
      var say;
      if (state.solved) say = "Right: " + items[ask.answer].name + ". " + ask.why + " Click any box to read about it.";
      else if (state.picked) say = ask.question + " Not " + items[state.picked].name + ". Read its card, then try another box.";
      else say = ask.question + " Click the box you think it is.";
      els.caption.textContent = say;
      // The right box found: the checkpoint, once.
      if (state.solved && !state.fired) {
        state.fired = true;
        sim.checkpoint(spec.checkpoint.id);
      }
      paint();
      reportSize();
    }

    function paint() {
      if (!L) return;
      Array.prototype.forEach.call(els.svg.querySelectorAll("[data-pick]"), function (g) {
        var on = g.getAttribute("data-pick") === state.picked;
        g.setAttribute("aria-pressed", String(on));
        var base = g.getAttribute("class").replace(/ fk-here/g, "");
        g.setAttribute("class", base + (on ? " fk-here" : ""));
      });
    }

    function picks() { return Array.prototype.slice.call(els.svg.querySelectorAll("[data-pick]")); }
    function focusPick(id) {
      var el = id ? picks().filter(function (g) { return g.getAttribute("data-pick") === id; })[0] : null;
      if (el && el.focus) el.focus();
    }
    /** The rectangle a box or zone title covers, for the arrow keys: [left, top, right, bottom]. */
    function extent(id) {
      var b = L.boxes[id];
      if (b) return [b.x, b.y, b.x + b.w, b.y + b.h];
      var z = L.zones[id];
      return z.left ? [z.x, z.y, z.titleX + z.titleW, z.y + z.h] : [z.titleX, z.y, z.titleX + z.titleW, z.y + 20];
    }
    /**
     * Where an arrow key goes: the nearest box or zone title ahead that lines up with this one (their
     * extents overlap across the arrow), so a wide box steps to the row below it and never skips one;
     * when nothing ahead lines up, the nearest ahead, favouring ones straight ahead.
     */
    function neighbour(id, key) {
      var v = key === "ArrowDown" || key === "ArrowUp", sign = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
      var e = extent(id), c = [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2];
      var lineUp = [], ahead = [];
      Object.keys(items).forEach(function (k) {
        if (k === id) return;
        var o = extent(k), oc = [(o[0] + o[2]) / 2, (o[1] + o[3]) / 2];
        var along = sign * (v ? oc[1] - c[1] : oc[0] - c[0]);
        if (along <= 4) return;
        var across = Math.abs(v ? oc[0] - c[0] : oc[1] - c[1]);
        var overlap = v ? Math.min(e[2], o[2]) - Math.max(e[0], o[0]) : Math.min(e[3], o[3]) - Math.max(e[1], o[1]);
        var cand = { id: k, along: along, across: across };
        ahead.push(cand);
        if (overlap > 0) lineUp.push(cand);
      });
      if (lineUp.length) {
        lineUp.sort(function (a, b) { return a.along - b.along || a.across - b.across; });
        return lineUp[0].id;
      }
      ahead.sort(function (a, b) { return (a.along + 3 * a.across) - (b.along + 3 * b.across); });
      return ahead.length ? ahead[0].id : null;
    }
    function onKey(ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest("[data-pick]") : null;
      if (!t) return;
      var id = t.getAttribute("data-pick");
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(id); }
      else if (ev.key === "Escape") { state.picked = null; update(); }
      else if (/^Arrow/.test(ev.key)) {
        var n = neighbour(id, ev.key);
        if (n) { ev.preventDefault(); focusPick(n); }
      }
    }
  }

  return { mount: mount, layout: layout, plan: plan, SIDE_COLUMN: SIDE_COLUMN, check: check, textWidth: textWidth, textRoom: textRoom, textNeed: textNeed, lines: lines, isExplore: isExplore, INFO_WORDS: INFO_WORDS, icons: Object.keys(ICONS), NARROW_BELOW: NARROW_BELOW, NODE_H: NODE_H };
})();
/* end flow-kit v2 */
