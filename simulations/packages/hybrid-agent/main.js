(function () {
  var sim = typeof window.createSim === "function"
    ? window.createSim({
        onInit: function (opts) {
          var theme = (opts && opts.theme) || "system";
          if (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            theme = "dark";
          }
          document.documentElement.dataset.theme = theme;
          if (opts && opts.reducedMotion) {
            document.documentElement.dataset.reducedMotion = "true";
          }
          notifyResize();
        },
      })
    : null;

  function notifyResize() {
    if (!sim) return;
    requestAnimationFrame(function () {
      sim.resize(document.documentElement.scrollHeight);
    });
  }

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
            fetch(endpoint.replace(/\/+$/, "") + "/statements", {
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
            isThreatHop ? "!" : "✓"
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

  // Bridge completion badge & visibility pause to LMS sim-sdk
  var badge = document.getElementById("bf-complete-badge");
  if (badge && sim && typeof MutationObserver !== "undefined") {
    var doneSent = false;
    new MutationObserver(function () {
      if (!doneSent && badge.classList.contains("visible")) {
        doneSent = true;
        sim.checkpoint("complete");
      }
      notifyResize();
    }).observe(badge, { attributes: true, attributeFilter: ["class"] });
  }

  var dock = document.querySelector(".bf-narration-dock");
  if (dock && sim && typeof MutationObserver !== "undefined") {
    new MutationObserver(notifyResize).observe(dock, { childList: true, subtree: true, characterData: true });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && typeof playing !== "undefined" && playing) {
      var playBtn = document.getElementById("bf-play");
      if (playBtn) playBtn.click();
    }
  });

  window.addEventListener("load", notifyResize);
})();
