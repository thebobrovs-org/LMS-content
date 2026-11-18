// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

import type { ZonePalette } from "../../schema/src/index.ts";

export interface PaletteTokens {
  zoneFill: string;
  zoneStroke: string;
  subZoneFill: string;
  subZoneStroke: string;
  accent: string;
  iconWellFill: string;
}

export const BENTO_PALETTES: Record<ZonePalette, PaletteTokens> = {
  blue: {
    zoneFill: "#e8f0fe",
    zoneStroke: "#8ab4f8",
    subZoneFill: "#d2e3fc",
    subZoneStroke: "#669df6",
    accent: "#1a73e8",
    iconWellFill: "#eff6ff",
  },
  green: {
    zoneFill: "#e6f4ea",
    zoneStroke: "#81c995",
    subZoneFill: "#ceead6",
    subZoneStroke: "#5bb974",
    accent: "#1e8e3e",
    iconWellFill: "#f0fdf4",
  },
  coral: {
    zoneFill: "#fce8e6",
    zoneStroke: "#f6aea9",
    subZoneFill: "#fad2cf",
    subZoneStroke: "#ee675c",
    accent: "#d93025",
    iconWellFill: "#fef2f2",
  },
  amber: {
    zoneFill: "#fef7e0",
    zoneStroke: "#fde293",
    subZoneFill: "#feefc3",
    subZoneStroke: "#fcc934",
    accent: "#e37400",
    iconWellFill: "#fffbeb",
  },
  purple: {
    zoneFill: "#f3e8fd",
    zoneStroke: "#c084fc",
    subZoneFill: "#e9d5ff",
    subZoneStroke: "#a855f7",
    accent: "#9334e6",
    iconWellFill: "#faf5ff",
  },
  teal: {
    zoneFill: "#e0f7fa",
    zoneStroke: "#4dd0e1",
    subZoneFill: "#b2ebf2",
    subZoneStroke: "#26c6da",
    accent: "#00838f",
    iconWellFill: "#ecfeff",
  },
  neutral: {
    zoneFill: "#f1f5f9",
    zoneStroke: "#cbd5e1",
    subZoneFill: "#e2e8f0",
    subZoneStroke: "#94a3b8",
    accent: "#334155",
    iconWellFill: "#f8fafc",
  },
};

export const DESIGN_TOKENS = {
  fontFamily: `Inter, Roboto, "DejaVu Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
  monoFamily: `"JetBrains Mono", "DejaVu Sans Mono", ui-monospace, monospace`,
  outerFrameFill: "#f8fafd",
  outerFrameStroke: "#c2d7f5",
  cardFill: "#ffffff",
  cardStroke: "#dadce0",
  titleColor: "#202124",
  subtitleColor: "#5f6368",
  defaultEdgeColor: "#1a73e8",
};
