// createSim is a global from sim-sdk.js (classic script). Drag a value and see how each
// float format represents it. The point: bf16 keeps fp32's full 8-bit exponent (same
// dynamic range) but drops mantissa bits (precision) at half the bytes — the trade ML
// training wants; fp16 spends bits on precision and breaks at the extremes; fp4 (E2M1)
// is the extreme — 1 mantissa bit, range ~0.5–6 — so it needs value scaling to be usable.
// Deterministic, theme-aware, no CDNs.
const app = document.getElementById("app");

const FORMATS = [
  { id: "fp32", label: "FP32", sign: 1, exp: 8, mant: 23, bytes: 4 },
  { id: "bf16", label: "BF16", sign: 1, exp: 8, mant: 7, bytes: 2 },
  { id: "fp16", label: "FP16", sign: 1, exp: 5, mant: 10, bytes: 2 },
  { id: "fp4", label: "FP4 (E2M1)", sign: 1, exp: 2, mant: 1, bytes: 0.5 },
];
// OCP-standard FP4 = E2M1: representable magnitudes {0.5, 1, 1.5, 2, 3, 4, 6}; max 6.
const FP4_SET = [0.5, 1, 1.5, 2, 3, 4, 6];

let L = 0; // value = 10^L
let observed = false;

function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8)); }
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function fmtNum(v) {
  if (v >= 1e4 || v < 1e-3) return v.toExponential(1);
  return (Math.round(v * 1000) / 1000).toString();
}
function repr(v, f) {
  const a = Math.abs(v);
  if (f.id === "fp32") return { ok: true, errPct: 0.000006 };
  if (f.id === "bf16") return { ok: true, errPct: 0.39 }; // ~2^-8; range = fp32's
  if (f.id === "fp16") {
    // 5-bit exponent → normal max 65504, subnormals to ~6e-8
    if (a > 65504) return { ok: false, status: "OVERFLOW → ∞" };
    if (a !== 0 && a < 6e-8) return { ok: false, status: "UNDERFLOW → 0" };
    return { ok: true, errPct: 0.05 }; // ~2^-11
  }
  // fp4 (E2M1): tiny range, 1 mantissa bit → rounds hard
  if (a > 6) return { ok: false, status: "OVERFLOW → ∞" };
  if (a !== 0 && a < 0.5) return { ok: false, status: "UNDERFLOW → 0" };
  const nearest = FP4_SET.reduce((p, c) => (Math.abs(c - a) < Math.abs(p - a) ? c : p));
  const errPct = a > 0 ? +(Math.abs(nearest - a) / a * 100).toFixed(0) : 0;
  return { ok: true, errPct, rounded: nearest };
}

function strip(f) {
  let cells = `<span class="bit sign" title="sign"></span>`;
  cells += Array(f.exp).fill('<span class="bit exp"></span>').join("");
  cells += Array(f.mant).fill('<span class="bit mant"></span>').join("");
  return cells;
}

// The slider and presets are built and wired once (mount), never rebuilt: rebuilding them
// on every input event took keyboard focus off the slider after one step and cut drags
// short. render() refreshes only the label and the outputs (#59).
let mounted = false;
function mount() {
  app.innerHTML = `
    <div class="hint">Drag the value. <b>bf16</b> keeps fp32's full <b>8-bit exponent</b> (same range) but only 7 mantissa bits — <b>half the bytes</b>. <b>fp16</b> trades range for precision; <b>fp4</b> (E2M1) packs it into <b>4 bits</b> — great throughput, tiny range.</div>

    <div class="slider">
      <label for="L">value = 10<sup id="L-exp"></sup> = <b id="L-val"></b></label>
      <input id="L" type="range" min="-10" max="10" step="0.1" value="${L}">
      <div class="presets">
        <button data-l="-7">tiny gradient (1e-7)</button>
        <button data-l="0">≈1</button>
        <button data-l="5">big activation (1e5)</button>
      </div>
    </div>

    <div class="cards" id="cards"></div>

    <div class="range" id="range"></div>

    <div class="readout" id="readout" role="status"></div>`;

  app.querySelector("#L").addEventListener("input", (e) => setL(+e.target.value));
  app.querySelectorAll(".presets button").forEach((b) => b.addEventListener("click", () => setL(+b.getAttribute("data-l"))));
  mounted = true;
}

/** Set the value (from the slider or a preset) and redraw. */
function setL(next) {
  L = next;
  render();
}

function render() {
  if (!mounted) mount();
  const v = Math.pow(10, L);
  const reps = FORMATS.map((f) => ({ f, r: repr(v, f) }));
  const fp16fail = !reps[2].r.ok;
  const fp4fail = !reps[3].r.ok;
  if ((fp16fail || fp4fail) && !observed) { observed = true; sim.checkpoint("observe-overflow"); }

  // range axis log10 from -45..38
  const lo = -45, hi = 38, pos = (x) => ((x - lo) / (hi - lo)) * 100;
  const wideL = pos(-45), wideR = pos(38);
  const f16L = pos(-7.2), f16R = pos(4.8); // ~6e-8 .. 65504
  const f4L = pos(Math.log10(0.5)), f4R = pos(Math.log10(6)); // ~0.5 .. 6
  const mark = Math.max(0, Math.min(100, pos(L)));

  const cards = reps.map(({ f, r }) => `
    <div class="card ${f.id} ${!r.ok ? "fail" : ""}">
      <div class="chead"><b>${f.label}</b> <span class="bytes">${f.bytes} bytes</span></div>
      <div class="strip">${strip(f)}</div>
      <div class="counts"><span class="ce">${f.exp} exp</span> · <span class="cm">${f.mant} mantissa</span></div>
      <div class="val">${r.ok ? `≈ ${fmtNum(r.rounded ?? v)}` : `<span class="bad">${r.status}</span>`}</div>
      <div class="err">${r.ok ? (r.errPct < 0.001 ? "exact" : `±${r.errPct}% rounding`) : "can't represent"}</div>
    </div>`).join("");

  // A preset moves the slider too; the slider itself already shows its own value.
  const input = app.querySelector("#L");
  if (+input.value !== L) input.value = String(L);
  app.querySelector("#L-exp").textContent = L.toFixed(1);
  app.querySelector("#L-val").textContent = fmtNum(v);

  app.querySelector("#cards").innerHTML = cards;

  app.querySelector("#range").innerHTML = `
      <div class="rlabel">dynamic range (log scale)</div>
      <div class="raxis">
        <div class="rbar wide" style="left:${wideL}%;width:${wideR - wideL}%"><span>fp32 / bf16</span></div>
        <div class="rbar narrow" style="left:${f16L}%;width:${f16R - f16L}%"><span>fp16</span></div>
        <div class="rbar tiny" style="left:${f4L}%;width:${Math.max(f4R - f4L, 1.5)}%"><span>fp4</span></div>
        <div class="rmark ${fp16fail ? "out" : ""}" style="left:${mark}%"></div>
      </div>`;

  app.querySelector("#readout").innerHTML = `
      ${
        fp16fail
          ? `<span class="bad">fp16 can't hold this value</span> — its 5-bit exponent is too narrow. <b>bf16 still works</b>, because it kept fp32's 8-bit exponent. That range is why ML picked bf16.`
          : `bf16 represents this within <b>±0.39%</b> — coarser than fp16, but ML training averages that out. What it can't lose is <b>range</b>: gradients span ~1e-7 to activations ~1e5, and only an 8-bit exponent covers both.`
      } <b>fp4 (E2M1)</b> has just 1 mantissa bit and a ~0.5–6 range, so it overflows or rounds almost everything raw — in practice values are <b>scaled into range</b> first. At ¼ the bytes of bf16, that's the throughput bet. The matrix unit multiplies in low precision but <b>accumulates in fp32</b>, so rounding doesn't pile up.`;

  reportSize();
}

const sim = createSim({ onInit({ theme }) { applyTheme(theme); render(); } });
setTimeout(() => { if (!sim.isInitialized() && app.innerHTML === "") render(); }, 300);
