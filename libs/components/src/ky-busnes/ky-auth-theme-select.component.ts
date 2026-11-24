import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";

import {
  applyKyTheme,
  KY_THEME_CHOICE_GROUPS,
  KY_THEME_STORAGE_KEY,
  KyThemeChoice,
  readStoredKyTheme,
  writeStoredKyTheme,
} from "@bitwarden/common/platform/theming/ky-theme";

@Component({
  selector: "ky-auth-theme-select",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ky-auth-theme">
      <select aria-label="Theme" [value]="choice()" (change)="onSelect($event)">
        @for (group of groups; track group.pair.id) {
          <optgroup [label]="group.pair.name">
            @for (option of group.choices; track option.value) {
              <option [value]="option.value" [selected]="choice() === option.value">
                {{ group.pair.name }} — {{ option.label }}
              </option>
            }
          </optgroup>
        }
      </select>
    </div>
  `,
})
export class KyAuthThemeSelectComponent {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly groups = KY_THEME_CHOICE_GROUPS;
  protected readonly choice = signal<KyThemeChoice>(readStoredKyTheme());

  constructor() {
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
      this.destroyRef.onDestroy(() => {
        win.removeEventListener("storage", onStorage);
      });
    }
  }

  protected onSelect(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (!select) {
      return;
    }
    const saved = writeStoredKyTheme(select.value as KyThemeChoice);
    this.choice.set(saved);
    applyKyTheme(saved, this.document.documentElement);
  }
}
