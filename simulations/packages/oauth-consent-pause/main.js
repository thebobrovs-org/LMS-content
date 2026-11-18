/* global createSim */
(function () {
  "use strict";

  var app = document.getElementById("app");

  var PREDICT_OPTIONS = [
    { id: "agent", label: "The ADK agent" },
    { id: "app", label: "The client app" },
    { id: "auth", label: "Only the Auth Server" }
  ];

  var FLOWS = {
    "3lo": {
      id: "3lo",
      label: "3LO: User mailbox",
      authority: "User authority (3-legged OAuth)",
      steps: [
        {
          id: 1,
          title: "1. Agent pauses",
          packet: "adk_request_credential",
          from: "agent",
          to: "app",
          token: false,
          caption:
            "ADK Agent wants to call draft_reply, sees no user token, and pauses by emitting adk_request_credential (FunctionCall with auth_config and auth_uri) to the Client App."
        },
        {
          id: 2,
          title: "2. App redirects",
          packet: "redirect → auth_uri",
          from: "app",
          to: "user",
          token: false,
          caption:
            "The Client App redirects the User's browser to auth_uri. The ADK Agent stays paused and never asks the user for a password."
        },
        {
          id: 3,
          title: "3. Consent at Auth",
          packet: "password + consent",
          from: "user",
          to: "auth",
          bypassBoundary: true,
          token: false,
          caption:
            "The User signs in and grants mail.compose directly on the Auth Server — outside the amber Credential Boundary. The Auth Server sends a short-lived code back to redirect_uri."
        },
        {
          id: 4,
          title: "4. Code exchange",
          packet: "FunctionResponse(code)",
          from: "app",
          to: "agent",
          exchange: true,
          token: false,
          caption:
            "The Client App forwards the callback URL as a FunctionResponse for adk_request_credential. ADK exchanges the code with the Auth Server for a scoped access_token."
        },
        {
          id: 5,
          title: "5. Scoped retry",
          packet: "draft_reply(token)",
          from: "agent",
          to: "auth",
          token: true,
          caption:
            "ADK retries draft_reply with the user-scoped access_token. The tool acts only on this user's mailbox with least privilege."
        }
      ]
    },
    "2lo": {
      id: "2lo",
      label: "2LO: Agent bucket",
      authority: "Agent authority (2-legged OAuth)",
      steps: [
        {
          id: 1,
          title: "1. Client creds",
          packet: "client_credentials",
          from: "agent",
          to: "auth",
          token: false,
          caption:
            "For its own GCS bucket, the ADK Agent authenticates directly to the Auth Server with its own service credentials. The User and Client App redirect lanes stay idle."
        },
        {
          id: 2,
          title: "2. App token",
          packet: "agent access_token",
          from: "auth",
          to: "agent",
          token: true,
          caption:
            "The Auth Server issues an access_token for the agent's own identity. No user consent pause is needed when no user-owned resource is touched."
        },
        {
          id: 3,
          title: "3. Agent-only API",
          packet: "write_bucket(token)",
          from: "agent",
          to: "auth",
          token: true,
          caption:
            "The tool writes to the agent's GCS bucket. Warning: using 2LO for employee mailboxes would grant excessive agency across every user's mail."
        }
      ]
    }
  };

  var state = {
    flow: "3lo",
    step: 1,
    prediction: null,
    reachedConsent: false,
    checkpointFired: false,
    reducedMotion: false
  };

  var sim = null;

  function currentFlow() {
    return FLOWS[state.flow] || FLOWS["3lo"];
  }

  function currentStep() {
    var flow = currentFlow();
    var idx = Math.max(0, Math.min(flow.steps.length - 1, state.step - 1));
    return flow.steps[idx];
  }

  function maybeFireCheckpoint() {
    if (state.checkpointFired) return;
    if (state.flow === "3lo" && state.step === 5) {
      state.checkpointFired = true;
      if (sim && typeof sim.checkpoint === "function") {
        sim.checkpoint("observe-consent-pause");
      }
    }
  }

  function verdictText() {
    if (!state.reachedConsent || !state.prediction) return "";
    if (state.prediction === "auth") {
      return "Correct — only the Auth Server handles the user's password. The agent pauses with adk_request_credential, and the client app only redirects.";
    }
    if (state.prediction === "agent") {
      return "Not the agent — the ADK agent never sees the user's password. It pauses with adk_request_credential and waits for a scoped token.";
    }
    return "Not the client app — it redirects the user's browser to auth_uri and receives the callback code, never the password.";
  }

  function esc(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function laneY(lane) {
    if (lane === "user") return 47;
    if (lane === "app") return 123;
    if (lane === "agent") return 199;
    return 275;
  }

  function stepX(flowId, index, total) {
    if (flowId === "2lo") {
      return 255 + index * 145;
    }
    if (total === 5) {
      return 255 + index * 78;
    }
    return 255 + index * 95;
  }

  function buildDiagramSvg() {
    var flow = currentFlow();
    var step = currentStep();
    var is2lo = flow.id === "2lo";
    var userClass = is2lo ? "k-off" : "lane-user";
    var appClass = is2lo ? "k-off" : "lane-app";

    var svg = [];
    var ariaDesc =
      "Four-lane OAuth swimlane diagram showing " +
      flow.authority +
      ", step " +
      step.id +
      " of " +
      flow.steps.length +
      ": " +
      step.caption;

    svg.push(
      '<svg viewBox="0 0 720 326" role="img" aria-label="' + esc(ariaDesc) + '">'
    );
    svg.push("<defs>");
    svg.push(
      '<marker id="arr-now" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="var(--primary)"/></marker>'
    );
    svg.push(
      '<marker id="arr-done" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="var(--teal)"/></marker>'
    );
    svg.push(
      '<marker id="arr-token" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="var(--green)"/></marker>'
    );
    svg.push("</defs>");

    // Lanes
    var lanes = [
      { id: "user", y: 18, label: "User", sub: is2lo ? "Not involved (2LO)" : "Browser", cls: userClass },
      { id: "app", y: 94, label: "Client App", sub: is2lo ? "No redirect (2LO)" : "Host UI / Callback", cls: appClass },
      { id: "agent", y: 170, label: "ADK Agent", sub: "Runtime & Tool", cls: "lane-agent" },
      { id: "auth", y: 246, label: "Auth Server & API", sub: "OAuth + Resource", cls: "lane-auth" }
    ];

    for (var i = 0; i < lanes.length; i++) {
      var l = lanes[i];
      svg.push('<rect x="12" y="' + l.y + '" width="696" height="58" rx="8" class="' + l.cls + '"/>');
      svg.push('<text x="24" y="' + (l.y + 24) + '" class="k-title">' + esc(l.label) + "</text>");
      svg.push('<text x="24" y="' + (l.y + 42) + '" class="k-small">' + esc(l.sub) + "</text>");
      svg.push(
        '<line x1="166" y1="' +
          (l.y + 8) +
          '" x2="166" y2="' +
          (l.y + 50) +
          '" stroke="var(--border)" stroke-width="1"/>'
      );
    }

    // Amber Credential Boundary around Client App + ADK Agent
    svg.push('<rect x="172" y="88" width="430" height="146" rx="10" fill="none" class="boundary-line"/>');
    svg.push(
      '<text x="594" y="104" text-anchor="end" class="k-small" style="fill:var(--amber);font-weight:700;">Credential Boundary (no user password)</text>'
    );

    // Steps & arrows
    for (var sIdx = 0; sIdx < flow.steps.length; sIdx++) {
      var st = flow.steps[sIdx];
      var isPast = st.id < state.step;
      var isNow = st.id === state.step;
      if (!isPast && !isNow) continue;

      var x = stepX(flow.id, sIdx, flow.steps.length);
      var y1 = laneY(st.from);
      var y2 = laneY(st.to);

      var strokeCls = st.token ? "msg-token" : isNow ? "msg-now" : "msg-done";
      var markerId = st.token ? "arr-token" : isNow ? "arr-now" : "arr-done";
      var pillCls = st.token ? "pill-token" : isNow ? "pill-now" : "pill-done";

      if (st.bypassBoundary) {
        // Route outside the right edge of the Credential Boundary box (x=646)
        var bx = 646;
        svg.push(
          '<path d="M ' +
            x +
            " " +
            y1 +
            " L " +
            bx +
            " " +
            y1 +
            " L " +
            bx +
            " " +
            y2 +
            " L " +
            (x + 28) +
            " " +
            y2 +
            '" class="' +
            strokeCls +
            '" marker-end="url(#' +
            markerId +
            ')"/>'
        );
        // Pill on the outside vertical bypass (opaque panel backing so line doesn't cut through text)
        var py = 161;
        svg.push(
          '<rect x="' +
            (bx - 56) +
            '" y="' +
            (py - 14) +
            '" width="112" height="28" rx="6" fill="var(--panel)"/>'
        );
        svg.push(
          '<rect x="' +
            (bx - 56) +
            '" y="' +
            (py - 14) +
            '" width="112" height="28" rx="6" class="' +
            pillCls +
            '"/>'
        );
        svg.push(
          '<text x="' +
            bx +
            '" y="' +
            (py + 4) +
            '" text-anchor="middle" class="k-small k-code" style="fill:var(--fg);font-weight:600;">' +
            esc(st.packet) +
            "</text>"
        );
      } else {
        svg.push(
          '<line x1="' +
            x +
            '" y1="' +
            y1 +
            '" x2="' +
            x +
            '" y2="' +
            y2 +
            '" class="' +
            strokeCls +
            '" marker-end="url(#' +
            markerId +
            ')"/>'
        );
        var midY = Math.round((y1 + y2) / 2);
        var pw = Math.max(106, Math.round(st.packet.length * 6.4 + 16));
        svg.push(
          '<rect x="' +
            (x - pw / 2) +
            '" y="' +
            (midY - 13) +
            '" width="' +
            pw +
            '" height="26" rx="6" fill="var(--panel)"/>'
        );
        svg.push(
          '<rect x="' +
            (x - pw / 2) +
            '" y="' +
            (midY - 13) +
            '" width="' +
            pw +
            '" height="26" rx="6" class="' +
            pillCls +
            '"/>'
        );
        svg.push(
          '<text x="' +
            x +
            '" y="' +
            (midY + 4) +
            '" text-anchor="middle" class="k-small k-code" style="fill:var(--fg);font-weight:600;">' +
            esc(st.packet) +
            "</text>"
        );
      }

      // Origin node dot
      svg.push(
        '<circle cx="' +
          x +
          '" cy="' +
          y1 +
          '" r="5" fill="' +
          (isNow ? "var(--primary)" : st.token ? "var(--green)" : "var(--teal)") +
          '"/>'
      );

      // Step badge at bottom of Auth Server lane or top
      svg.push(
        '<text x="' +
          x +
          '" y="319" text-anchor="middle" class="k-small" style="' +
          (isNow ? "fill:var(--primary);font-weight:700;" : "") +
          '">' +
          esc(st.title) +
          "</text>"
      );
    }

    // If 3LO and step === 1 or 2, show "PAUSED" badge on ADK Agent
    if (!is2lo && (state.step === 1 || state.step === 2 || state.step === 3)) {
      svg.push('<rect x="480" y="185" width="96" height="24" rx="4" class="k-box k-now"/>');
      svg.push(
        '<text x="528" y="201" text-anchor="middle" class="k-small k-code" style="fill:var(--primary);font-weight:700;">PAUSED</text>'
      );
    }

    svg.push("</svg>");
    return svg.join("");
  }

  function render() {
    var flow = currentFlow();
    var step = currentStep();
    if (flow.id === "3lo" && state.step >= 3) {
      state.reachedConsent = true;
    }
    maybeFireCheckpoint();

    var html = [];

    // 1. Predict panel
    html.push('<section class="panel predict" aria-label="Prediction">');
    html.push(
      '<p class="q"><strong>Predict first:</strong> An agent needs to draft replies in each employee\'s mailbox. Who handles the user\'s password?</p>'
    );
    html.push('<div class="chips" role="group" aria-label="Who handles the password">');
    for (var i = 0; i < PREDICT_OPTIONS.length; i++) {
      var opt = PREDICT_OPTIONS[i];
      var pressed = state.prediction === opt.id ? "true" : "false";
      html.push(
        '<button type="button" class="chip" data-predict="' +
          opt.id +
          '" aria-pressed="' +
          pressed +
          '">' +
          esc(opt.label) +
          "</button>"
      );
    }
    html.push("</div>");
    html.push('<p class="verdict" role="status">' + esc(verdictText()) + "</p>");
    html.push("</section>");

    // 2. Stage panel
    html.push('<section class="panel stage" aria-label="OAuth flow diagram">');
    html.push(
      '<div class="scroll" tabindex="0" role="region" aria-label="Four-lane OAuth swimlane diagram">' +
        buildDiagramSvg() +
        "</div>"
    );
    html.push('<p class="caption" role="status">' + esc(step.caption) + "</p>");

    // Controls
    html.push('<div class="controls">');
    html.push('<div class="seg" role="group" aria-label="Authority flow">');
    html.push('<span class="seglabel">Flow:</span>');
    var flowKeys = ["3lo", "2lo"];
    for (var f = 0; f < flowKeys.length; f++) {
      var fk = flowKeys[f];
      var fPressed = state.flow === fk ? "true" : "false";
      html.push(
        '<button type="button" class="chip" data-flow="' +
          fk +
          '" aria-pressed="' +
          fPressed +
          '">' +
          esc(FLOWS[fk].label) +
          "</button>"
      );
    }
    html.push("</div>");

    html.push('<div class="buttons">');
    html.push('<button type="button" data-action="prev">Previous</button>');
    html.push(
      '<button type="button" class="primary" data-action="next">' +
        (state.step >= flow.steps.length ? "Replay" : "Next step") +
        "</button>"
    );
    html.push('<button type="button" data-action="reset">Reset</button>');
    html.push("</div>");
    html.push("</div>");

    var scopeNote =
      flow.id === "3lo"
        ? "Password stays on Auth Server · Scope: mail.compose"
        : "No user password · Agent service account only";
    html.push(
      '<p class="legend" style="margin-top:10px;"><strong>Readout:</strong> ' +
        esc(flow.id === "3lo" ? "User authority (3LO)" : "Agent authority (2LO)") +
        " · Step " +
        step.id +
        "/" +
        flow.steps.length +
        " · " +
        esc(scopeNote) +
        "</p>"
    );
    html.push("</section>");

    // 3. Legend
    html.push(
      '<p class="legend">Blue = current step · Violet = ADK Agent · Teal = Client App · Green = scoped token · Amber = Credential Boundary (password never crosses).</p>'
    );

    var focusAttr = saveFocus();
    app.innerHTML = html.join("");
    restoreFocus(focusAttr);

    if (sim && typeof sim.resize === "function") {
      requestAnimationFrame(function () {
        sim.resize(Math.ceil(app.scrollHeight));
      });
    }
  }

  function saveFocus() {
    var el = document.activeElement;
    if (!el || !app.contains(el)) return null;
    if (el.dataset.predict) return '[data-predict="' + el.dataset.predict + '"]';
    if (el.dataset.flow) return '[data-flow="' + el.dataset.flow + '"]';
    if (el.dataset.action) return '[data-action="' + el.dataset.action + '"]';
    return null;
  }

  function restoreFocus(selector) {
    if (!selector) return;
    var el = app.querySelector(selector);
    if (el) el.focus();
  }

  app.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.predict) {
      state.prediction = btn.dataset.predict;
      render();
      return;
    }
    if (btn.dataset.flow) {
      state.flow = btn.dataset.flow;
      state.step = 1;
      render();
      return;
    }
    var action = btn.dataset.action;
    var flow = currentFlow();
    if (action === "next") {
      if (state.step >= flow.steps.length) {
        state.step = 1;
      } else {
        state.step += 1;
      }
      render();
    } else if (action === "prev") {
      state.step = Math.max(1, state.step - 1);
      render();
    } else if (action === "reset") {
      state.flow = "3lo";
      state.step = 1;
      state.prediction = null;
      state.reachedConsent = false;
      render();
    }
  });

  function applyTheme(theme) {
    if (theme === "dark" || theme === "light") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function applyReducedMotion(reduced) {
    state.reducedMotion = Boolean(reduced);
    document.documentElement.classList.toggle("reduced", state.reducedMotion);
  }

  if (typeof createSim === "function") {
    sim = createSim({
      onInit: function (init) {
        if (init && init.props && init.props.flow && FLOWS[init.props.flow]) {
          state.flow = init.props.flow;
        }
        applyTheme(init && init.theme);
        applyReducedMotion(init && init.reducedMotion);
        render();
      },
      onTheme: function (theme) {
        applyTheme(theme);
      },
      onReducedMotion: function (reduced) {
        applyReducedMotion(reduced);
      }
    });
  }

  setTimeout(function () {
    if (!app.firstChild) {
      render();
    }
  }, 300);
})();
