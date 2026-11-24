import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink } from "@angular/router";
import { filter, map, startWith } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { KyAboutTriggerComponent, SideNavService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "ky-sidebar-footer",
  standalone: true,
  imports: [AsyncPipe, I18nPipe, KyAboutTriggerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ky-sidebar-foot">
      @if (account(); as acct) {
        <div class="ky-user">
          <div class="ky-user-copy">
            <p class="ky-user-name" [title]="primaryLabel()">{{ primaryLabel() }}</p>
            @if (secondaryLabel(); as secondary) {
              <p class="ky-user-role" [title]="secondary">{{ secondary }}</p>
            }
          </div>
          <div class="ky-user-actions">
            <a
              class="ky-icon-button"
              routerLink="/settings/account"
              (click)="closeOverlayIfMobile()"
              [attr.aria-current]="isSettingsRoute() ? 'page' : null"
              [attr.aria-label]="'settings' | i18n"
              [title]="'settings' | i18n"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </a>
            <button
              type="button"
              class="ky-icon-button"
              (click)="logout()"
              [attr.aria-label]="'logOut' | i18n"
              [title]="'logOut' | i18n"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      }
      <footer>
        <ky-about-trigger
          [label]="licenseLabel"
          [version]="(version$ | async) ?? undefined"
        ></ky-about-trigger>
      </footer>
    </div>
  `,
})
export class KySidebarFooterComponent {
  private readonly accountService = inject(AccountService);
  private readonly logoutService = inject(LogoutService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly sideNavService = inject(SideNavService);
  private readonly router = inject(Router);

  protected readonly account = toSignal(this.accountService.activeAccount$);
  protected readonly version$ = this.platformUtilsService.getApplicationVersion();
  protected readonly licenseLabel = `© ${new Date().getFullYear()} · GPL-3.0 License`;

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isSettingsRoute = computed(() => this.currentUrl().startsWith("/settings"));

  protected readonly primaryLabel = computed(() => {
    const acct = this.account();
    if (!acct) {
      return "";
    }
    const name = acct.name?.trim();
    return name || acct.email;
  });

  protected readonly secondaryLabel = computed(() => {
    const acct = this.account();
    if (!acct) {
      return null;
    }
    const name = acct.name?.trim();
    if (name && name.toLowerCase() !== acct.email.toLowerCase()) {
      return acct.email;
    }
    return null;
  });

  protected closeOverlayIfMobile(): void {
    if (this.sideNavService.isOverlay()) {
      this.sideNavService.open.set(false);
    }
  }

  protected async logout(): Promise<void> {
    const userId = this.account()?.id;
    if (userId) {
      await this.logoutService.logout(userId, "userInitiated");
    }
  }
}

@Component({
  selector: "ky-mobile-actions",
  standalone: true,
  imports: [I18nPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ky-mobile-actions">
      <a
        class="ky-icon-button"
        routerLink="/settings/account"
        [attr.aria-current]="isSettingsRoute() ? 'page' : null"
        [attr.aria-label]="'settings' | i18n"
        [title]="'settings' | i18n"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </a>
      <button
        type="button"
        class="ky-icon-button"
        (click)="logout()"
        [attr.aria-label]="'logOut' | i18n"
        [title]="'logOut' | i18n"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
      </button>
    </div>
  `,
})
export class KyMobileActionsComponent {
  private readonly accountService = inject(AccountService);
  private readonly logoutService = inject(LogoutService);
  private readonly router = inject(Router);

  private readonly account = toSignal(this.accountService.activeAccount$);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isSettingsRoute = computed(() => this.currentUrl().startsWith("/settings"));

  protected async logout(): Promise<void> {
    const userId = this.account()?.id;
    if (userId) {
      await this.logoutService.logout(userId, "userInitiated");
    }
  }
}

@Component({
  selector: "ky-mobile-footer",
  standalone: true,
  imports: [AsyncPipe, KyAboutTriggerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="ky-content-foot">
      <ky-about-trigger
        [label]="licenseLabel"
        [version]="(version$ | async) ?? undefined"
      ></ky-about-trigger>
    </footer>
  `,
})
export class KyMobileFooterComponent {
  private readonly platformUtilsService = inject(PlatformUtilsService);
  protected readonly version$ = this.platformUtilsService.getApplicationVersion();
  protected readonly licenseLabel = `© ${new Date().getFullYear()} · GPL-3.0 License`;
}
