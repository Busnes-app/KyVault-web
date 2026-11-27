import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { combineLatest, map, switchMap } from "rxjs";

import { canAccessEmergencyAccess } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nPipe } from "@bitwarden/ui-common";
import { LockService, LockSource } from "@bitwarden/unlock";
import { PremiumSubscriptionRoutingService } from "@bitwarden/web-vault/app/billing/individual/services/premium-subscription-routing.service";

import { TenancyService, tenancyAllows } from "../tenancy/tenancy.service";
import { TenantStatusComponent } from "../tenancy/tenant-status.component";

@Component({
  selector: "ky-settings-layout",
  standalone: true,
  imports: [AsyncPipe, I18nPipe, RouterLink, RouterLinkActive, RouterOutlet, TenantStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ky-settings-shell">
      <header class="ky-page-head">
        <div>
          <h1 class="ky-page-title">{{ "settings" | i18n }}</h1>
        </div>
        @if (canLock$ | async) {
          <div class="ky-page-actions">
            <button type="button" class="ky-btn-secondary" (click)="lock()">
              {{ "lockNow" | i18n }}
            </button>
          </div>
        }
      </header>

      <nav class="ky-settings-tabs" [attr.aria-label]="'settings' | i18n">
        <a
          class="ky-nav-item"
          routerLink="account"
          routerLinkActive
          #rlaAccount="routerLinkActive"
          [attr.aria-current]="rlaAccount.isActive ? 'page' : null"
        >
          {{ "myAccount" | i18n }}
        </a>
        <a
          class="ky-nav-item"
          routerLink="security"
          routerLinkActive
          #rlaSecurity="routerLinkActive"
          [attr.aria-current]="rlaSecurity.isActive ? 'page' : null"
        >
          {{ "security" | i18n }}
        </a>
        <a
          class="ky-nav-item"
          routerLink="appearance"
          routerLinkActive
          #rlaAppearance="routerLinkActive"
          [attr.aria-current]="rlaAppearance.isActive ? 'page' : null"
        >
          {{ "appearance" | i18n }}
        </a>
        <a
          class="ky-nav-item"
          routerLink="domain-rules"
          routerLinkActive
          #rlaDomain="routerLinkActive"
          [attr.aria-current]="rlaDomain.isActive ? 'page' : null"
        >
          {{ "domainRules" | i18n }}
        </a>
        @if (showEmergencyAccess()) {
          <a
            class="ky-nav-item"
            routerLink="emergency-access"
            routerLinkActive
            #rlaEmergency="routerLinkActive"
            [attr.aria-current]="rlaEmergency.isActive ? 'page' : null"
          >
            {{ "emergencyAccess" | i18n }}
          </a>
        }
        @if (subscriptionRoute$ | async; as subscriptionRoute) {
          <a
            class="ky-nav-item"
            [routerLink]="subscriptionRoute"
            routerLinkActive
            #rlaSubscription="routerLinkActive"
            [attr.aria-current]="rlaSubscription.isActive ? 'page' : null"
          >
            {{ "subscription" | i18n }}
          </a>
        }
      </nav>

      <ky-tenant-status />
      <router-outlet></router-outlet>
    </div>
  `,
})
export class KySettingsLayoutComponent {
  private readonly tenancy = inject(TenancyService);
  private readonly accountService = inject(AccountService);
  private readonly policyService = inject(PolicyService);
  private readonly vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  private readonly lockService = inject(LockService);
  private readonly premiumSubscriptionRoutingService = inject(PremiumSubscriptionRoutingService);

  private readonly account = toSignal(this.accountService.activeAccount$);

  protected readonly showEmergencyAccess = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        combineLatest([canAccessEmergencyAccess(userId, this.policyService), this.tenancy.state$]),
      ),
      map(([allowed, state]) => allowed && tenancyAllows(state, "allowEmergencyAccess")),
    ),
    { initialValue: false },
  );

  protected readonly subscriptionRoute$ =
    this.premiumSubscriptionRoutingService.getSubscriptionRoute$();

  protected readonly canLock$ = this.vaultTimeoutSettingsService
    .availableVaultTimeoutActions$()
    .pipe(map((actions) => actions.includes(VaultTimeoutAction.Lock)));

  protected async lock(): Promise<void> {
    const userId = this.account()?.id;
    if (userId) {
      await this.lockService.lock(userId, LockSource.Manual);
    }
  }
}
