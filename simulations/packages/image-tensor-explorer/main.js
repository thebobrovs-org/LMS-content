// createSim is a global from sim-sdk.js (classic script). An image walked up the ranks: a single
// pixel (scalar) -> a row (vector) -> a grayscale photo (matrix) -> a color photo (rank 3, the +RGB
// "channels" dimension) -> a video/batch (rank 4, +time). The right-hand array grows the same way —
// each new dimension multiplies the numbers stored. Deterministic, theme + reduced-motion aware, no CDNs.

const app = document.getElementById("app");

const STEPS = [
  {
    id: 0, title: "Rank 0: Scalar",
    desc: "A single grayscale pixel — just a brightness value, from 0 (black) to 255 (white). Its shape is <b>()</b>: <b>zero dimensions</b>, because you need no index at all to find the value. Use the slider to change it.",
    shape: "()", values: 1
  },
  {
    id: 1, title: "Rank 1: Vector",
    desc: "A row of pixels. You need <b>one index</b> (X) to pick a brightness. Hover over the pixels to see exactly how they map to the 1D array.",
    shape: "(8,)", values: 8
  },
  {
    id: 2, title: "Rank 2: Matrix",
    desc: "A grayscale photo. A grid of brightnesses. You need <b>two indices</b> (Y, X) to pick a pixel. <b>Type a letter</b> or hover to see the cell's coordinates in the 2D array.",
    shape: "(8, 8)", values: 64
  },
  {
    id: 3, title: "Rank 3: 3D Tensor",
    desc: "A color photo. The exact same grid, but <b>three values deep</b> — an R, G, B channel per pixel. Hover the Red, Green, or Blue layers to highlight that channel in the array, and drag the Red slider to watch one of the three numbers per pixel recolor the image.",
    shape: "(8, 8, 3)", values: 192
  },
  {
    id: 4, title: "Rank 4: 4D Tensor",
    desc: "A video or a batch — color photos stacked into a sequence. The shape reads <b>(frames, height, width, channels)</b>, outer to inner: here the first 3 is the number of frames and the last 3 is RGB. Slide the time index to scrub between frames.",
    shape: "(3, 8, 8, 3)", values: 576
  }
];

let currentStep = 0;
let tensorValue = 255;
let tensorFrame = 0;
let vectorIndex = 0;
let vectorOverrides = {};
let matrixX = 0;
let matrixY = 0;
let matrixOverrides = {};
let hoveredCell = null; // Tracks physical 3D hover: { x, y, layer, f }
let observed = false;
let REDUCE = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const W = 8;
const H = 8;

// A pixel's value is drawn in whichever of black and white reads better on the pixel's colour, by the
// WCAG contrast ratio; one of the two always reaches 4.5:1 (LMS-content#126). tests/code-contrast.test.mjs.
function pixelInk(r, g, b) {
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? "#000" : "#fff";
}

// Generates a recognizable landscape pattern (Sky, Sun, Ground)
function getPixel(x, y, frame) {
  const sunY = 3 + frame * 1.5;
  const dist = Math.sqrt((x - 3.5) ** 2 + (y - sunY) ** 2);

  let r, g, b;
  if (y > 5) { // Ground
    r = 34 + frame * 10; g = 139 - frame * 20; b = 34;
  } else if (dist < 2.5) { // Sun
    r = 255; g = 200 - frame * 40; b = 50;
  } else { // Sky
    r = 135 - frame * 30; g = 206 - frame * 50; b = 235;
  }
  return { r, g, b };
}

function getBaseGray(x, y, frame) {
  const px = getPixel(x, y, frame);
  return Math.floor(0.3 * px.r + 0.59 * px.g + 0.11 * px.b);
}

function getVectorVal(x) {
  if (vectorOverrides[x] !== undefined) return vectorOverrides[x];
  return getBaseGray(x, 4, 0); // Row index 4 is our Vector slice
}

function getMatrixVal(x, y) {
  const key = `${x},${y}`;
  if (matrixOverrides[key] !== undefined) return matrixOverrides[key];
  return getBaseGray(x, y, 0); // Frame 0
}

// Hardcoded 5x6 pixel font guarantees perfect, crisp letters in an 8x8 grid
const FONT_8X8 = {
  'A': [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#", "....."],
  'B': ["####.", "#...#", "####.", "#...#", "#...#", "####.", ".....", "....."],
  'C': [".####", "#....", "#....", "#....", "#....", ".####", ".....", "....."],
  'D': ["####.", "#...#", "#...#", "#...#", "#...#", "####.", ".....", "....."],
  'E': ["#####", "#....", "####.", "#....", "#....", "#####", ".....", "....."],
  'F': ["#####", "#....", "####.", "#....", "#....", "#....", ".....", "....."],
  'G': [".####", "#....", "#..##", "#...#", "#...#", ".####", ".....", "....."],
  'H': ["#...#", "#...#", "#####", "#...#", "#...#", "#...#", ".....", "....."],
  'I': ["#####", "..#..", "..#..", "..#..", "..#..", "#####", ".....", "....."],
  'J': ["....#", "....#", "....#", "#...#", ".###.", ".....", ".....", "....."],
  'K': ["#...#", "#..#.", "##...", "#..#.", "#...#", "#...#", ".....", "....."],
  'L': ["#....", "#....", "#....", "#....", "#....", "#####", ".....", "....."],
  'M': ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#", ".....", "....."],
  'N': ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", ".....", "....."],
  'O': [".###.", "#...#", "#...#", "#...#", "#...#", ".###.", ".....", "....."],
  'P': ["####.", "#...#", "####.", "#....", "#....", "#....", ".....", "....."],
  'Q': [".###.", "#...#", "#...#", "#..##", ".####", "....#", ".....", "....."],
  'R': ["####.", "#...#", "####.", "#..#.", "#...#", "#...#", ".....", "....."],
  'S': [".####", "#....", ".###.", "....#", "#...#", ".###.", ".....", "....."],
  'T': ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", ".....", "....."],
  'U': ["#...#", "#...#", "#...#", "#...#", "#...#", ".###.", ".....", "....."],
  'V': ["#...#", "#...#", "#...#", "#...#", ".#.#.", "..#..", ".....", "....."],
  'W': ["#...#", "#...#", "#...#", "#.#.#", "##.##", "#...#", ".....", "....."],
  'X': ["#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#", ".....", "....."],
  'Y': ["#...#", ".#.#.", "..#..", "..#..", "..#..", "..#..", ".....", "....."],
  'Z': ["#####", "....#", "...#.", "..#..", ".#...", "#####", ".....", "....."]
};

function renderLetterToMatrix(char) {
  if (!char || char.trim() === '') {
    matrixOverrides = {}; // Reset to background if empty
    renderPixels();
    return;
  }
  const upper = char.toUpperCase();
  const pattern = FONT_8X8[upper];
  matrixOverrides = {};

  if (pattern) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        // Offset x by 1 to center the 5-wide letter in the 8-wide grid.
        const px = x - 1;
        if (px >= 0 && px < 5) {
          const isFilled = pattern[y][px] === '#';
          matrixOverrides[`${x},${y}`] = isFilled ? 255 : 0;
        } else {
          matrixOverrides[`${x},${y}`] = 0;
        }
      }
    }
  } else {
    // Fallback to empty for non A-Z characters
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        matrixOverrides[`${x},${y}`] = 0;
      }
    }
  }
  renderPixels();
}

function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => { if (window.sim && sim.resize) sim.resize(document.body.scrollHeight + 8); }); }

function initDOM() {
  const stepsHtml = STEPS.map((step, i) => `
    <button class="step-btn ${i === currentStep ? 'active' : ''}" data-step="${i}" ${i === currentStep ? 'aria-current="step"' : ''}>
      <span>${step.title}</span>
      <span class="step-badge">${step.shape}</span>
    </button>
  `).join("");

  app.innerHTML = `
    <div class="layout-grid">
      <div class="sidebar">
        <nav class="steps-nav" aria-label="Steps">
          ${stepsHtml}
        </nav>
        <div class="explain-panel">
          <div class="e-title" id="e-title"></div>
          <div class="e-desc" id="e-desc"></div>
        </div>
        <div id="interactive-controls" style="display:flex; flex-direction:column; gap:10px;"></div>
        <div class="metrics">
          <div class="m-card">
            <div class="m-k">Shape</div>
            <div class="m-v dim mono" id="m-shape"></div>
          </div>
          <div class="m-card">
            <div class="m-k">Total Values</div>
            <div class="m-v mono" id="m-values"></div>
          </div>
        </div>
      </div>

      <div class="main-content">
        <div class="stage-wrap">
          <div class="scene">
            <div class="stage-3d" id="stage-3d">
              <!-- Layers will be injected here -->
            </div>
          </div>
        </div>
        <div id="code-overlay" class="code-overlay" tabindex="0" role="region" aria-label="The code for this view (scrollable)"></div>
      </div>
    </div>`;

  app.querySelectorAll(".step-btn").forEach(btn =>
    btn.addEventListener("click", () => setStep(+btn.getAttribute("data-step")))
  );

  const stage = document.getElementById("stage-3d");

  // Create the 6 logical layers needed for all steps
  const layerDefs = ['main', 'r', 'g', 'b', 'f1', 'f2'];
  layerDefs.forEach(id => {
    const l = document.createElement('div');
    l.className = 'grid-layer';
    l.id = `layer-${id}`;

    const label = document.createElement('div');
    label.className = 'layer-label';
    label.id = `label-${id}`;
    l.appendChild(label);

    for (let i = 0; i < 64; i++) {
      const p = document.createElement('div');
      p.className = 'pixel';
      l.appendChild(p);
    }
    stage.appendChild(l);
  });
}

function setStep(s) {
  currentStep = s;
  tensorValue = 255;
  tensorFrame = 0;
  vectorIndex = 0;
  vectorOverrides = {}; // Reset local edits when leaving rank 1
  matrixX = 0;
  matrixY = 0;
  matrixOverrides = {}; // Reset local edits when leaving rank 2
  hoveredCell = null;   // Reset hover

  if (currentStep === 4 && !observed && window.sim) {
    observed = true;
    sim.checkpoint("observe-image-ranks");
  }
  if (window.sim && sim.event) sim.event("rank", { rank: currentStep });
  updateUI();
}

function createSlider(label, min, max, val, onChange, idSuffix) {
  const div = document.createElement("div");
  div.className = "slider-box";
  div.innerHTML = `
      <div class="slider-header"><label for="slider-val-${idSuffix}">${label}</label><span class="val" id="sv-label-${idSuffix}">${val}</span></div>
      <input type="range" id="slider-val-${idSuffix}" min="${min}" max="${max}" value="${val}">
  `;
  div.querySelector("input").addEventListener("input", (e) => {
    const v = parseInt(e.target.value);
    div.querySelector(`#sv-label-${idSuffix}`).innerText = v;
    onChange(v);
    renderPixels(); // Triggers code overlay update as well
  });
  return div;
}

function buildControls() {
  const ctrl = document.getElementById("interactive-controls");
  ctrl.innerHTML = '';

  if (currentStep === 0) {
    ctrl.appendChild(createSlider("Scalar Brightness", 0, 255, tensorValue, v => { tensorValue = v; }, '0'));
  } else if (currentStep === 1) {
    ctrl.appendChild(createSlider("Select Index (X)", 0, 7, vectorIndex, v => {
      vectorIndex = v;
      const valSlider = document.getElementById('slider-val-idx-val');
      const valLabel = document.getElementById('sv-label-idx-val');
      const newVal = getVectorVal(v);
      if (valSlider) valSlider.value = newVal;
      if (valLabel) valLabel.innerText = newVal;
    }, 'idx'));

    ctrl.appendChild(createSlider("Value at Index", 0, 255, getVectorVal(vectorIndex), v => {
      vectorOverrides[vectorIndex] = v;
    }, 'idx-val'));
  } else if (currentStep === 2) {
    const divLetter = document.createElement("div");
    divLetter.className = "slider-box";
    divLetter.innerHTML = `
        <div class="slider-header"><label for="input-letter">Draw Letter</label></div>
        <input type="text" id="input-letter" maxlength="1" placeholder="Type A-Z" style="width:100%; padding:6px; font-family:monospace; font-size:14px; text-align:center; background:var(--inset); color:var(--fg); border:1px solid var(--border); border-radius:6px; text-transform:uppercase; outline:none; transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
    `;
    divLetter.querySelector("input").addEventListener("input", (e) => {
      renderLetterToMatrix(e.target.value);
      const valSlider = document.getElementById('slider-val-mat-val');
      const valLabel = document.getElementById('sv-label-mat-val');
      const newVal = getMatrixVal(matrixX, matrixY);
      if (valSlider) valSlider.value = newVal;
      if (valLabel) valLabel.innerText = newVal;
    });
    ctrl.appendChild(divLetter);

    ctrl.appendChild(createSlider("Select Col (X)", 0, 7, matrixX, v => {
      matrixX = v;
      const valSlider = document.getElementById('slider-val-mat-val');
      const valLabel = document.getElementById('sv-label-mat-val');
      const newVal = getMatrixVal(v, matrixY);
      if (valSlider) valSlider.value = newVal;
      if (valLabel) valLabel.innerText = newVal;
    }, 'mat-x'));

    ctrl.appendChild(createSlider("Select Row (Y)", 0, 7, matrixY, v => {
      matrixY = v;
      const valSlider = document.getElementById('slider-val-mat-val');
      const valLabel = document.getElementById('sv-label-mat-val');
      const newVal = getMatrixVal(matrixX, v);
      if (valSlider) valSlider.value = newVal;
      if (valLabel) valLabel.innerText = newVal;
    }, 'mat-y'));

    ctrl.appendChild(createSlider("Value at (X, Y)", 0, 255, getMatrixVal(matrixX, matrixY), v => {
      matrixOverrides[`${matrixX},${matrixY}`] = v;
    }, 'mat-val'));
  } else if (currentStep === 3) {
    ctrl.appendChild(createSlider("Red Channel Intensity", 0, 255, tensorValue, v => { tensorValue = v; }, '3'));
  } else if (currentStep === 4) {
    ctrl.appendChild(createSlider("Time Index (Frame)", 0, 2, tensorFrame, v => { tensorFrame = v; }, '4'));
  }
}

function getConfigs() {
  const configs = {
    main: { show: true, type: 'color', z: 0, frame: 0, label: '' },
    r: { show: false, type: 'r', z: 0, frame: 0, label: '' },
    g: { show: false, type: 'g', z: 0, frame: 0, label: '' },
    b: { show: false, type: 'b', z: 0, frame: 0, label: '' },
    f1: { show: false, type: 'color', z: 0, frame: 1, label: '' },
    f2: { show: false, type: 'color', z: 0, frame: 2, label: '' }
  };

  if (currentStep === 0 || currentStep === 1 || currentStep === 2) {
    configs.main.type = 'gray';
  } else if (currentStep === 3) {
    configs.main.z = 100; configs.main.label = "Color (RGB Combined)";
    configs.r.show = true; configs.r.z = 40; configs.r.label = "Red Channel";
    configs.g.show = true; configs.g.z = -20; configs.g.label = "Green Channel";
    configs.b.show = true; configs.b.z = -80; configs.b.label = "Blue Channel";
  } else if (currentStep === 4) {
    configs.main.z = 100; configs.main.label = "Frame " + tensorFrame + " (selected)";
    configs.f1.show = true; configs.f1.z = 0; configs.f1.label = "Frame 1";
    configs.f2.show = true; configs.f2.z = -100; configs.f2.label = "Frame 2";
  }
  return configs;
}

function updateUI() {
  const s = STEPS[currentStep];

  // Update Sidebar
  app.querySelectorAll(".step-btn").forEach((btn, i) => {
    btn.classList.toggle('active', i === currentStep);
    if (i === currentStep) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
  });
  document.getElementById('e-title').innerHTML = s.title.split(': ')[1];
  document.getElementById('e-desc').innerHTML = s.desc;
  document.getElementById('m-shape').innerText = s.shape;
  document.getElementById('m-values').innerText = s.values;

  buildControls();

  // Update 3D Stage positioning
  const stage3d = document.getElementById('stage-3d');
  if (currentStep < 3) {
    stage3d.style.transform = 'rotateX(0deg) rotateZ(0deg)';
  } else {
    stage3d.style.transform = 'rotateX(60deg) rotateZ(-45deg)';
  }

  renderPixels();
}

function renderCodeOverlay() {
  const overlay = document.getElementById('code-overlay');
  if (!overlay) return;

  overlay.style.fontSize = currentStep >= 3 ? '8.5px' : '10px';

  let code = '';

  if (currentStep === 0) {
    code = `<span class="kw">const</span> tensor <span class="op">=</span> <span class="hl">${tensorValue}</span>;`;
  } else if (currentStep === 1) {
    let vals = [];
    for (let x = 0; x < 8; x++) {
      let v = getVectorVal(x);
      let vStr = v.toString().padStart(3, ' ');
      let isHover = hoveredCell && hoveredCell.x === x;
      vals.push((x === vectorIndex || isHover) ? `<span class="hl">${vStr}</span>` : vStr);
    }
    code = `<span class="kw">const</span> tensor <span class="op">=</span> [\n  ${vals.join(', ')}\n];`;
  } else if (currentStep === 2) {
    let rows = [];
    for (let y = 0; y < 8; y++) {
      let cols = [];
      for (let x = 0; x < 8; x++) {
        let v = getMatrixVal(x, y);
        let vStr = v.toString().padStart(3, ' ');
        let isHover = hoveredCell && hoveredCell.x === x && hoveredCell.y === y;
        cols.push((x === matrixX && y === matrixY) || isHover ? `<span class="hl">${vStr}</span>` : vStr);
      }
      rows.push(`  [ ${cols.join(', ')} ]`);
    }
    code = `<span class="kw">const</span> tensor <span class="op">=</span> [\n${rows.join(',\n')}\n];`;
  } else if (currentStep === 3) {
    let rows = [];
    for (let y = 0; y < 8; y++) {
      let cols = [];
      for (let x = 0; x < 8; x++) {
        let px = getPixel(x, y, 0);
        let r = Math.min(255, Math.floor(px.r * (tensorValue / 255)));
        let g = Math.floor(px.g);
        let b = Math.floor(px.b);

        let isHover = hoveredCell && hoveredCell.x === x && hoveredCell.y === y;
        let rStr = r.toString().padStart(3, ' '), gStr = g.toString().padStart(3, ' '), bStr = b.toString().padStart(3, ' ');

        if (isHover) {
          if (hoveredCell.layer === 'r') rStr = `<span class="hl">${rStr}</span>`;
          else if (hoveredCell.layer === 'g') gStr = `<span class="hl">${gStr}</span>`;
          else if (hoveredCell.layer === 'b') bStr = `<span class="hl">${bStr}</span>`;
          else {
            rStr = `<span class="hl">${rStr}</span>`;
            gStr = `<span class="hl">${gStr}</span>`;
            bStr = `<span class="hl">${bStr}</span>`;
          }
        }
        let tuple = `[${rStr},${gStr},${bStr}]`;
        cols.push(isHover && hoveredCell.layer === 'main' ? `<span class="hl-bg">${tuple}</span>` : tuple);
      }
      rows.push(`  [ ${cols.join(', ')} ]`);
    }
    code = `<span class="kw">const</span> tensor <span class="op">=</span> [\n${rows.join(',\n')}\n];`;
  } else if (currentStep === 4) {
    let frames = [];
    for (let f = 0; f < 3; f++) {
      let rows = [];
      for (let y = 0; y < 8; y++) {
        let cols = [];
        for (let x = 0; x < 8; x++) {
          let px = getPixel(x, y, f);
          let r = Math.floor(px.r).toString().padStart(3, ' ');
          let g = Math.floor(px.g).toString().padStart(3, ' ');
          let b = Math.floor(px.b).toString().padStart(3, ' ');

          let isHover = hoveredCell && hoveredCell.x === x && hoveredCell.y === y && hoveredCell.f === f;
          let tuple = `[${r},${g},${b}]`;
          cols.push(isHover ? `<span class="hl-bg">${tuple}</span>` : tuple);
        }
        rows.push(`    [ ${cols.join(', ')} ]`);
      }
      frames.push(`  [\n    <span class="cm">// Frame ${f} (t=${f})</span>\n${rows.join(',\n')}\n  ]`);
    }
    code = `<span class="kw">const</span> tensor <span class="op">=</span> [\n${frames.join(',\n')}\n];`;
  }

  // Preserve scroll position
  const scrollPos = overlay.scrollTop;
  overlay.innerHTML = code;
  overlay.scrollTop = scrollPos;
}

function renderPixels() {
  const configs = getConfigs();

  // Apply config to DOM
  for (let key in configs) {
    const conf = configs[key];
    const el = document.getElementById(`layer-${key}`);
    const labelEl = document.getElementById(`label-${key}`);

    el.style.transform = `translate(-50%, -50%) translateZ(${conf.z}px)`;
    el.style.opacity = conf.show ? 1 : 0;

    labelEl.innerText = conf.label;
    labelEl.style.transform = currentStep >= 3 ? 'rotateZ(45deg) rotateX(-60deg) translateY(-20px)' : 'none';
    labelEl.style.opacity = conf.label && conf.show ? 1 : 0;

    // Update Pixels
    const pixels = el.querySelectorAll('.pixel');
    let i = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let { r, g, b } = getPixel(x, y, conf.frame);

        // ---- Interactive Math / Slider Logic ----
        if (currentStep === 0) {
          r = g = b = tensorValue;
        } else if (currentStep === 1) {
          let v = getVectorVal(x);
          r = g = b = v;
        } else if (currentStep === 2) {
          let v = getMatrixVal(x, y);
          r = g = b = v;
        } else if (currentStep === 3) {
          r = Math.min(255, r * (tensorValue / 255));
        } else if (currentStep === 4) {
          if (key === 'main') {
            let px = getPixel(x, y, tensorFrame);
            r = px.r; g = px.g; b = px.b;
          }
        }

        let visible = true;

        // Hide logic for scalar/vector
        if (currentStep === 0 && (x !== 3 || y !== 4)) visible = false;
        if (currentStep === 1 && y !== 4) visible = false;

        // Color filtering and display value
        let displayVal = "";
        if (conf.type === 'gray') {
          let v = Math.floor(0.3 * r + 0.59 * g + 0.11 * b);
          r = v; g = v; b = v;
          displayVal = v;
        } else if (conf.type === 'r') {
          displayVal = Math.round(r);
          g = 0; b = 0;
        } else if (conf.type === 'g') {
          displayVal = Math.round(g);
          r = 0; b = 0;
        } else if (conf.type === 'b') {
          displayVal = Math.round(b);
          r = 0; g = 0;
        }

        pixels[i].style.backgroundColor = `rgb(${r},${g},${b})`;
        pixels[i].style.opacity = visible ? 1 : 0;

        pixels[i].innerText = displayVal;
        pixels[i].style.color = pixelInk(r, g, b);

        // Remove Z-axis translation in flat views to prevent perspective parallax
        const transformPop = currentStep < 3 ? 'scale(1.15)' : 'translateZ(12px) scale(1.35)';

        // Highlighting & Hover logic
        if (currentStep === 1 && visible && x === vectorIndex && key === 'main') {
          pixels[i].style.boxShadow = `0 0 0 3px var(--primary), inset 0 0 0 1px rgba(0,0,0,0.5)`;
          pixels[i].style.transform = transformPop;
          pixels[i].style.zIndex = 10;
        } else if (currentStep === 2 && visible && x === matrixX && y === matrixY && key === 'main') {
          pixels[i].style.boxShadow = `0 0 0 3px var(--primary), inset 0 0 0 1px rgba(0,0,0,0.5)`;
          pixels[i].style.transform = transformPop;
          pixels[i].style.zIndex = 10;
        } else {
          pixels[i].style.boxShadow = `inset 0 0 0 1px rgba(0,0,0,0.2)`;
          pixels[i].style.transform = `none`;
          pixels[i].style.zIndex = 1;
        }

        // Bind hover events with closures for the specific pixel coordinates
        pixels[i].onmouseenter = () => { hoveredCell = { x, y, layer: key, f: conf.frame }; renderCodeOverlay(); };
        pixels[i].onmouseleave = () => { hoveredCell = null; renderCodeOverlay(); };

        i++;
      }
    }
  }
  renderCodeOverlay();
  reportSize();
}

window.sim = createSim({
  onInit({ theme, reducedMotion }) {
    REDUCE = REDUCE || reducedMotion;
    applyTheme(theme);
    initDOM();
    setStep(0);
  }
});

new ResizeObserver(() => reportSize()).observe(document.body);

// Fallback for standalone preview (no host init)
setTimeout(() => {
  if ((!window.sim || !sim.isInitialized()) && !document.getElementById("stage-3d")) {
    initDOM();
    setStep(0);
  }
}, 300);
