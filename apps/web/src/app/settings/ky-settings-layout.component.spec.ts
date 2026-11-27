import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LockService } from "@bitwarden/unlock";

import { PremiumSubscriptionRoutingService } from "../billing/individual/services/premium-subscription-routing.service";
import { TenancyService, TenancyState } from "../tenancy/tenancy.service";
import { recoveryUserId, tenancyStatus } from "../tenancy/tenancy.spec-util";

import { KySettingsLayoutComponent } from "./ky-settings-layout.component";

describe("KySettingsLayoutComponent tenancy", () => {
  it("gates Emergency Access while preserving single-tenant and organization policy behavior", () => {
    const state$ = new BehaviorSubject<TenancyState>({
      kind: "ready",
      userId: recoveryUserId,
      status: tenancyStatus,
    });
    const state = signal<TenancyState>(state$.value);
    const policy = new BehaviorSubject(false);
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key) => key);
    TestBed.configureTestingModule({
      imports: [KySettingsLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: TenancyService, useValue: { state$, state } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: recoveryUserId }) } },
        { provide: PolicyService, useValue: { policyAppliesToUser$: () => policy } },
        {
          provide: VaultTimeoutSettingsService,
          useValue: { availableVaultTimeoutActions$: () => of([]) },
        },
        { provide: LockService, useValue: mock<LockService>() },
        {
          provide: PremiumSubscriptionRoutingService,
          useValue: { getSubscriptionRoute$: () => of(null) },
        },
        { provide: I18nService, useValue: i18n },
      ],
    });
    const fixture = TestBed.createComponent(KySettingsLayoutComponent);
    fixture.detectChanges();
    const emergencyLink = () => fixture.nativeElement.querySelector('a[href="/emergency-access"]');
    expect(emergencyLink()).toBeNull();
    state$.next({
      kind: "ready",
      userId: recoveryUserId,
      status: { ...tenancyStatus, multiTenant: false },
    });
    fixture.detectChanges();
    expect(emergencyLink()).not.toBeNull();
    policy.next(true);
    fixture.detectChanges();
    expect(emergencyLink()).toBeNull();
  });
});
