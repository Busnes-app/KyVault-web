import {
  applyKyTheme,
  canonicalKyThemeChoice,
  hexToRgbTriplet,
  KY_THEME_CATALOG,
  KY_THEME_CHOICE_GROUPS,
  KY_THEME_PAIRS,
  KY_THEME_PALETTES,
  KY_THEME_STORAGE_KEY,
  LEGACY_BW_THEME_KEY,
  readStoredKyTheme,
  resolveKyThemeHalf,
  writeStoredKyTheme,
} from "./ky-theme";

describe("ky-theme", () => {
  it("defines 6 palette pairs and 12 halves matching @busnes/ky-ui v0.12.0", () => {
    expect(KY_THEME_PAIRS).toHaveLength(6);
    expect(KY_THEME_CATALOG).toHaveLength(12);
    expect(KY_THEME_CHOICE_GROUPS).toHaveLength(6);
    for (const entry of KY_THEME_CATALOG) {
      expect(KY_THEME_PALETTES[entry.id]).toBeDefined();
    }
  });

  it("converts hex colors to space-separated RGB triplets", () => {
    expect(hexToRgbTriplet("#bf3f18")).toBe("191 63 24");
    expect(hexToRgbTriplet("#f8f6f0")).toBe("248 246 240");
    expect(hexToRgbTriplet("#fff")).toBe("255 255 255");
  });

  it("canonicalizes legacy Bitwarden and ky-ui alias values", () => {
    expect(canonicalKyThemeChoice("system")).toBe("system");
    expect(canonicalKyThemeChoice("busnes-pair")).toBe("system");
    expect(canonicalKyThemeChoice("light")).toBe("busnes-light");
    expect(canonicalKyThemeChoice("dark")).toBe("busnes-dark");
    expect(canonicalKyThemeChoice("White Cliffs")).toBe("white-cliffs");
    expect(canonicalKyThemeChoice("Patina Ky")).toBe("patina-ky");
    expect(canonicalKyThemeChoice("Nord Slate")).toBe("nord");
    expect(canonicalKyThemeChoice("ocean-pair")).toBe("ocean-pair");
    expect(canonicalKyThemeChoice("unknown-removed-theme")).toBeUndefined();
  });

  it("resolves pairs according to OS dark-mode preference", () => {
    expect(resolveKyThemeHalf("system", false).id).toBe("busnes-light");
    expect(resolveKyThemeHalf("system", true).id).toBe("busnes-dark");
    expect(resolveKyThemeHalf("ocean-pair", false).id).toBe("white-cliffs");
    expect(resolveKyThemeHalf("ocean-pair", true).id).toBe("ocean");
    expect(resolveKyThemeHalf("forest", false).id).toBe("forest");
    expect(resolveKyThemeHalf("paper", true).id).toBe("paper");
  });

  it("applies CSS variables, RGB triplets, data attributes, and theme classes cleanly", () => {
    const root = document.createElement("html");
    const result = applyKyTheme("forest-pair", root, true);

    expect(result.half.id).toBe("forest");
    expect(result.scheme).toBe("dark");
    expect(root.dataset.theme).toBe("forest");
    expect(root.dataset.kyTheme).toBe("forest");
    expect(root.classList.contains("theme_dark")).toBe(true);
    expect(root.classList.contains("theme_light")).toBe(false);
    expect(root.style.getPropertyValue("--bg")).toBe("#142018");
    expect(root.style.getPropertyValue("--accent")).toBe("#8faa74");
    expect(root.style.getPropertyValue("--success")).toBe("#6ee0d0");
    expect(root.style.getPropertyValue("--ky-accent-rgb")).toBe("143 170 116");
  });

  it("reads and migrates legacy localStorage theme selection", () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: (): null => null,
      length: 0,
    } as unknown as Storage;

    expect(readStoredKyTheme(mockStorage)).toBe("system");

    store.set(LEGACY_BW_THEME_KEY, '"dark"');
    expect(readStoredKyTheme(mockStorage)).toBe("busnes-dark");

    writeStoredKyTheme("nord", mockStorage);
    expect(store.get(KY_THEME_STORAGE_KEY)).toBe("nord");
    expect(store.get(LEGACY_BW_THEME_KEY)).toBe('"dark"');
    expect(readStoredKyTheme(mockStorage)).toBe("nord");
  });
});
