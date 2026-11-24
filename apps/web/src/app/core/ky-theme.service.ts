import { DOCUMENT } from "@angular/common";
import { DestroyRef, inject, Injectable, signal } from "@angular/core";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import {
  applyKyTheme,
  findKyPair,
  KY_THEME_STORAGE_KEY,
  KyThemeChoice,
  readStoredKyTheme,
  resolveKyThemeHalf,
  writeStoredKyTheme,
} from "@bitwarden/common/platform/theming/ky-theme";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

@Injectable({
  providedIn: "root",
})
export class KyThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly themeStateService = inject(ThemeStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly choice = signal<KyThemeChoice>(readStoredKyTheme());

  constructor() {
    applyKyTheme(this.choice(), this.document.documentElement);

    const win = this.document.defaultView;
    if (win) {
      const onStorage = (event: StorageEvent) => {
        if (event.key === KY_THEME_STORAGE_KEY || event.key === null) {
          const next = readStoredKyTheme();
          this.choice.set(next);
          applyKyTheme(next, this.document.documentElement);
        }
      };
      win.addEventListener("storage", onStorage);

      const media = win.matchMedia?.("(prefers-color-scheme: dark)");
      const onMediaChange = (event: MediaQueryListEvent) => {
        applyKyTheme(this.choice(), this.document.documentElement, event.matches);
      };
      media?.addEventListener?.("change", onMediaChange);

      this.destroyRef.onDestroy(() => {
        win.removeEventListener("storage", onStorage);
        media?.removeEventListener?.("change", onMediaChange);
      });
    }
  }

  async setChoice(next: KyThemeChoice): Promise<void> {
    const saved = writeStoredKyTheme(next);
    this.choice.set(saved);
    applyKyTheme(saved, this.document.documentElement);

    const bwTheme: Theme =
      saved === "system" || findKyPair(saved)
        ? ThemeTypes.System
        : resolveKyThemeHalf(saved).scheme === "dark"
          ? ThemeTypes.Dark
          : ThemeTypes.Light;
    await this.themeStateService.setSelectedTheme(bwTheme);
  }
}
