// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

const GLYPH_EM_WIDTHS: Record<string, number> = {
  " ": 0.28, i: 0.26, l: 0.26, I: 0.30, j: 0.27, t: 0.37, f: 0.36, r: 0.39,
  s: 0.51, c: 0.53, a: 0.56, e: 0.57, o: 0.59, n: 0.59, u: 0.59, d: 0.60,
  b: 0.60, p: 0.60, q: 0.60, g: 0.59, h: 0.59, k: 0.55, v: 0.53, x: 0.53,
  y: 0.53, z: 0.51, m: 0.87, w: 0.79, A: 0.69, B: 0.67, C: 0.71, D: 0.73,
  E: 0.62, F: 0.59, G: 0.75, H: 0.74, J: 0.51, K: 0.67, L: 0.58, M: 0.87,
  N: 0.74, O: 0.77, P: 0.65, Q: 0.77, R: 0.68, S: 0.65, T: 0.62, U: 0.73,
  V: 0.68, W: 0.95, X: 0.67, Y: 0.66, Z: 0.63, "-": 0.37, "/": 0.40, ".": 0.28,
  "&": 0.70, "(": 0.35, ")": 0.35, "+": 0.60, "_": 0.56, ":": 0.28,
};

export function measureTextPx(text: string, fontSize: number, bold = false): number {
  let emSum = 0;
  for (const ch of Array.from(text)) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x1f000) emSum += 1.15;
    else if (code >= 0x4e00 && code <= 0x9fff) emSum += 1.0;
    else if (ch >= "0" && ch <= "9") emSum += 0.59;
    else emSum += GLYPH_EM_WIDTHS[ch] ?? 0.58;
  }
  return Math.ceil(emSum * fontSize * (bold ? 1.05 : 1.0));
}

export function wrapTwoLines(text: string, maxWidthPx: number, fontSize: number, bold = false): string[] {
  if (measureTextPx(text, fontSize, bold) <= maxWidthPx || !text.includes(" ")) {
    return [text];
  }
  const words = text.trim().split(/\s+/);
  let line1 = words[0];
  let splitIdx = 1;
  while (splitIdx < words.length) {
    const cand = `${line1} ${words[splitIdx]}`;
    if (measureTextPx(cand, fontSize, bold) > maxWidthPx) break;
    line1 = cand;
    splitIdx++;
  }
  const line2 = words.slice(splitIdx).join(" ");
  return line2 ? [line1, line2] : [line1];
}

export function computeCardSize(title: string, subtitle?: string, badge?: string): { width: number; height: number; titleLines: string[] } {
  const badgeExtra = badge ? measureTextPx(badge, 9.5, true) + 22 : 0;
  const titleLines = subtitle ? [title] : wrapTwoLines(title, 142, 13.5, true);
  const titleMaxPx = Math.max(...titleLines.map((ln) => measureTextPx(ln, 13.5, true)));
  const subPx = subtitle ? measureTextPx(subtitle, 11, false) : 0;
  const textColPx = Math.max(titleMaxPx + badgeExtra, subPx);
  const width = Math.min(238, Math.max(182, 50 + textColPx + 16));
  const height = titleLines.length > 1 && subtitle ? 68 : 58;
  return { width, height, titleLines };
}
