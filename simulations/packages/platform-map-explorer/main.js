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
// A card may carry an `icon` from the kit's set, drawn beside its title in its zone's hue, or a `logo`: a key
// into the spec's `logos` (inner SVG markup on a 512 grid, plain shapes with fill attributes) for official artwork.
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
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>',
    chart: '<path d="M4 4v16h16"/><path d="M8 15l3-4 3 2 5-6"/>',
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
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
        if (info.icon && !ICONS[info.icon]) out.push(who + ": no icon " + info.icon + " (the kit has " + Object.keys(ICONS).join(", ") + ")");
        if (info.logo && !(spec.logos && spec.logos[info.logo])) out.push(who + ": no logo " + info.logo + " in the spec's logos");
      };
      (spec.nodes || []).forEach(function (n) {
        if (!n.info) out.push("node " + n.id + " needs an info card in explore mode");
        infoErr("node " + n.id, n.info);
      });
      (spec.zones || []).forEach(function (z) { infoErr("zone " + z.id, z.info); });
      Object.keys(spec.logos || {}).forEach(function (k) {
        if (/<\s*(script|style|foreignObject|image|use)\b|\son\w+\s*=|href|url\(|class=/i.test(spec.logos[k])) out.push("logo " + k + ": plain shapes with fill attributes only");
      });
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
  function cardHtml(name, info, hue, logos) {
    if (!info) return "";
    var logo = info.logo && logos && logos[info.logo];
    var icon = !logo && info.icon && ICONS[info.icon];
    return '<div class="fk-card-top">' +
      (logo ? '<svg class="fk-card-icon fk-card-logo" viewBox="0 0 512 512" aria-hidden="true">' + logo + "</svg>" : "") +
      (icon ? '<svg class="fk-card-icon fk-h-' + esc(hue || "primary") + '" viewBox="0 0 24 24" aria-hidden="true"><g class="fk-icon">' + icon + "</g></svg>" : "") +
      '<div><h3 class="fk-card-h">' + esc(name) + "</h3>" +
      (info.formerly ? '<p class="fk-card-was">was ' + esc(info.formerly) + "</p>" : "") + "</div></div>" +
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
    var zoneHue = {};
    (spec.zones || []).forEach(function (z) { zoneHue[z.id] = z.hue; });
    var cardHue = function (h) { return h && h !== "neutral" ? h : "primary"; };
    spec.nodes.forEach(function (n) { items[n.id] = { name: lines(n.label).join(" "), info: n.info, hue: cardHue(n.hue || zoneHue[n.zone]) }; });
    (spec.zones || []).forEach(function (z) { if (z.info) items[z.id] = { name: z.title, info: z.info, hue: cardHue(z.hue) }; });
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
        Object.keys(items).map(function (id) { return '<div class="fk-card fk-sizer" aria-hidden="true">' + cardHtml(items[id].name, items[id].info, items[id].hue, spec.logos) + "</div>"; }).join("");
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
      els.card.innerHTML = it ? cardHtml(it.name, it.info, it.hue, spec.logos) : cardHtml("", { text: spec.intro });
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
var SPEC = {
  title: "The Google Cloud agent platform by layer, as a clickable map: six layers of products, with governance wrapping every layer",
  intro: "Click any box or layer name, or Tab to it and press Enter, to open its card. Arrow keys move between boxes. Answer the question beside this card by clicking a box.",
  density: "compact",
  cellWidth: 39,
  zoneTitleWidth: 112,
  zones: [
    { id: "experience", title: "Experience", sub: "low-code, for users", titleSide: "left", hue: "neutral",
      info: { logo: "agents", text: "Low-code tools on top, for people who configure agents rather than code them." } },
    { id: "build", title: "Build", sub: "code, for developers", titleSide: "left", hue: "neutral",
      info: { logo: "devtools", text: "Code-first tools for developers who write and ship agents." } },
    { id: "models", title: "Models", sub: "what reasons", titleSide: "left", hue: "neutral",
      info: { logo: "aiml", text: "The models that do the reasoning, from Google, partners and the open-model world." } },
    { id: "knowledge", title: "Knowledge", sub: "what it grounds on", titleSide: "left", hue: "neutral",
      info: { logo: "databases", text: "Where an agent finds what it grounds on. Also here: the original Vector Search, a separate product from Agent Retrieval. Underneath sit the data stores an agent reads.", facts: [["Data stores", "BigQuery, Cloud SQL, Firestore, Memorystore for Redis, Cloud Storage"]], covered: { topic: "agentic-ai/rag-pipelines", title: "RAG pipelines: retrieve, rerank and ground" } } },
    { id: "run", title: "Run", sub: "where it executes", titleSide: "left", hue: "neutral",
      info: { logo: "serverless", text: "Where a deployed agent runs: from fully managed to a cluster you operate.", covered: { topic: "agentic-ai/deploying-agents", title: "Deploying agents: Agent Runtime, Cloud Run or GKE" } } },
    { id: "evaluate", title: "Evaluate", sub: "is it any good?", titleSide: "left", hue: "neutral",
      info: { logo: "observability", text: "Measures quality before release and shows what an agent did after it." } },
    { id: "govern", title: "Govern", hue: "green",
      info: { logo: "security", text: "Not a layer of its own: it wraps every layer, because an agent needs governing however it was built and wherever it runs." } },
  ],
  nodes: [
    { id: "ge", label: "Gemini Enterprise", zone: "experience", at: [0, 0], span: 4,
      info: { logo: "agents", text: "The app where employees discover, create, run and govern agents. Despite the shared name, it is a separate product from Gemini Enterprise Agent Platform.", covered: { topic: "agentic-ai/enterprise-data-gemini-enterprise", title: "Connecting enterprise data to Gemini Enterprise" } } },
    { id: "wb", label: "Workflow Builder", sub: "was Agent Designer", zone: "experience", at: [4, 0], span: 4,
      info: { logo: "agents", formerly: "Agent Designer", text: "Gemini Enterprise's low-code tool for building agent workflows visually, without code.", facts: [["Renamed", "September 2026 (GA)"]], covered: { topic: "agentic-ai/workflow-builder", title: "Workflow Builder: chat agents and workflows" } } },
    { id: "cx", label: "CX Agent Studio", sub: "from Dialogflow CX", zone: "experience", at: [8, 0], span: 4,
      info: { logo: "agents", text: "Builds customer-facing conversational agents, for example for a contact centre. Google calls it the evolution of Dialogflow CX.", covered: { topic: "agentic-ai/cx-agent-studio-flows", title: "CX Agent Studio: flows, routes and instructions" } } },
    { id: "adk", label: "ADK", zone: "build", at: [0, 1], span: 4,
      info: { logo: "devtools", text: "The Agent Development Kit: Google's open-source, code-first framework for agents.", covered: { topic: "agentic-ai/adk-agents-and-tools", title: "Building agents with ADK" } } },
    { id: "cli", label: "Agents CLI", zone: "build", at: [4, 1], span: 4,
      info: { logo: "devtools", text: "Gives a coding agent Google's packaged instructions and scripts for building with ADK, evaluating, deploying, observing and publishing.", covered: { topic: "agentic-ai/agents-cli", title: "Agents CLI: the agent lifecycle from a coding agent" } } },
    { id: "ag", label: "Antigravity", zone: "build", at: [8, 1], span: 4,
      info: { logo: "devtools", text: "Google's agent-first development environment (app, CLI and SDK) for steering coding agents.", covered: { topic: "agentic-ai/configuring-coding-agents", title: "Configuring coding agents with MCP and skills" } } },
    { id: "gem", label: "Gemini models", zone: "models", at: [0, 2], span: 6,
      info: { logo: "vertex", text: "Do the reasoning. Smaller models (Flash, Flash-Lite) suit low latency and many simple steps; a larger one (Pro) suits hard, multi-step reasoning.", covered: { topic: "agentic-ai/choosing-a-model", title: "Choosing a model and how to serve it" } } },
    { id: "garden", label: "Model Garden", zone: "models", at: [6, 2], span: 6,
      info: { logo: "vertex", text: "Offers Google, partner and open models, such as Gemma, whose open weights you can hold and tune yourself.", covered: { topic: "agentic-ai/choosing-a-model", title: "Choosing a model and how to serve it" } } },
    { id: "as", label: "Agent Search", sub: "was Vertex AI Search", zone: "knowledge", at: [0, 3], span: 3,
      info: { logo: "vertex", formerly: "Vertex AI Search", text: "Managed search and retrieval over your documents. It takes in the documents directly, so you don't build your own indexing.", facts: [["Renamed", "April 2026"]], covered: { topic: "agentic-ai/rag-pipelines", title: "RAG pipelines: retrieve, rerank and ground" } } },
    { id: "rag", label: "RAG Engine", zone: "knowledge", at: [3, 3], span: 3,
      info: { logo: "vertex", text: "A framework for your own retrieval-augmented pipeline: ingestion is managed, and you set chunking, the embedding model, the vector database, top-k and the reranker.", covered: { topic: "agentic-ai/rag-pipelines", title: "RAG pipelines: retrieve, rerank and ground" } } },
    { id: "ar", label: "Agent Retrieval", sub: "was Vector Search 2.0", zone: "knowledge", at: [6, 3], span: 3,
      info: { logo: "vertex", formerly: "Vector Search 2.0", text: "Stores and searches data objects and their embeddings, and can generate the embeddings. The original Vector Search is still a separate product.", covered: { topic: "agentic-ai/rag-pipelines", title: "RAG pipelines: retrieve, rerank and ground" } } },
    { id: "mcp", label: "MCP servers", zone: "knowledge", at: [9, 3], span: 3,
      info: { logo: "integration", text: "Expose Google Cloud services and your own systems as tools an agent can call over MCP (Model Context Protocol).", covered: { topic: "agentic-ai/mcp-tools-and-integrations", title: "Tools and integrations through MCP" } } },
    { id: "rt", label: "Agent Runtime", sub: "was Agent Engine", zone: "run", at: [0, 4], span: 4,
      info: { logo: "vertex", formerly: "Vertex AI Agent Engine", text: "The managed runtime that deploys, operates and scales agents, with Agent Platform's Sessions and Memory Bank keeping their state.", covered: { topic: "agentic-ai/deploying-agents", title: "Deploying agents: Agent Runtime, Cloud Run or GKE" } } },
    { id: "cloudrun", label: "Cloud Run", zone: "run", at: [4, 4], span: 4,
      info: { logo: "cloudrun", text: "Runs an agent as a serverless container that scales to zero, beside your other Cloud Run services.", covered: { topic: "agentic-ai/deploying-agents", title: "Deploying agents: Agent Runtime, Cloud Run or GKE" } } },
    { id: "gke", label: "GKE", zone: "run", at: [8, 4], span: 4,
      info: { logo: "gke", text: "Managed Kubernetes: full control of nodes, GPUs and networking, for compliance needs, your own GPUs or an existing cluster.", covered: { topic: "agentic-ai/deploying-agents", title: "Deploying agents: Agent Runtime, Cloud Run or GKE" } } },
    { id: "eval", label: "Gen AI evaluation service", zone: "evaluate", at: [0, 5], span: 6,
      info: { logo: "vertex", text: "Scores answers and tool-call paths (trajectories) against a test set before release. It blocks nothing in production.", covered: { topic: "agentic-ai/agent-eval-criteria", title: "Choosing evaluation criteria for agents" } } },
    { id: "obs", label: "Cloud Logging + Trace", zone: "evaluate", at: [6, 5], span: 6,
      info: { logo: "observability", text: "Cloud Logging and Cloud Trace show what an agent did in production, call by call.", covered: { topic: "agentic-ai/agent-observability-troubleshooting", title: "Observing and troubleshooting agents in production" } } },
    { id: "identity", label: "Agent Identity", zone: "govern", at: [12, 0], span: 3,
      info: { logo: "security", text: "Gives each agent its own identity, not a shared account, so access can be granted to it alone and its calls audited.", covered: { topic: "agentic-ai/agent-identity-and-access", title: "Agent Identity and least-privilege access" } } },
    { id: "gateway", label: "Agent Gateway", zone: "govern", at: [12, 1], span: 3,
      info: { logo: "networking", text: "The point where policy on agent traffic is enforced and observed, whichever tool built the agent and wherever it runs.", covered: { topic: "agentic-ai/agent-gateway-and-registry", title: "Agent Gateway and Agent Registry" } } },
    { id: "registry", label: "Agent Registry", sub: "+ Skill Registry", zone: "govern", at: [12, 2], span: 3,
      info: { logo: "agents", text: "Catalogues agents, MCP servers and tools. Skill Registry is being folded into it.", covered: { topic: "agentic-ai/agent-gateway-and-registry", title: "Agent Gateway and Agent Registry" } } },
    { id: "armor", label: "Model Armor", zone: "govern", at: [12, 3], span: 3,
      info: { logo: "security", text: "Screens prompts and responses for attacks such as prompt injection, and for leaks of sensitive data.", covered: { topic: "agentic-ai/guardrails-model-armor-hitl", title: "Guardrails: Model Armor, data protection and human in the loop" } } },
    { id: "sdp", label: "Sensitive Data\nProtection", zone: "govern", at: [12, 4], span: 3,
      info: { logo: "security", text: "Finds and masks sensitive data, such as card numbers or credentials.", covered: { topic: "agentic-ai/guardrails-model-armor-hitl", title: "Guardrails: Model Armor, data protection and human in the loop" } } },
  ],
  // Google Cloud's official product icons (cloud.google.com/icons, May 2026 set), offered by Google for
  // diagrams and technical documentation; Google Cloud and its product names and icons are trademarks of
  // Google LLC. Core products (Vertex AI, Cloud Run, GKE) have their own icon; the rest take the category
  // icon Google's guide assigns. Styles inlined as fill attributes so the cards' SVGs never share classes.
  logos: {
    agents: '<g><path d="M256.083,438.958h-.025c-6.531-.01-12.403-3.982-14.831-10.046-.21-.521-21.989-53.918-63.233-94.966-41.269-41.072-94.336-62.688-94.867-62.902-6.066-2.438-10.046-8.326-10.039-14.865.007-6.537,3.983-12.415,10.053-14.842.964-.39,53.504-21.883,94.854-63.036,41.476-41.278,63-94.697,63.213-95.231,2.422-6.092,8.316-10.098,14.871-10.098h.017c6.562.007,12.456,4.012,14.867,10.113.206.521,21.716,53.924,63.206,95.216,41.538,41.341,94.333,62.827,94.861,63.039,6.064,2.436,10.045,8.316,10.045,14.852s-3.969,12.416-10.033,14.851c-.52.209-53.737,21.965-94.874,62.904-41.11,40.916-63.029,94.463-63.245,94.999-2.444,6.048-8.317,10.013-14.838,10.013h-.002ZM125.551,256.183c21.069,11.566,49.712,29.899,75.016,55.082,25.399,25.278,43.886,54.093,55.524,75.267,11.659-21.198,30.162-50.046,55.502-75.267,25.252-25.131,53.939-43.484,75.035-55.069-21.021-11.563-49.611-29.911-75.035-55.213-25.47-25.349-43.907-54.14-55.514-75.348-11.608,21.21-30.048,50.005-55.512,75.348-25.409,25.288-53.996,43.635-75.017,55.2h0Z" fill="#4285f4"/><path d="M394.5,181c-4.095,0-8.189-1.562-11.313-4.687l-47.5-47.5c-6.249-6.248-6.249-16.379,0-22.627l47.5-47.5c6.248-6.249,16.379-6.249,22.627,0l47.5,47.5c6.249,6.248,6.249,16.379,0,22.627l-47.5,47.5c-3.124,3.124-7.219,4.687-11.313,4.687h-.001ZM369.627,117.5l24.873,24.873,24.873-24.873-24.873-24.873-24.873,24.873Z" fill="#9aa0a6"/><path d="M117.5,181c-4.095,0-8.189-1.562-11.313-4.687l-47.5-47.5c-6.249-6.248-6.249-16.379,0-22.627l47.5-47.5c6.248-6.249,16.379-6.249,22.627,0l47.5,47.5c6.249,6.248,6.249,16.379,0,22.627l-47.5,47.5c-3.124,3.124-7.219,4.687-11.313,4.687h0ZM92.627,117.5l24.873,24.873,24.873-24.873-24.873-24.873-24.873,24.873Z" fill="#4285f4"/><path d="M394.5,458c-4.095,0-8.189-1.562-11.313-4.687l-47.5-47.5c-6.249-6.248-6.249-16.379,0-22.627l47.5-47.5c6.248-6.248,16.379-6.248,22.627,0l47.5,47.5c6.249,6.248,6.249,16.379,0,22.627l-47.5,47.5c-3.124,3.124-7.219,4.687-11.313,4.687h-.001ZM369.627,394.5l24.873,24.873,24.873-24.873-24.873-24.873-24.873,24.873Z" fill="#4285f4"/><path d="M117.5,458c-4.095,0-8.189-1.562-11.313-4.687l-47.5-47.5c-6.249-6.248-6.249-16.379,0-22.627l47.5-47.5c6.248-6.248,16.379-6.248,22.627,0l47.5,47.5c6.249,6.248,6.249,16.379,0,22.627l-47.5,47.5c-3.124,3.124-7.219,4.687-11.313,4.687h0ZM92.627,394.5l24.873,24.873,24.873-24.873-24.873-24.873-24.873,24.873Z" fill="#9aa0a6"/><path d="M334.166,333.946c41.137-40.94,94.354-62.695,94.874-62.904,6.064-2.435,10.032-8.315,10.033-14.851,0-6.535-3.98-12.416-10.045-14.851-.528-.212-53.323-21.698-94.861-63.039-.072-.071-.15-.131-.223-.2l-22.604,22.604c.087.091.163.189.253.278,25.424,25.302,54.015,43.649,75.035,55.213-21.096,11.585-49.783,29.939-75.035,55.069-25.34,25.221-43.843,54.068-55.502,75.267-11.622-21.144-30.074-49.907-55.418-75.16l-22.628,22.628c41.21,41.041,62.971,94.392,63.181,94.913,2.428,6.064,8.3,10.035,14.831,10.046h.025c6.521,0,12.393-3.966,14.838-10.013.216-.536,22.135-54.083,63.245-94.999h.001Z" fill="#9aa0a6"/></g>',
    aiml: '<g><path fill="#4285f4" d="M377.2,216.1c-4.1,0-8.2-1.6-11.3-4.7l-65.3-65.3c-3-3-4.7-7.1-4.7-11.3s1.7-8.3,4.7-11.3l65.3-65.3c3-3,7.1-4.7,11.3-4.7s8.3,1.7,11.3,4.7l65.3,65.3c6.2,6.2,6.2,16.4,0,22.6l-65.3,65.3c-3.1,3.1-7.2,4.7-11.3,4.7h0ZM334.6,134.8l42.6,42.6,42.6-42.6-42.6-42.7-42.6,42.7Z"/><path fill="#9aa0a6" d="M300.7,146.1c-6.2-6.2-6.2-16.4,0-22.6l65.3-65.3c6.2-6.2,16.4-6.2,22.6,0l53.9,54-22.6,22.6-42.6-42.7-65.3,65.3s-8.1-8.2-11.3-11.4h0Z"/><path fill="#4285f4" d="M228,458.5h0c-6.5,0-12.4-4-14.8-10-.2-.5-20.8-51-59.8-89.9-39.1-38.9-89.3-59.3-89.8-59.5-6.1-2.4-10-8.3-10-14.9,0-6.5,4-12.4,10-14.8h0c.5-.2,50.5-20.6,89.8-59.7,39.2-39.1,59.6-89.6,59.8-90.1,2.4-6.1,8.3-10.1,14.9-10.1h0c6.6,0,12.5,4,14.9,10.1.2.5,20.6,51,59.8,90.1,39.3,39.1,89.3,59.5,89.8,59.7,6.1,2.4,10,8.3,10,14.9s-4,12.4-10,14.9c-.5.2-50.9,20.8-89.8,59.5-38.9,38.7-59.6,89.4-59.9,89.9-2.4,6-8.3,10-14.8,10h0ZM105.8,284.2c19.9,11,46.5,28.3,70.1,51.7,23.7,23.5,41,50.3,52.1,70.4,11.1-20,28.5-46.9,52.1-70.4,23.5-23.4,50.2-40.6,70.1-51.7-19.9-11-46.5-28.3-70.1-51.8-23.7-23.6-41-50.4-52.1-70.4-11.1,20.1-28.4,46.8-52.1,70.4-23.7,23.6-50.2,40.8-70.1,51.8h0Z"/><path fill="#9aa0a6" d="M392.5,269.3c-.5-.2-50.5-20.6-89.8-59.7,0,0,0,0-.1-.1l-22.6,22.6c0,0,.1.1.2.2,23.7,23.6,50.2,40.8,70.1,51.8-20,11.1-46.6,28.3-70.1,51.7-23.6,23.5-41,50.3-52.1,70.4-11.1-20-28.4-46.7-52-70.2l-22.6,22.6c38.9,38.8,59.5,89.3,59.7,89.8,2.4,6.1,8.3,10,14.8,10h0c6.5,0,12.4-4,14.8-10,.2-.5,21-51.2,59.9-89.9,38.9-38.7,89.3-59.3,89.8-59.5,6.1-2.4,10-8.3,10-14.9s-4-12.4-10-14.9h0Z"/></g>',
    cloudrun: '<g><path fill="#fbbc04" d="M144.4,272c-6.4,0-12.4-3.8-14.9-10.1L55.4,75.9c-3.3-8.2.7-17.5,8.9-20.8,8.2-3.3,17.5.7,20.8,8.9l74.2,186c3.3,8.2-.7,17.5-8.9,20.8-1.9.8-3.9,1.1-5.9,1.1h-.1Z"/><g><path fill="#ea4335" d="M256,272c-6.4,0-12.4-3.8-14.9-10.1l-74.1-186c-2.6-6.6-.6-14.1,5-18.5s13.4-4.5,19.2-.4l260.1,186c7.2,5.1,8.9,15.1,3.7,22.3s-15.1,8.9-22.3,3.7L216.9,114.7l54,135.3c3.3,8.2-.7,17.5-8.9,20.8-1.9.8-4,1.1-5.9,1.1h-.1Z"/></g><path fill="#34a853" d="M127.2,256l-72,180c-3.3,8.2.7,17.5,8.9,20.8,3.1,1.2,4,1.1,5.9,1.1,6.3,0,12.4-3.8,14.9-10.1l74.4-186c.8-2,1.1-4,1.1-5.9h-33.2Z"/><path fill="#4285f4" d="M414.5,256l-197.7,141.2,54.1-135.3c.8-2,1.1-4,1.1-5.9h-33.2l-72,180c-2.6,6.6-.6,14.1,5,18.5,2.9,2.3,6.4,3.4,9.9,3.4s6.5-1,9.3-3l260.4-186c4.4-3.1,6.7-8,6.7-13h-43.6Z"/></g>',
    databases: '<g><path fill="#4285f4" d="M256,490c-44.2,0-85.9-11.3-117.6-31.8-33.8-21.9-52.4-51.7-52.4-84v-118.2h32v118.2c0,21,13.4,41.3,37.8,57.1,26.5,17.2,62.1,26.7,100.2,26.7s73.7-9.5,100.2-26.7c24.4-15.8,37.8-36.1,37.8-57.1h32c0,32.3-18.6,62.1-52.4,84-31.6,20.5-73.4,31.8-117.6,31.8Z"/><path fill="#9aa0a6" d="M256,381c-44.2,0-85.9-11.3-117.6-31.8-33.8-21.9-52.4-51.7-52.4-84v-127.3h32v127.3c0,21,13.4,41.3,37.8,57.1,26.5,17.2,62.1,26.7,100.2,26.7s73.7-9.5,100.2-26.7c24.4-15.8,37.8-36.1,37.8-57.1h32c0,32.3-18.6,62.1-52.4,84-31.6,20.5-73.4,31.8-117.6,31.8Z"/><path fill="#9aa0a6" d="M256,490v-32c38.1,0,73.7-9.5,100.2-26.7,24.4-15.8,37.8-36.1,37.8-57.2v-118.1h32v118.1c0,32.3-18.6,62.1-52.4,84.1-31.6,20.5-73.4,31.8-117.6,31.8h0Z"/><path fill="#4285f4" d="M256,381v-32c38.1,0,73.7-9.5,100.2-26.7,24.4-15.8,37.8-36.1,37.8-57.2v-127.2h32v127.2c0,32.3-18.6,62.1-52.4,84.1-31.6,20.5-73.4,31.8-117.6,31.8h0Z"/><path fill="#4285f4" d="M256,253.6c-44.2,0-85.9-11.3-117.6-31.8-33.8-21.9-52.4-51.7-52.4-84s18.6-62.1,52.4-84c31.6-20.5,73.4-31.8,117.6-31.8s86,11.3,117.6,31.8c33.8,21.9,52.4,51.7,52.4,84s-18.6,62.1-52.4,84c-31.6,20.5-73.4,31.8-117.6,31.8ZM256,54c-38.1,0-73.7,9.5-100.2,26.7-24.4,15.8-37.8,36.1-37.8,57.1s13.4,41.3,37.8,57.1c26.5,17.2,62.1,26.7,100.2,26.7s73.7-9.5,100.2-26.7c24.4-15.8,37.8-36.1,37.8-57.1s-13.4-41.3-37.8-57.1c-26.5-17.2-62.1-26.7-100.2-26.7Z"/><path fill="#9aa0a6" d="M256,253.8v-32c38.1,0,73.7-9.5,100.2-26.7,24.4-15.8,37.8-36.2,37.8-57.2s-13.4-41.4-37.8-57.2c-26.5-17.2-62.1-26.7-100.2-26.7v-32c44.2,0,86,11.3,117.6,31.8,33.8,21.9,52.4,51.8,52.4,84.1s-18.6,62.1-52.4,84.1c-31.6,20.5-73.4,31.8-117.6,31.8h0Z"/></g>',
    devtools: '<g><path d="M180.63,347.41c-4.09,0-8.19-1.56-11.31-4.68-6.25-6.25-6.25-16.38,0-22.63l138.65-138.68c6.25-6.25,16.38-6.25,22.63,0s6.25,16.38,0,22.63l-138.65,138.68c-3.12,3.12-7.22,4.69-11.32,4.69v-.01Z" fill="#9aa0a6"/><path d="M134.65,458.35c-44.66,0-81-36.34-81-81s36.34-81,81-81,81,36.34,81,81-36.34,81-81,81ZM134.65,328.35c-27.02,0-49,21.98-49,49s21.98,49,49,49,49-21.98,49-49-21.98-49-49-49Z" fill="#4285f4"/><path d="M380.81,234.22c-27.52,0-53.39-10.72-72.85-30.18s-30.18-45.33-30.18-72.85,10.72-53.39,30.18-72.85c6.25-6.25,16.38-6.25,22.63,0s6.25,16.38,0,22.63c-27.69,27.7-27.69,72.76,0,100.45,27.7,27.7,72.76,27.69,100.45,0,6.25-6.25,16.38-6.25,22.63,0s6.25,16.38,0,22.63c-19.46,19.46-45.33,30.18-72.85,30.18l-.01-.01Z" fill="#4285f4"/><path d="M106.92,234.73c-4.1,0-8.19-1.56-11.31-4.69-6.25-6.25-6.25-16.38,0-22.63l63.23-63.23-63.23-63.23c-6.25-6.25-6.25-16.38,0-22.63s16.38-6.25,22.63,0l74.54,74.54c3,3,4.69,7.07,4.69,11.31s-1.69,8.31-4.69,11.31l-74.54,74.54c-3.12,3.12-7.22,4.69-11.31,4.69l-.01.02Z" fill="#9aa0a6"/><path d="M405.08,458.35c-4.1,0-8.19-1.56-11.31-4.69l-74.54-74.54c-3-3-4.69-7.07-4.69-11.31s1.69-8.31,4.69-11.31l74.54-74.54c6.25-6.25,16.38-6.25,22.63,0s6.25,16.38,0,22.63l-63.23,63.23,63.23,63.23c6.25,6.25,6.25,16.38,0,22.63-3.12,3.12-7.22,4.69-11.31,4.69l-.01-.02Z" fill="#9aa0a6"/><path d="M192.77,132.88l-11.31-11.31-85.85,85.85c-6.25,6.25-6.25,16.38,0,22.63,3.12,3.12,7.22,4.69,11.31,4.69s8.19-1.56,11.31-4.69l74.54-74.54c6.25-6.25,6.25-16.38,0-22.63Z" fill="#4285f4"/><path d="M319.23,379.12l11.31,11.31,85.85-85.85c6.25-6.25,6.25-16.38,0-22.63-3.12-3.12-7.22-4.69-11.31-4.69s-8.19,1.56-11.31,4.69l-74.54,74.54c-6.25,6.25-6.25,16.38,0,22.63Z" fill="#4285f4"/></g>',
    gke: '<g><path fill="#34a853" d="M256,459c-2.7,0-5.4-.7-7.8-2l-166.2-93.5c-5-2.8-8.2-8.2-8.2-14v-187c0-5.8,3.1-11.1,8.2-13.9L248.2,55c4.9-2.7,10.8-2.7,15.7,0l166.2,93.5c5,2.8,8.2,8.2,8.2,13.9v187c0,5.8-3.1,11.1-8.2,14l-166.2,93.5c-2.4,1.4-5.1,2-7.8,2h0ZM105.8,340.1l150.2,84.5,150.2-84.5v-168.3l-150.2-84.5-150.2,84.5v168.3ZM422.2,349.5h0Z"/><path fill="#ea4335" d="M89.8,178.5c-5.6,0-11-2.9-14-8.2-4.3-7.7-1.6-17.5,6.1-21.8L248.2,55c7.7-4.3,17.5-1.6,21.8,6.1,4.3,7.7,1.6,17.5-6.1,21.8l-166.2,93.5c-2.5,1.4-5.2,2.1-7.8,2.1h0Z"/><path fill="#ea4335" d="M422.2,178.5c-2.7,0-5.4-.7-7.8-2.1l-166.2-93.5c-7.7-4.3-10.4-14.1-6.1-21.8,4.3-7.7,14.1-10.4,21.8-6.1l166.2,93.5c7.7,4.3,10.4,14.1,6.1,21.8-2.9,5.2-8.4,8.2-14,8.2h0Z"/><path fill="#ea4335" d="M256,178.5c-8.8,0-16-7.2-16-16v-93.5c0-8.8,7.2-16,16-16s16,7.2,16,16v93.5c0,8.8-7.2,16-16,16Z"/><path fill="#fbbc04" d="M81.7,363.3c-4.9-2.9-7.9-8.1-7.9-13.8v-187c0-6,3.3-11.2,8.2-13.9,2.3-1.3,23.8-13.4,23.8-13.4v187l59.3-33.3c7.7-4.3,17.5-1.6,21.8,6.1,4.3,7.7,1.6,17.5-6.1,21.8l-90.9,51.2s-5.6-3.1-8.1-4.5h0Z"/><path fill="#4285f4" d="M422.2,367.9l-90.9-51.2c-7.7-4.3-10.4-14.1-6.1-21.8s14.1-10.4,21.8-6.1l59.3,33.3v-187s21.5,12.1,23.9,13.4c.8.5,1.6,1,2.3,1.6,3.6,2.9,5.8,7.4,5.8,12.4v187c0,5.7-3,10.9-7.9,13.8-2.5,1.5-8.1,4.5-8.1,4.5h0Z"/><path fill="#ea4335" d="M339.1,225.2c-2.7,0-5.4-.7-7.8-2.1l-75.3-42.3-75.3,42.3c-7.7,4.3-17.5,1.6-21.8-6.1-4.3-7.7-1.6-17.5,6.1-21.8l83.1-46.8c4.9-2.7,10.8-2.7,15.7,0l83.1,46.8c7.7,4.3,10.4,14.1,6.1,21.8-2.9,5.2-8.4,8.2-14,8.2h0Z"/><path fill="#4285f4" d="M256,365.5c-5.6,0-11-2.9-14-8.2-4.3-7.7-1.6-17.5,6.1-21.8l75-42.2v-84.1c0-8.8,7.2-16,16-16s16,7.2,16,16v93.5c0,5.8-3.1,11.1-8.2,14l-83.1,46.8c-2.5,1.4-5.2,2.1-7.8,2.1h0Z"/><path fill="#fbbc04" d="M256,365.5c-2.7,0-5.4-.7-7.8-2l-83.1-46.8c-5-2.8-8.2-8.2-8.2-14v-93.5c0-8.8,7.2-16,16-16s16,7.2,16,16v84.1l51.1,28.8v-66.1c0-8.8,7.2-16,16-16s16,7.2,16,16v102.9s-3,1.6-7.9,4.5c-2.5,1.5-5.3,2.2-8.1,2.2h0Z"/><path fill="#4285f4" d="M256,272c-5.6,0-11-2.9-14-8.2-4.3-7.7-1.6-17.5,6.1-21.8l91-51.2,7.9,4.4c2.1,1.1,4.2,2.8,6.1,6.1,4.3,7.7,1.6,17.5-6.1,21.8l-83.1,46.8c-2.5,1.4-5.2,2.1-7.8,2.1h0Z"/><path fill="#ea4335" d="M256,237.6l-75.3-42.3c-7.7-4.3-17.5-1.6-21.8,6.1-1.4,2.5-2.1,5.2-2.1,7.8v9.4l91.3,51.3c2.5,1.4,5.2,2.1,7.8,2.1h0v-34.4h0Z"/></g>',
    integration: '<g><path d="M346.683,112.611l-.039-75.171c-.005-8.834-7.167-15.992-16-15.992h-.008c-8.837.004-15.997,7.172-15.992,16.008l.039,75.155H118c-17.673,0-32,14.327-32,32v111.865c0,89.085,76.262,161.562,170,161.562s170-72.477,170-161.562v-111.865c0-17.673-14.327-32-32-32h-47.317ZM394,256.477c0,71.44-61.906,129.562-138,129.562s-138-58.121-138-129.562v-111.865h276v111.865Z" fill="#4285f4"/><path d="M314.644,144.611v-32h-117.294l-.039-75.171c-.005-8.834-7.167-15.992-16-15.992h-.008c-8.837.004-15.997,7.172-15.992,16.008l.039,75.155h-47.35c-17.673,0-32,14.327-32,32v111.865c0,83.959,67.741,153.155,154.007,160.841v56.679c0,8.616,6.621,16.029,15.228,16.433,9.188.432,16.772-6.889,16.772-15.982v-89.277c-6.594.627-8.014.652-16,.867h-.007c-76.094,0-138-58.121-138-129.562v-111.865h196.644,0Z" fill="#9aa0a6"/></g>',
    networking: '<g><path d="M331.66,331.66l-22.627-22.627c29.242-29.243,29.242-76.823,0-106.066l22.627-22.627c41.72,41.719,41.72,109.602,0,151.32h0Z" fill="#9aa0a6"/><path d="M180.34,331.66c-41.72-41.719-41.72-109.602,0-151.32l22.627,22.627c-29.242,29.243-29.242,76.823,0,106.066l-22.627,22.627Z" fill="#9aa0a6"/><path d="M309.033,202.967c-29.242-29.242-76.824-29.242-106.066,0l-22.627-22.627c20.21-20.21,47.08-31.34,75.66-31.34s55.45,11.13,75.66,31.34l-22.627,22.627h0Z" fill="#4285f4"/><path d="M256,363c-28.58,0-55.45-11.13-75.66-31.34l22.627-22.627c29.242,29.242,76.824,29.242,106.066,0l22.627,22.627c-20.21,20.21-47.08,31.34-75.66,31.34Z" fill="#4285f4"/><path d="M170.229,147.603c5.406-9.256,8.521-20.007,8.521-31.478,0-34.531-28.094-62.625-62.625-62.625s-62.625,28.094-62.625,62.625,28.094,62.625,62.625,62.625c11.471,0,22.222-3.114,31.478-8.52l45.281,45.281c5.831-9.07,13.557-16.796,22.627-22.627l-45.281-45.281h-.001ZM116.125,146.75c-16.887,0-30.625-13.738-30.625-30.625s13.738-30.625,30.625-30.625,30.625,13.738,30.625,30.625-13.738,30.625-30.625,30.625Z" fill="#4285f4"/><path d="M215.51,319.117c-9.07-5.831-16.796-13.557-22.627-22.627l-45.281,45.281c-9.256-5.406-20.007-8.52-31.478-8.52-34.531,0-62.625,28.094-62.625,62.625s28.094,62.625,62.625,62.625,62.625-28.094,62.625-62.625c0-11.471-3.114-22.222-8.521-31.478l45.281-45.281h0ZM116.125,426.5c-16.887,0-30.625-13.738-30.625-30.625s13.738-30.625,30.625-30.625,30.625,13.738,30.625,30.625-13.738,30.625-30.625,30.625Z" fill="#9aa0a6"/><path d="M395.875,333.25c-11.471,0-22.222,3.114-31.478,8.52l-45.281-45.281c-5.831,9.07-13.557,16.796-22.627,22.627l45.281,45.281c-5.406,9.256-8.521,20.007-8.521,31.478,0,34.531,28.094,62.625,62.625,62.625s62.625-28.094,62.625-62.625-28.094-62.625-62.625-62.625h.001ZM395.875,426.5c-16.887,0-30.625-13.738-30.625-30.625s13.738-30.625,30.625-30.625,30.625,13.738,30.625,30.625-13.738,30.625-30.625,30.625Z" fill="#4285f4"/><path d="M395.875,53.5c-34.531,0-62.625,28.094-62.625,62.625,0,11.645,3.205,22.551,8.764,31.902l-45.118,45.118c9.03,5.887,16.707,13.663,22.481,22.773l45.444-45.444c9.16,5.255,19.758,8.276,31.054,8.276,34.531,0,62.625-28.094,62.625-62.625s-28.094-62.625-62.625-62.625ZM395.875,146.75c-16.887,0-30.625-13.738-30.625-30.625s13.738-30.625,30.625-30.625,30.625,13.738,30.625,30.625-13.738,30.625-30.625,30.625Z" fill="#9aa0a6"/></g>',
    observability: '<g><path d="M426.5,458.5H85.5c-17.673,0-32-14.327-32-32V85.5c0-17.673,14.327-32,32-32h341c17.673,0,32,14.327,32,32v341c0,17.673-14.327,32-32,32ZM85.5,426.5h341V85.5H85.5v341Z" fill="#4285f4"/><path d="M166,365c-8.837,0-16-7.163-16-16v-131c0-8.837,7.163-16,16-16s16,7.163,16,16v131c0,8.837-7.163,16-16,16Z" fill="#9aa0a6"/><path d="M346,365c-8.837,0-16-7.163-16-16v-56c0-8.837,7.163-16,16-16s16,7.163,16,16v56c0,8.837-7.163,16-16,16Z" fill="#9aa0a6"/><path d="M256,365c-8.837,0-16-7.163-16-16v-187c0-8.837,7.163-16,16-16s16,7.163,16,16v187c0,8.837-7.163,16-16,16Z" fill="#4285f4"/><path d="M426.5,458.5H85.493c-17.673,0-32-14.327-32-32h373.007V85.5h32v341c0,17.673-14.327,32-32,32Z" fill="#9aa0a6"/></g>',
    security: '<g><path d="M256.004,287.542c-43.08,0-78.128-35.065-78.128-78.167s35.048-78.167,78.128-78.167,78.129,35.065,78.129,78.167-35.049,78.167-78.129,78.167ZM256.004,163.208c-25.435,0-46.128,20.71-46.128,46.167s20.693,46.167,46.128,46.167,46.129-20.71,46.129-46.167-20.693-46.167-46.129-46.167h0Z" fill="#4285f4"/><path d="M153.505,376.416c-.752,0-1.511-.053-2.276-.162-8.748-1.245-14.83-9.347-13.584-18.096,4.021-28.244,18.11-54.191,39.672-73.062,21.776-19.059,49.72-29.555,78.682-29.555,8.837,0,16,7.163,16,16s-7.163,16-16,16c-21.207,0-41.666,7.684-57.607,21.636-15.801,13.828-26.123,32.825-29.066,53.492-1.137,7.982-7.983,13.746-15.819,13.746h-.002Z" fill="#9aa0a6"/><path d="M358.493,376.427c-7.838,0-14.685-5.764-15.82-13.748-2.94-20.669-13.262-39.668-29.063-53.499-15.941-13.953-36.401-21.638-57.61-21.638-8.837,0-16-7.163-16-16s7.163-16,16-16c28.964,0,56.909,10.497,78.687,29.559,21.562,18.873,35.65,44.823,39.669,73.07,1.244,8.749-4.839,16.85-13.587,18.095-.765.108-1.523.161-2.274.161h-.002Z" fill="#4285f4"/><path d="M256.004,287.542c-43.08,0-78.128-35.065-78.128-78.167s35.048-78.167,78.128-78.167v32c-25.435,0-46.128,20.71-46.128,46.167s20.693,46.167,46.128,46.167v32Z" fill="#9aa0a6"/><path d="M437.95,151.09c-.01-.13-.03-.26-.04-.39-.02-.18-.04-.37-.07-.55-.05-.37-.12-.74-.19-1.1-.08-.36-.17-.72-.27-1.07-.15-.53-.33-1.05-.54-1.56-.06-.15-.12-.3-.18-.44-.23-.55-.5-1.08-.8-1.59-.08-.14-.16-.28-.25-.42-.19-.31-.4-.61-.61-.91-.21-.29-.42-.57-.65-.85l-.02-.02c-.23-.28-.47-.55-.72-.81-.01-.01-.02-.02-.02-.02-.19-.21-.39-.41-.6-.6-.27-.26-.55-.5-.83-.73-.13-.11-.26-.21-.39-.31-.14-.11-.28-.22-.42-.31-.13-.1-.25-.19-.38-.28-.33-.22-.67-.43-1.02-.62-.21-.13-.41-.24-.63-.35-.13-.07-.25-.13-.38-.19l-137.13-68.47-.07-.03-28.59-14.28c-4.17-2.09-9.03-2.24-13.3-.46-.33.14-.66.29-1,.46l-166,82.88c-5.42,2.71-8.85,8.26-8.85,14.32v103.13c0,44.24,21.16,86.5,56.59,113.04l98.72,73.94v.01l17.1,12.8c1.43,1.07,2.99,1.87,4.6,2.39.61.21,1.23.37,1.85.49.78.16,1.57.25,2.35.29.28.01.55.02.8.02.3,0,.59-.01.89-.03.21-.01.41-.02.62-.04.42-.04.85-.1,1.27-.18.25-.04.5-.09.74-.15.07-.01.15-.03.22-.04.01,0,.02-.01.02-.01.24-.06.48-.12.71-.19.26-.07.52-.15.78-.25.3-.11.61-.22.91-.35h.01c.28-.11.55-.24.82-.37.59-.28,1.17-.61,1.73-.99.18-.11.37-.23.54-.36.11-.07.21-.15.32-.23l115.82-86.75c35.43-26.54,56.59-68.8,56.59-113.04v-103.13c0-.44-.02-.87-.05-1.3h0ZM406,255.52c0,34.21-16.37,66.9-43.78,87.43l-106.22,79.56-106.22-79.56c-27.41-20.53-43.78-53.22-43.78-87.43v-93.24l150-74.9,150,74.9v93.24h0Z" fill="#9aa0a6"/><path d="M268.81,452.09c-.94,1.25-2.03,2.33-3.22,3.22-.11.08-.21.16-.32.23-.17.13-.36.25-.54.36-.56.38-1.14.71-1.73.99-.27.13-.54.26-.82.37h-.01c-.3.13-.61.24-.91.35-.26.09-.52.17-.78.25-.23.07-.47.13-.71.19,0,0-.01.01-.02.01-.07.01-.15.03-.22.04-.24.06-.49.11-.74.15-.42.08-.85.14-1.27.18-.21.02-.41.03-.62.04-.3.02-.59.03-.89.03-.25,0-.52-.01-.8-.02-.78-.04-1.57-.13-2.35-.29-.62-.12-1.24-.28-1.85-.49-1.61-.52-3.17-1.32-4.6-2.39l-17.1-12.8v-.01l-98.72-73.94c-35.43-26.54-56.59-68.8-56.59-113.04v-103.13c0-6.06,3.43-11.61,8.85-14.32L248.85,55.19c.34-.17.67-.32,1-.46,4.27-1.78,9.13-1.63,13.3.46l28.59,14.28.07.03-35.81,17.88-150,74.9v93.24c0,34.21,16.37,66.9,43.78,87.43l106.22,79.56,9.59,7.18c7.07,5.3,8.51,15.33,3.22,22.4h0Z" fill="#4285f4"/><path d="M438,152.39v103.13c0,44.24-21.16,86.5-56.59,113.04l-115.82,86.75c-.11.08-.21.16-.32.23-.17.13-.36.25-.54.36-.56.38-1.14.71-1.73.99-.27.13-.54.26-.82.37h-.01c-.3.13-.61.24-.91.35-.26.1-.52.18-.78.25-.23.07-.47.13-.71.19,0,0-.01.01-.02.01-.32.07-.64.14-.96.19-.42.08-.85.14-1.27.18-.21.02-.41.03-.62.04-.3.02-.59.03-.89.03-.25,0-.52-.01-.8-.02-.78-.04-1.57-.13-2.35-.29-.62-.12-1.24-.28-1.85-.49-1.61-.52-3.17-1.32-4.6-2.39l-17.1-12.8v-.01l26.69-19.99,106.22-79.56c27.41-20.53,43.78-53.22,43.78-87.43v-103.13c0-8.84,7.16-16,16-16,2.49,0,4.84.57,6.94,1.58.13.06.25.12.38.19.22.11.42.22.63.35.35.19.69.4,1.02.62.13.09.25.18.38.28.14.09.28.2.42.31.13.1.26.2.39.31.28.23.56.47.83.73.21.19.41.39.6.6,0,0,.01.01.02.02.25.26.49.53.72.81l.02.02c.23.28.44.56.65.85.21.3.42.6.61.91.09.14.17.28.25.42.3.51.57,1.04.8,1.59.06.14.12.29.18.44.21.51.39,1.03.54,1.56.1.35.19.71.27,1.07.07.36.14.73.19,1.1.03.18.05.37.07.55.01.13.03.26.04.39.03.43.05.86.05,1.3h0Z" fill="#9aa0a6"/></g>',
    serverless: '<g><rect width="512" height="512" fill="none"/></g><g><path d="M131.231,231.327c-8.624,0-15.615-6.991-15.615-15.615,0-77.664,63.184-140.848,140.848-140.848,50.121,0,96.865,26.977,121.989,70.403,4.319,7.465,1.769,17.017-5.696,21.336-7.463,4.318-17.018,1.769-21.336-5.696-19.561-33.809-55.947-54.812-94.958-54.812-60.443,0-109.617,49.175-109.617,109.617,0,8.624-6.991,15.615-15.615,15.615h0Z" fill="#9aa0a6"/><path d="M367.043,396.54H99.846c-8.624,0-15.615-6.991-15.615-15.615s6.991-15.615,15.615-15.615h267.197c33.485,0,60.726-27.241,60.726-60.726,0-15.521-5.882-30.304-16.561-41.628-5.918-6.273-5.628-16.157.646-22.074,6.273-5.918,16.158-5.628,22.074.646,16.168,17.142,25.072,39.536,25.072,63.055,0,50.705-41.252,91.957-91.957,91.957Z" fill="#9aa0a6"/><path d="M287.229,177.923c-8.624,0-15.615-6.991-15.615-15.615s6.991-15.615,15.615-15.615h78.077v-78.077c0-8.624,6.991-15.615,15.615-15.615s15.615,6.991,15.615,15.615v93.691c0,8.624-6.991,15.615-15.615,15.615h-93.692Z" fill="#4285f4"/><path d="M162.306,459c-3.997,0-7.993-1.524-11.042-4.574l-62.46-62.462c-6.099-6.098-6.098-15.985,0-22.083l62.462-62.462c6.098-6.098,15.985-6.098,22.083,0,6.099,6.098,6.099,15.985,0,22.083l-51.42,51.42,51.418,51.42c6.099,6.098,6.098,15.985,0,22.083-3.049,3.049-7.045,4.574-11.042,4.574h.001Z" fill="#4285f4"/><path d="M433.928,241.527c-5.918-6.276-15.801-6.563-22.074-.644-6.274,5.918-6.562,15.8-.644,22.073,10.678,11.321,16.559,26.104,16.559,41.627,0,33.485-27.24,60.726-60.723,60.726l-32.967-.002-.004,31.231,32.971.002c50.703,0,91.954-41.251,91.954-91.957,0-23.522-8.904-45.917-25.072-63.056h0Z" fill="#4285f4"/><path d="M147.853,200.839s-18.025-2.405-31.741,3.013c-.062.024-.114.049-.173.073-15.782,4.791-30.045,13.929-41.048,26.514-14.116,16.146-21.891,36.86-21.891,58.324v14.034c0,8.625,6.991,15.615,15.615,15.615s15.615-6.991,15.615-15.615v-14.034c0-28.386,21.158-52.826,49.218-56.851,8.044-1.154,13.767-8.247,13.376-16.205.01.001.022.003.022.003,0,0,.248-10.096,1.007-14.873v.002Z" fill="#4285f4"/></g>',
    vertex: '<g><path d="M128,244.99c-8.84,0-16-7.16-16-16v-95.97c0-8.84,7.16-16,16-16s16,7.16,16,16v95.97c0,8.84-7.16,16-16,16Z" fill="#ea4335"/><path d="M256,458c-2.98,0-5.97-.83-8.59-2.5l-186-122c-7.46-4.74-9.65-14.63-4.91-22.09,4.75-7.46,14.64-9.65,22.09-4.91l177.41,116.53,177.41-116.53c7.45-4.74,17.34-2.55,22.09,4.91,4.74,7.46,2.55,17.34-4.91,22.09l-186,122c-2.62,1.67-5.61,2.5-8.59,2.5Z" fill="#fbbc04"/><path d="M256,388.03c-8.84,0-16-7.16-16-16v-73.06c0-8.84,7.16-16,16-16s16,7.16,16,16v73.06c0,8.84-7.16,16-16,16Z" fill="#34a853"/><circle cx="128" cy="70" r="16" fill="#ea4335"/><circle cx="128" cy="292" r="16" fill="#ea4335"/><path d="M384.23,308.01c-8.82,0-15.98-7.14-16-15.97l-.23-94.01c-.02-8.84,7.13-16.02,15.97-16.03h.04c8.82,0,15.98,7.14,16,15.97l.23,94.01c.02,8.84-7.13,16.02-15.97,16.03h-.04Z" fill="#4285f4"/><circle cx="384" cy="70" r="16" fill="#4285f4"/><circle cx="384" cy="134" r="16" fill="#4285f4"/><path d="M320,220.36c-8.84,0-16-7.16-16-16v-103.02c0-8.84,7.16-16,16-16s16,7.16,16,16v103.02c0,8.84-7.16,16-16,16Z" fill="#fbbc04"/><circle cx="256" cy="171" r="16" fill="#34a853"/><circle cx="256" cy="235" r="16" fill="#34a853"/><circle cx="320" cy="265" r="16" fill="#fbbc04"/><circle cx="320" cy="329" r="16" fill="#fbbc04"/><path d="M192,217.36c-8.84,0-16-7.16-16-16v-100.02c0-8.84,7.16-16,16-16s16,7.16,16,16v100.02c0,8.84-7.16,16-16,16Z" fill="#fbbc04"/><circle cx="192" cy="265" r="16" fill="#fbbc04"/><circle cx="192" cy="329" r="16" fill="#fbbc04"/></g>',
  },
  ask: {
    question: "A team wants answers from 40,000 internal PDFs through a managed service, without building its own indexing. Which product?",
    answer: "as",
    why: "It takes in the documents directly. Agent Retrieval stores embeddings, but the team would still extract and load the content.",
  },
  checkpoint: { id: "observe-managed-search" },
};

FlowKit.mount(SPEC);
