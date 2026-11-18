// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

import type { CompiledDiagram } from "../../core/src/index.ts";
import { DESIGN_TOKENS } from "../../core/src/palettes.ts";

export interface BuildPlayerOptions {
  flowId?: string;
  compactInline?: boolean;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPlayableLmsHtml(compiled: CompiledDiagram, opts: BuildPlayerOptions = {}): string {
  const flowId = opts.flowId ?? "bentoflow-lesson";
  const compact = Boolean(opts.compactInline);
  const { spec, layout, innerSvgBody } = compiled;
  const hasGuardrailMatrix = spec.steps.some((s) => Boolean(s.threat || s.guardrail || s.mechanism));
  const stageMaxH = compact ? (hasGuardrailMatrix ? "272px" : "325px") : "620px";

  const specJson = JSON.stringify({
    flowId,
    title: spec.title,
    subtitle: spec.subtitle ?? "",
    footerNote: spec.footerNote ?? "",
    edges: spec.edges,
    steps: spec.steps,
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(spec.title)} — Interactive Flow Player</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: ${compact ? "2px" : "12px"};
      font-family: ${DESIGN_TOKENS.fontFamily};
      background: ${compact ? "transparent" : "#f1f5f9"};
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .bf-player-shell {
      max-width: 1160px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .bf-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }
    .bf-step-pills {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }
    .bf-pill {
      appearance: none;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 999px;
      cursor: pointer;
      transition: all 140ms ease;
    }
    .bf-pill:hover { background: #f1f5f9; border-color: #94a3b8; }
    .bf-pill.active { background: #1a73e8; border-color: #1a73e8; color: #ffffff; }
    .bf-pill.visited:not(.active) { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
    .bf-controls {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .bf-btn {
      appearance: none;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      font-size: 11.5px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background 140ms ease;
    }
    .bf-btn:hover { background: #f1f5f9; }
    .bf-btn-primary {
      background: #1a73e8;
      border-color: #1a73e8;
      color: #ffffff;
      min-width: 72px;
      justify-content: center;
    }
    .bf-btn-primary:hover { background: #1557b0; }
    .bf-stage {
      position: relative;
      width: 100%;
      background: #ffffff;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      max-height: ${stageMaxH};
    }
    .bf-stage svg {
      width: 100%;
      height: auto;
      max-height: ${stageMaxH};
      display: block;
    }
    .bf-card, .bf-edge { transition: opacity 220ms ease; }
    .bf-card-ring { transition: opacity 180ms ease; }
    .bf-narration-dock {
      padding: ${compact ? "8px 12px" : "12px 16px"};
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .bf-narration-badge {
      display: inline-block;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 2px 7px;
      border-radius: 6px;
      background: #dbeafe;
      color: #1d4ed8;
      margin-right: 7px;
    }
    .bf-narration-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .bf-narration-body {
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }
    .bf-hud-grid {
      display: none;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .bf-hud-grid.visible { display: grid; }
    .bf-hud-cell {
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
    }
    .bf-hud-cell-threat {
      background: #fef2f2;
      border-color: #fecaca;
    }
    .bf-hud-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.45px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .bf-hud-cell-threat .bf-hud-label { color: #b91c1c; }
    .bf-hud-val {
      font-size: 11.5px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.32;
    }
    .bf-status-chip {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 999px;
      background: #dcfce7;
      color: #15803d;
      white-space: nowrap;
      display: none;
    }
    .bf-status-chip.visible { display: inline-block; }
  </style>
</head>
<body>
  <div class="bf-player-shell" tabindex="0" id="bf-root" aria-label="${escapeHtml(spec.title)} interactive flow player">
    <div class="bf-topbar">
      <div class="bf-step-pills" id="bf-pills"></div>
      <div class="bf-controls">
        <button class="bf-btn" id="bf-prev" title="Previous Scenario (Left Arrow)">&#9664; Prev</button>
        <button class="bf-btn bf-btn-primary" id="bf-play" title="Simulate All Scenarios (Space)">&#9654; Simulate</button>
        <button class="bf-btn" id="bf-next" title="Next Scenario (Right Arrow)">Next &#9654;</button>
        <button class="bf-btn" id="bf-speed" title="Simulation Speed">1x</button>
        <span class="bf-status-chip" id="bf-complete-badge">&#10003; All Verified</span>
      </div>
    </div>

    <div class="bf-stage">
      <svg id="bf-svg" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg" style="font-family: ${escapeHtml(DESIGN_TOKENS.fontFamily)};">
        ${innerSvgBody}
        <g id="bf-packets-layer"></g>
      </svg>
    </div>

    <div class="bf-narration-dock" aria-live="polite">
      <div id="bf-overview-box">
        <div class="bf-narration-title">
          <span class="bf-narration-badge" id="bf-narr-step">Defense-in-Depth</span>
          <span id="bf-narr-headline">${escapeHtml(spec.title)}</span>
        </div>
        <div class="bf-narration-body" id="bf-narr-body">${escapeHtml(spec.footerNote || "Press Simulate or pick any step above to watch each guardrail intercept its target threat.")}</div>
      </div>
      <div class="bf-hud-grid" id="bf-hud-grid">
        <div class="bf-hud-cell bf-hud-cell-threat">
          <div class="bf-hud-label">&#9888; Threat Simulated</div>
          <div class="bf-hud-val" id="bf-hud-threat"></div>
        </div>
        <div class="bf-hud-cell" id="bf-hud-guard-cell">
          <div class="bf-hud-label" id="bf-hud-guard-lbl">&#128737; Guardrail Layer</div>
          <div class="bf-hud-val" id="bf-hud-guard"></div>
        </div>
        <div class="bf-hud-cell" id="bf-hud-mech-cell">
          <div class="bf-hud-label">&#9881; Mechanism</div>
          <div class="bf-hud-val" id="bf-hud-mech"></div>
        </div>
      </div>
    </div>
  </div>

  <script id="bf-spec-data" type="application/json">${specJson}</script>
  <script>
    (function() {
      const data = JSON.parse(document.getElementById("bf-spec-data").textContent);
      const steps = data.steps || [];
      const edgeMap = new Map((data.edges || []).map((e) => [e.id, e]));
      const svg = document.getElementById("bf-svg");
      const packetsLayer = document.getElementById("bf-packets-layer");
      const pillsEl = document.getElementById("bf-pills");
      const btnPlay = document.getElementById("bf-play");
      const btnPrev = document.getElementById("bf-prev");
      const btnNext = document.getElementById("bf-next");
      const btnSpeed = document.getElementById("bf-speed");
      const overviewBox = document.getElementById("bf-overview-box");
      const narrStep = document.getElementById("bf-narr-step");
      const narrHead = document.getElementById("bf-narr-headline");
      const narrBody = document.getElementById("bf-narr-body");
      const hudGrid = document.getElementById("bf-hud-grid");
      const hudThreat = document.getElementById("bf-hud-threat");
      const hudGuard = document.getElementById("bf-hud-guard");
      const hudGuardCell = document.getElementById("bf-hud-guard-cell");
      const hudGuardLbl = document.getElementById("bf-hud-guard-lbl");
      const hudMech = document.getElementById("bf-hud-mech");
      const completeBadge = document.getElementById("bf-complete-badge");
      const rootEl = document.getElementById("bf-root");

      let stepIdx = null;
      let playing = false;
      let speed = 1;
      let rafId = 0;
      const visitedSteps = new Set();

      function emitLmsEvent(type, extra) {
        const payload = Object.assign({
          type,
          flowId: data.flowId,
          totalSteps: steps.length,
          visitedAllSteps: steps.length > 0 && visitedSteps.size >= steps.length
        }, extra || {});
        if (window.parent && window.parent !== window) {
          try { window.parent.postMessage(payload, "*"); } catch (e) {}
        }
        if (type === "BENTOFLOW_COMPLETED") {
          const qp = new URLSearchParams(window.location.search);
          const endpoint = qp.get("endpoint"), auth = qp.get("auth"), actor = qp.get("actor");
          if (endpoint && auth && actor) {
            fetch(endpoint.replace(/\\/+$/, "") + "/statements", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": auth, "X-Experience-API-Version": "1.0.3" },
              body: JSON.stringify({
                actor: JSON.parse(actor),
                verb: { id: "http://adlnet.gov/expapi/verbs/completed", display: { "en-US": "completed" } },
                object: { id: window.location.href.split("?")[0], definition: { name: { "en-US": data.title } } }
              })
            }).catch(function() {});
          }
        }
      }

      function renderPills() {
        pillsEl.innerHTML = "";
        const ov = document.createElement("button");
        ov.className = "bf-pill" + (stepIdx === null ? " active" : "");
        ov.textContent = "All Layers";
        ov.onclick = function() { stopAnim(); stepIdx = null; playing = false; updateVisualState(); };
        pillsEl.appendChild(ov);

        steps.forEach(function(st, idx) {
          const b = document.createElement("button");
          b.className = "bf-pill" + (stepIdx === idx ? " active" : "") + (visitedSteps.has(st.stepNumber) ? " visited" : "");
          b.textContent = st.pillLabel || ("Step " + st.stepNumber);
          b.title = st.narrationTitle;
          b.onclick = function() { stopAnim(); playing = false; stepIdx = idx; startStepAnimation(); };
          pillsEl.appendChild(b);
        });
      }

      function stopAnim() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
      function clearPackets() { while (packetsLayer.firstChild) packetsLayer.removeChild(packetsLayer.firstChild); }

      function updateVisualState() {
        btnPlay.innerHTML = playing ? "&#10074;&#10074; Pause" : "&#9654; Simulate";
        renderPills();
        const cards = svg.querySelectorAll(".bf-card");
        const edges = svg.querySelectorAll(".bf-edge");

        if (stepIdx === null || !steps[stepIdx]) {
          clearPackets();
          cards.forEach(function(c) {
            c.style.opacity = "1";
            const ring = c.querySelector(".bf-card-ring");
            if (ring) ring.setAttribute("opacity", "0");
          });
          edges.forEach(function(e) { e.style.opacity = "1"; });
          overviewBox.style.display = "block";
          hudGrid.classList.remove("visible");
          narrStep.textContent = "Overview";
          narrHead.textContent = data.title;
          narrBody.textContent = data.footerNote || "Press Simulate or click any step pill above to test each defense layer.";
          return;
        }

        const curStep = steps[stepIdx];
        if (curStep.threat && curStep.guardrail && curStep.mechanism) {
          overviewBox.style.display = "none";
          hudGrid.classList.add("visible");
          hudThreat.textContent = curStep.threat;
          hudGuard.textContent = curStep.guardrail;
          hudMech.textContent = curStep.mechanism;
          const firstEdge = edgeMap.get((curStep.activeEdgeIds || [])[0]);
          const rawAccent = (firstEdge && firstEdge.color) || "#1a73e8";
          const accent = /^#[0-9a-fA-F]{6}$/.test(rawAccent) ? rawAccent : "#1a73e8";
          hudGuardCell.style.borderColor = accent;
          hudGuardCell.style.background = accent + "12";
          hudGuardLbl.style.color = accent;
        } else {
          overviewBox.style.display = "block";
          hudGrid.classList.remove("visible");
          narrStep.textContent = "Step " + curStep.stepNumber + " / " + steps.length;
          narrHead.textContent = curStep.narrationTitle + (curStep.packetLabel ? "  ·  [" + curStep.packetLabel + "]" : "");
          narrBody.textContent = curStep.narrationBody;
        }

        const activeEdges = new Set(curStep.activeEdgeIds || []);
        const activeNodes = new Set();
        activeEdges.forEach(function(eid) {
          const ed = edgeMap.get(eid);
          if (ed) { activeNodes.add(ed.from); activeNodes.add(ed.to); }
        });

        const priorEdges = new Set();
        const priorNodes = new Set();
        for (let k = 0; k < stepIdx; k++) {
          (steps[k].activeEdgeIds || []).forEach(function(eid) {
            priorEdges.add(eid);
            const ed = edgeMap.get(eid);
            if (ed) { priorNodes.add(ed.from); priorNodes.add(ed.to); }
          });
        }

        cards.forEach(function(c) {
          const cid = c.getAttribute("data-card-id");
          const ring = c.querySelector(".bf-card-ring");
          if (activeNodes.has(cid)) {
            c.style.opacity = "1";
            if (ring) ring.setAttribute("opacity", "1");
          } else if (priorNodes.has(cid)) {
            c.style.opacity = "0.80";
            if (ring) ring.setAttribute("opacity", "0");
          } else {
            c.style.opacity = "0.24";
            if (ring) ring.setAttribute("opacity", "0");
          }
        });

        edges.forEach(function(e) {
          const eid = e.getAttribute("data-edge-id");
          if (activeEdges.has(eid)) e.style.opacity = "1";
          else if (priorEdges.has(eid)) e.style.opacity = "0.72";
          else e.style.opacity = "0.18";
        });
      }

      function renderSingleToken(eid, localT, reverse, tokenColor, glyphText) {
        const ns = "http://www.w3.org/2000/svg";
        const wire = svg.querySelector('path.bf-edge-wire[data-edge-id="' + eid + '"]');
        if (!wire) return;
        const total = wire.getTotalLength();
        if (!total) return;
        const dist = (reverse ? (1 - localT) : localT) * total;
        const pt = wire.getPointAtLength(dist);
        const col = tokenColor || wire.getAttribute("stroke") || "#1a73e8";

        const g = document.createElementNS(ns, "g");
        g.setAttribute("transform", "translate(" + pt.x.toFixed(1) + "," + pt.y.toFixed(1) + ")");

        if (localT > 0.84) {
          const rippleR = 12 + (localT - 0.84) * 95;
          const ripple = document.createElementNS(ns, "circle");
          ripple.setAttribute("r", rippleR.toFixed(1));
          ripple.setAttribute("fill", "none");
          ripple.setAttribute("stroke", col);
          ripple.setAttribute("stroke-width", "2.4");
          ripple.setAttribute("opacity", String(Math.max(0, 1 - (localT - 0.84) / 0.16)));
          g.appendChild(ripple);
        }

        const dot = document.createElementNS(ns, "circle");
        dot.setAttribute("r", "11.5");
        dot.setAttribute("fill", col);
        dot.setAttribute("stroke", "#ffffff");
        dot.setAttribute("stroke-width", "2");
        dot.setAttribute("filter", "url(#bf-packet-glow)");
        g.appendChild(dot);

        const txt = document.createElementNS(ns, "text");
        txt.setAttribute("y", "3.8");
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("font-size", "11");
        txt.setAttribute("font-weight", "800");
        txt.setAttribute("fill", "#ffffff");
        txt.textContent = glyphText;
        g.appendChild(txt);

        packetsLayer.appendChild(g);
      }

      function drawPacketsAtProgress(curStep, t) {
        clearPackets();
        const eids = curStep.activeEdgeIds || [];
        if (curStep.sequentialEdges && eids.length >= 2) {
          const k = eids.length;
          const segIdx = Math.min(k - 1, Math.floor(t * k));
          const localT = Math.min(1, t * k - segIdx);
          const isThreatHop = Boolean(curStep.threat) && segIdx === 0;
          renderSingleToken(
            eids[segIdx],
            localT,
            Boolean(curStep.reverse),
            isThreatHop ? "#dc2626" : null,
            isThreatHop ? "!" : "\u2713"
          );
          return;
        }
        eids.forEach(function(eid) {
          renderSingleToken(eid, t, Boolean(curStep.reverse), null, String(curStep.stepNumber));
        });
      }

      function startStepAnimation() {
        stopAnim();
        if (stepIdx === null || !steps[stepIdx]) { updateVisualState(); return; }
        const curStep = steps[stepIdx];
        visitedSteps.add(curStep.stepNumber);
        if (visitedSteps.size >= steps.length) completeBadge.classList.add("visible");
        updateVisualState();
        emitLmsEvent("BENTOFLOW_STEP_VIEWED", { stepNumber: curStep.stepNumber });

        const dur = (curStep.durationMs || 1600) / speed;
        const startTs = performance.now();
        function frame(now) {
          const t = Math.min(1, (now - startTs) / dur);
          drawPacketsAtProgress(curStep, t);
          if (t < 1) {
            rafId = requestAnimationFrame(frame);
          } else if (playing) {
            if (stepIdx + 1 < steps.length) {
              stepIdx += 1;
              startStepAnimation();
            } else {
              playing = false;
              updateVisualState();
              emitLmsEvent("BENTOFLOW_COMPLETED");
            }
          }
        }
        rafId = requestAnimationFrame(frame);
      }

      btnPlay.onclick = function() {
        if (steps.length === 0) return;
        if (playing) {
          playing = false;
          stopAnim();
          updateVisualState();
        } else {
          if (stepIdx === null || stepIdx >= steps.length - 1) stepIdx = 0;
          playing = true;
          startStepAnimation();
        }
      };
      btnPrev.onclick = function() {
        if (steps.length === 0) return;
        playing = false;
        stepIdx = stepIdx === null ? 0 : Math.max(0, stepIdx - 1);
        startStepAnimation();
      };
      btnNext.onclick = function() {
        if (steps.length === 0) return;
        playing = false;
        stepIdx = stepIdx === null ? 0 : Math.min(steps.length - 1, stepIdx + 1);
        startStepAnimation();
      };
      btnSpeed.onclick = function() {
        speed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 0.5 === speed ? 1 : 0.5;
        btnSpeed.textContent = speed + "x";
      };
      rootEl.addEventListener("keydown", function(ev) {
        if (ev.key === " ") { ev.preventDefault(); btnPlay.click(); }
        else if (ev.key === "ArrowRight") { ev.preventDefault(); btnNext.click(); }
        else if (ev.key === "ArrowLeft") { ev.preventDefault(); btnPrev.click(); }
        else if (ev.key === "Home") { ev.preventDefault(); stopAnim(); playing = false; stepIdx = null; updateVisualState(); }
      });

      updateVisualState();
      emitLmsEvent("BENTOFLOW_READY");
    })();
  </script>
</body>
</html>`;
}
