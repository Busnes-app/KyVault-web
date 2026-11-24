// Busnes suite theme engine for KyVault (aligned with @busnes/ky-ui v0.12.0).
// Six light/dark palette pairs (twelve halves) plus Match system, with RGB triplet
// derivation so legacy Bitwarden Tailwind `rgb(var(--color-*) / <alpha>)` utilities
// and newer semantic `--color-bg-*`/`--color-fg-*` tokens stay in sync across every theme.

export type KyThemeScheme = "light" | "dark";

export type KyThemeHalfId =
  | "busnes-light"
  | "busnes-dark"
  | "light-matter"
  | "dark-matter"
  | "white-cliffs"
  | "ocean"
  | "forest-light"
  | "forest"
  | "polished-ky"
  | "patina-ky"
  | "paper"
  | "nord";

export type KyThemePairId =
  "busnes-pair" | "matter-pair" | "ocean-pair" | "forest-pair" | "ky-pair" | "nord-pair";

export type KyThemeChoice = "system" | KyThemePairId | KyThemeHalfId;

export interface KyThemeEntry {
  readonly id: KyThemeHalfId;
  readonly name: string;
  readonly scheme: KyThemeScheme;
  readonly pair: KyThemePairId;
  readonly aliases: readonly string[];
}

export interface KyThemePair {
  readonly id: KyThemePairId;
  readonly name: string;
  readonly light: KyThemeHalfId;
  readonly dark: KyThemeHalfId;
}

export interface KyThemePalette {
  readonly bg: string;
  readonly panel: string;
  readonly panelHover: string;
  readonly ink: string;
  readonly inkStrong: string;
  readonly inkMuted: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly accentSoftHex: string;
  readonly line: string;
  readonly lineHex: string;
  readonly lineStrong: string;
  readonly lineStrongHex: string;
  readonly glow: string;
  readonly sidebarStart: string;
  readonly sidebarEnd: string;
  readonly buttonText: string;
  readonly danger: string;
  readonly success: string;
  readonly warning: string;
}

export interface KyThemeModeOption {
  readonly mode: "system" | "light" | "dark";
  readonly label: string;
  readonly value: KyThemeChoice;
}

export interface KyThemeChoiceGroup {
  readonly pair: KyThemePair;
  readonly lightName: string;
  readonly darkName: string;
  readonly choices: readonly KyThemeModeOption[];
}

export interface KyAppliedTheme {
  readonly choice: KyThemeChoice;
  readonly half: KyThemeEntry;
  readonly scheme: KyThemeScheme;
}

export const KY_THEME_STORAGE_KEY = "ky_theme";
export const LEGACY_BW_THEME_KEY = "global_theming_selection";

const KY_DANGER_LIGHT = "#a8174e";
const KY_DANGER_DARK = "#ff8fb1";
const KY_SUCCESS_LIGHT = "#267442";
const KY_SUCCESS_DARK = "#86efac";
const KY_WARNING_LIGHT = "#7a5f00";
const KY_WARNING_DARK = "#ffd25e";

export const KY_THEME_CATALOG: readonly KyThemeEntry[] = Object.freeze([
  { id: "busnes-light", name: "Busnes Light", scheme: "light", pair: "busnes-pair", aliases: [] },
  { id: "busnes-dark", name: "Busnes Dark", scheme: "dark", pair: "busnes-pair", aliases: [] },
  {
    id: "light-matter",
    name: "Matter Light",
    scheme: "light",
    pair: "matter-pair",
    aliases: ["Light Matter"],
  },
  {
    id: "dark-matter",
    name: "Matter Dark",
    scheme: "dark",
    pair: "matter-pair",
    aliases: ["Dark Matter", "Current"],
  },
  {
    id: "white-cliffs",
    name: "Ocean Light",
    scheme: "light",
    pair: "ocean-pair",
    aliases: ["White Cliffs", "Cliffs"],
  },
  { id: "ocean", name: "Ocean Dark", scheme: "dark", pair: "ocean-pair", aliases: ["Ocean"] },
  { id: "forest-light", name: "Forest Light", scheme: "light", pair: "forest-pair", aliases: [] },
  { id: "forest", name: "Forest Dark", scheme: "dark", pair: "forest-pair", aliases: ["Forest"] },
  {
    id: "polished-ky",
    name: "Ky Light",
    scheme: "light",
    pair: "ky-pair",
    aliases: ["Polished Ky"],
  },
  {
    id: "patina-ky",
    name: "Ky Dark",
    scheme: "dark",
    pair: "ky-pair",
    aliases: ["Patina Ky", "patina", "Patina Ky (base)"],
  },
  { id: "paper", name: "Nord Light", scheme: "light", pair: "nord-pair", aliases: ["Paper Clean"] },
  {
    id: "nord",
    name: "Nord Dark",
    scheme: "dark",
    pair: "nord-pair",
    aliases: ["Nord", "Nord Slate"],
  },
]);

export const KY_THEME_PAIRS: readonly KyThemePair[] = Object.freeze([
  { id: "busnes-pair", name: "Busnes", light: "busnes-light", dark: "busnes-dark" },
  { id: "matter-pair", name: "Matter", light: "light-matter", dark: "dark-matter" },
  { id: "ocean-pair", name: "Ocean", light: "white-cliffs", dark: "ocean" },
  { id: "forest-pair", name: "Forest", light: "forest-light", dark: "forest" },
  { id: "ky-pair", name: "Ky", light: "polished-ky", dark: "patina-ky" },
  { id: "nord-pair", name: "Nord", light: "paper", dark: "nord" },
]);

export function parseHexRgb(hex: string): readonly [number, number, number] {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) {
    return [24, 35, 38];
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function hexToRgbTriplet(hex: string): string {
  const [r, g, b] = parseHexRgb(hex);
  return `${r} ${g} ${b}`;
}

export function mixHex(hexA: string, hexB: string, weightA: number): string {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const w1 = Math.max(0, Math.min(1, weightA));
  const w2 = 1 - w1;
  const r = Math.round(r1 * w1 + r2 * w2);
  const g = Math.round(g1 * w1 + g2 * w2);
  const b = Math.round(b1 * w1 + b2 * w2);
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface RawPaletteInput {
  scheme: KyThemeScheme;
  bg: string;
  panel: string;
  ink: string;
  inkStrong: string;
  accent: string;
  accentSoft: string;
  accentSoftHex?: string;
  line: string;
  lineHex?: string;
  glow: string;
  sidebarStart: string;
  sidebarEnd: string;
  buttonText: string;
  panelHover?: string;
  lineStrong?: string;
  lineStrongHex?: string;
  danger?: string;
  success?: string;
}

function buildPalette(input: RawPaletteInput): KyThemePalette {
  const lineHex = input.lineHex ?? input.line;
  const panelHover = input.panelHover ?? mixHex(input.panel, input.inkStrong, 0.93);
  const lineStrongHex = input.lineStrongHex ?? mixHex(lineHex, input.inkStrong, 0.6);
  const lineStrong =
    input.lineStrong ?? `color-mix(in srgb, ${input.line} 60%, ${input.inkStrong})`;
  const inkMuted = `color-mix(in srgb, ${input.ink} 90%, ${input.panel})`;
  const accentSoftHex = input.accentSoftHex ?? input.accentSoft;
  const isDark = input.scheme === "dark";

  return Object.freeze({
    bg: input.bg,
    panel: input.panel,
    panelHover,
    ink: input.ink,
    inkStrong: input.inkStrong,
    inkMuted,
    accent: input.accent,
    accentSoft: input.accentSoft,
    accentSoftHex,
    line: input.line,
    lineHex,
    lineStrong,
    lineStrongHex,
    glow: input.glow,
    sidebarStart: input.sidebarStart,
    sidebarEnd: input.sidebarEnd,
    buttonText: input.buttonText,
    danger: input.danger ?? (isDark ? KY_DANGER_DARK : KY_DANGER_LIGHT),
    success: input.success ?? (isDark ? KY_SUCCESS_DARK : KY_SUCCESS_LIGHT),
    warning: isDark ? KY_WARNING_DARK : KY_WARNING_LIGHT,
  });
}

export const KY_THEME_PALETTES: Readonly<Record<KyThemeHalfId, KyThemePalette>> = Object.freeze({
  "busnes-light": buildPalette({
    scheme: "light",
    bg: "#f8f6f0",
    panel: "#ffffff",
    panelHover: "#f2efe7",
    ink: "#566461",
    inkStrong: "#182326",
    accent: "#bf3f18",
    accentSoft: "#fbf0ec",
    line: "rgba(24, 35, 38, 0.22)",
    lineHex: "#cccac3",
    lineStrong: "rgba(24, 35, 38, 0.38)",
    lineStrongHex: "#a3a5a2",
    glow: "transparent",
    sidebarStart: "#f2efe7",
    sidebarEnd: "#f2efe7",
    buttonText: "#ffffff",
  }),
  "busnes-dark": buildPalette({
    scheme: "dark",
    bg: "#182326",
    panel: "#1f2b2e",
    panelHover: "#2b383a",
    ink: "#b3bcb8",
    inkStrong: "#f2efe8",
    accent: "#f5865f",
    accentSoft: "#2b2622",
    line: "rgba(242, 239, 232, 0.24)",
    lineHex: "#4d5657",
    lineStrong: "rgba(242, 239, 232, 0.42)",
    lineStrongHex: "#737c7b",
    glow: "transparent",
    sidebarStart: "#1f2b2e",
    sidebarEnd: "#1f2b2e",
    buttonText: "#182326",
  }),
  "light-matter": buildPalette({
    scheme: "light",
    bg: "#f5efe5",
    panel: "#fff8ee",
    ink: "#4c3d32",
    inkStrong: "#2d1f15",
    accent: "#805a39",
    accentSoft: "#e2d0b8",
    line: "#d4c7b5",
    glow: "transparent",
    sidebarStart: "#ede2d2",
    sidebarEnd: "#ede2d2",
    buttonText: "#ffffff",
  }),
  "dark-matter": buildPalette({
    scheme: "dark",
    bg: "#1d1b19",
    panel: "#292725",
    ink: "#cfc6bb",
    inkStrong: "#f0e9df",
    accent: "#c29a72",
    accentSoft: "#49392c",
    line: "#45403a",
    glow: "transparent",
    sidebarStart: "#25221f",
    sidebarEnd: "#25221f",
    buttonText: "#24170f",
  }),
  "white-cliffs": buildPalette({
    scheme: "light",
    bg: "#f7f9fb",
    panel: "#ffffff",
    ink: "#2e4c63",
    inkStrong: "#163246",
    accent: "#1d5fa6",
    accentSoft: "#dde9f7",
    line: "#c7d6df",
    glow: "transparent",
    sidebarStart: "#eaf1f8",
    sidebarEnd: "#eaf1f8",
    buttonText: "#ffffff",
  }),
  ocean: buildPalette({
    scheme: "dark",
    bg: "#0f1b24",
    panel: "#152a36",
    ink: "#b8d8e8",
    inkStrong: "#e0f2fb",
    accent: "#6aa8e8",
    accentSoft: "#1f3a55",
    line: "#2f5567",
    glow: "rgba(58, 130, 155, 0.24)",
    sidebarStart: "#112430",
    sidebarEnd: "#173342",
    buttonText: "#0a1b22",
  }),
  "forest-light": buildPalette({
    scheme: "light",
    bg: "#f3f6ef",
    panel: "#fcfdf9",
    ink: "#435342",
    inkStrong: "#203322",
    accent: "#4b6b37",
    accentSoft: "#e2ebda",
    line: "#c5d0bc",
    glow: "transparent",
    sidebarStart: "#e8eee1",
    sidebarEnd: "#e8eee1",
    buttonText: "#ffffff",
    success: "#00737a",
  }),
  forest: buildPalette({
    scheme: "dark",
    bg: "#142018",
    panel: "#1f2f24",
    ink: "#c7dbc7",
    inkStrong: "#e3f0df",
    accent: "#8faa74",
    accentSoft: "#3a5837",
    line: "#4f694f",
    glow: "rgba(118, 148, 95, 0.24)",
    sidebarStart: "#18261c",
    sidebarEnd: "#223629",
    buttonText: "#12200f",
    success: "#6ee0d0",
  }),
  "polished-ky": buildPalette({
    scheme: "light",
    bg: "#eef2f6",
    panel: "#ffffff",
    ink: "#475569",
    inkStrong: "#0f172a",
    accent: "#08758b",
    accentSoft: "#daf2f4",
    line: "#c2cdd8",
    glow: "transparent",
    sidebarStart: "#e7edf3",
    sidebarEnd: "#e7edf3",
    buttonText: "#ffffff",
  }),
  "patina-ky": buildPalette({
    scheme: "dark",
    bg: "#10161e",
    panel: "#1b2530",
    ink: "#afbdca",
    inkStrong: "#e2e8f0",
    accent: "#6fc9cc",
    accentSoft: "#203d41",
    line: "#34414d",
    glow: "transparent",
    sidebarStart: "#161e27",
    sidebarEnd: "#161e27",
    buttonText: "#10161e",
  }),
  paper: buildPalette({
    scheme: "light",
    bg: "#eceff4",
    panel: "#ffffff",
    ink: "#4c566a",
    inkStrong: "#2e3440",
    accent: "#4a6a94",
    accentSoft: "#dbe4ef",
    line: "#c5cdd9",
    glow: "transparent",
    sidebarStart: "#e5e9f0",
    sidebarEnd: "#e5e9f0",
    buttonText: "#ffffff",
  }),
  nord: buildPalette({
    scheme: "dark",
    bg: "#2e3440",
    panel: "#3b4252",
    panelHover: "#434c5e",
    ink: "#d8dee9",
    inkStrong: "#eceff4",
    accent: "#88c0d0",
    accentSoft: "rgba(136, 192, 208, 0.2)",
    accentSoftHex: "#4b5c6c",
    line: "#4c566a",
    lineStrong: "#5e81ac",
    lineStrongHex: "#5e81ac",
    glow: "transparent",
    sidebarStart: "#3b4252",
    sidebarEnd: "#3b4252",
    buttonText: "#0d0f14",
    danger: "#ecc4c8",
    success: "#bcd4aa",
  }),
});

export const KY_THEME_CHOICE_GROUPS: readonly KyThemeChoiceGroup[] = Object.freeze(
  KY_THEME_PAIRS.map((pair) => {
    const lightEntry = KY_THEME_CATALOG.find((e) => e.id === pair.light)!;
    const darkEntry = KY_THEME_CATALOG.find((e) => e.id === pair.dark)!;
    return Object.freeze({
      pair,
      lightName: lightEntry.name,
      darkName: darkEntry.name,
      choices: Object.freeze([
        {
          mode: "system" as const,
          label: "Match system",
          value: pair.id === "busnes-pair" ? ("system" as const) : pair.id,
        },
        { mode: "light" as const, label: "Light", value: pair.light },
        { mode: "dark" as const, label: "Dark", value: pair.dark },
      ]),
    });
  }),
);

export function systemPrefersDark(): boolean {
  try {
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  } catch {
    return false;
  }
}

export function findKyPair(value: string | null | undefined): KyThemePair | undefined {
  if (!value) {
    return undefined;
  }
  return KY_THEME_PAIRS.find((pair) => pair.id === value);
}

export function canonicalKyThemeChoice(
  value: string | null | undefined,
): KyThemeChoice | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === "system") {
    return "system";
  }
  if (trimmed === "light") {
    return "busnes-light";
  }
  if (trimmed === "dark") {
    return "busnes-dark";
  }
  const pair = findKyPair(trimmed);
  if (pair) {
    return pair.id === "busnes-pair" ? "system" : pair.id;
  }
  const entry = KY_THEME_CATALOG.find(
    (item) => item.id === trimmed || item.name === trimmed || item.aliases.includes(trimmed),
  );
  return entry?.id;
}

export function resolveKyThemeHalf(
  choice: string | null | undefined,
  dark: boolean = systemPrefersDark(),
): KyThemeEntry {
  const canonical = canonicalKyThemeChoice(choice) ?? "system";
  if (canonical === "system") {
    return KY_THEME_CATALOG.find((e) => e.id === (dark ? "busnes-dark" : "busnes-light"))!;
  }
  const pair = findKyPair(canonical);
  if (pair) {
    const halfId = dark ? pair.dark : pair.light;
    return KY_THEME_CATALOG.find((e) => e.id === halfId)!;
  }
  return (
    KY_THEME_CATALOG.find((e) => e.id === canonical) ??
    KY_THEME_CATALOG.find((e) => e.id === (dark ? "busnes-dark" : "busnes-light"))!
  );
}

export function readStoredKyTheme(storage?: Storage): KyThemeChoice {
  try {
    const store = storage ?? globalThis.localStorage;
    if (!store) {
      return "system";
    }
    const raw = store.getItem(KY_THEME_STORAGE_KEY);
    const canonical = canonicalKyThemeChoice(raw);
    if (canonical) {
      return canonical;
    }
    const legacy = store.getItem(LEGACY_BW_THEME_KEY);
    if (legacy) {
      const cleaned = legacy.replace(/^"|"$/g, "");
      const mapped = canonicalKyThemeChoice(cleaned);
      if (mapped) {
        return mapped;
      }
    }
  } catch {
    // Storage may be unavailable in restricted contexts.
  }
  return "system";
}

export function writeStoredKyTheme(choice: KyThemeChoice, storage?: Storage): KyThemeChoice {
  const canonical = canonicalKyThemeChoice(choice) ?? "system";
  try {
    const store = storage ?? globalThis.localStorage;
    if (store) {
      store.setItem(KY_THEME_STORAGE_KEY, canonical);
      const legacyVal =
        canonical === "system" || findKyPair(canonical)
          ? '"system"'
          : resolveKyThemeHalf(canonical).scheme === "dark"
            ? '"dark"'
            : '"light"';
      store.setItem(LEGACY_BW_THEME_KEY, legacyVal);
    }
  } catch {
    // Ignore storage errors.
  }
  return canonical;
}

export function applyKyTheme(
  choice: string | null | undefined,
  root: HTMLElement | null | undefined = globalThis.document?.documentElement,
  dark: boolean = systemPrefersDark(),
): KyAppliedTheme {
  const canonical = canonicalKyThemeChoice(choice) ?? "system";
  const half = resolveKyThemeHalf(canonical, dark);
  const palette = KY_THEME_PALETTES[half.id];
  const isDark = half.scheme === "dark";

  if (root) {
    root.dataset.theme = half.id;
    root.dataset.kyTheme = half.id;
    root.classList.remove("theme_light", "theme_dark");
    root.classList.add(isDark ? "theme_dark" : "theme_light");
    root.style.colorScheme = half.scheme;

    // Canonical @busnes/ky-ui properties
    root.style.setProperty("--bg", palette.bg);
    root.style.setProperty("--panel", palette.panel);
    root.style.setProperty("--panel-hover", palette.panelHover);
    root.style.setProperty("--ink", palette.ink);
    root.style.setProperty("--ink-strong", palette.inkStrong);
    root.style.setProperty("--ink-muted", palette.inkMuted);
    root.style.setProperty("--accent", palette.accent);
    root.style.setProperty("--accent-soft", palette.accentSoft);
    root.style.setProperty("--line", palette.line);
    root.style.setProperty("--line-strong", palette.lineStrong);
    root.style.setProperty("--glow", palette.glow);
    root.style.setProperty("--sidebar-start", palette.sidebarStart);
    root.style.setProperty("--sidebar-end", palette.sidebarEnd);
    root.style.setProperty("--button-text", palette.buttonText);
    root.style.setProperty("--danger", palette.danger);
    root.style.setProperty("--success", palette.success);
    root.style.setProperty("--warning", palette.warning);

    // Derived RGB triplets for legacy Bitwarden Tailwind `rgb(var(--color-*) / <alpha>)` utilities
    const accentHoverHex = mixHex(palette.accent, palette.inkStrong, 0.84);
    const accent300Hex = mixHex(palette.accent, palette.panel, 0.55);
    const dangerHoverHex = mixHex(palette.danger, palette.inkStrong, 0.84);
    const dangerSoftHex = mixHex(palette.danger, palette.panel, 0.14);
    const successHoverHex = mixHex(palette.success, palette.inkStrong, 0.84);
    const successSoftHex = mixHex(palette.success, palette.panel, 0.14);
    const warningHoverHex = mixHex(palette.warning, palette.inkStrong, 0.84);
    const warningSoftHex = mixHex(palette.warning, palette.panel, 0.16);

    root.style.setProperty("--ky-bg-rgb", hexToRgbTriplet(palette.bg));
    root.style.setProperty("--ky-panel-rgb", hexToRgbTriplet(palette.panel));
    root.style.setProperty("--ky-panel-hover-rgb", hexToRgbTriplet(palette.panelHover));
    root.style.setProperty("--ky-ink-rgb", hexToRgbTriplet(palette.ink));
    root.style.setProperty("--ky-ink-strong-rgb", hexToRgbTriplet(palette.inkStrong));
    root.style.setProperty("--ky-accent-rgb", hexToRgbTriplet(palette.accent));
    root.style.setProperty("--ky-accent-hover-rgb", hexToRgbTriplet(accentHoverHex));
    root.style.setProperty("--ky-accent-soft-rgb", hexToRgbTriplet(palette.accentSoftHex));
    root.style.setProperty("--ky-accent-300-rgb", hexToRgbTriplet(accent300Hex));
    root.style.setProperty("--ky-line-rgb", hexToRgbTriplet(palette.lineHex));
    root.style.setProperty("--ky-line-strong-rgb", hexToRgbTriplet(palette.lineStrongHex));
    root.style.setProperty("--ky-button-text-rgb", hexToRgbTriplet(palette.buttonText));
    root.style.setProperty("--ky-danger-rgb", hexToRgbTriplet(palette.danger));
    root.style.setProperty("--ky-danger-hover-rgb", hexToRgbTriplet(dangerHoverHex));
    root.style.setProperty("--ky-danger-soft-rgb", hexToRgbTriplet(dangerSoftHex));
    root.style.setProperty("--ky-success-rgb", hexToRgbTriplet(palette.success));
    root.style.setProperty("--ky-success-hover-rgb", hexToRgbTriplet(successHoverHex));
    root.style.setProperty("--ky-success-soft-rgb", hexToRgbTriplet(successSoftHex));
    root.style.setProperty("--ky-warning-rgb", hexToRgbTriplet(palette.warning));
    root.style.setProperty("--ky-warning-hover-rgb", hexToRgbTriplet(warningHoverHex));
    root.style.setProperty("--ky-warning-soft-rgb", hexToRgbTriplet(warningSoftHex));

    // Keep browser theme-color meta tag in sync with the active surface
    const metaThemeColor = root.ownerDocument?.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", palette.bg);
    }
  }

  return {
    choice: canonical,
    half,
    scheme: half.scheme,
  };
}
