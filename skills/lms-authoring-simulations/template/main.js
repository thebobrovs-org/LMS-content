// `createSim` is provided as a global by sim-sdk.js (loaded as a classic script
// before this one). No imports — this bundle runs in an opaque-origin sandbox.
//
// A minimal but complete example: click to increment; reaching the target fires
// the "reach-target" checkpoint. Demonstrates props, theme, render, resize,
// checkpoint, event, and the no-host fallback.

const app = document.getElementById("app");

let target = 5;
let count = 0;
let reached = false;

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme; // "system" → prefers-color-scheme
  }
}

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

function render() {
  const done = count >= target;
  app.innerHTML = `
    <p class="status ${done ? "done" : ""}" role="status">
      ${done ? `Target reached: ${count} / ${target}.` : `Count: ${count} / ${target}.`}
    </p>
    <div class="controls">
      <button id="inc" class="primary">Click me</button>
      <button id="reset">Reset</button>
    </div>`;

  app.querySelector("#inc").addEventListener("click", increment);
  app.querySelector("#reset").addEventListener("click", () => {
    count = 0;
    reached = false;
    render();
  });
  reportSize();
}

function increment() {
  count += 1;
  if (count >= target && !reached) {
    reached = true;
    sim.checkpoint("reach-target"); // fire once
  }
  sim.event("increment", { count });
  render();
}

const sim = createSim({
  onInit({ props, theme }) {
    const n = Number(props?.target);
    target = Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
    applyTheme(theme);
    count = 0;
    reached = false;
    render();
  },
});

// Fallback for opening the bundle directly (no host init): render with defaults.
setTimeout(() => {
  if (!sim.isInitialized() && app.childElementCount === 0) render();
}, 300);
