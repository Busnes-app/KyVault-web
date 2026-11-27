import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { tenancyFeatureGuard } from "./tenancy.guard";
import { TenancyService, TenancyState } from "./tenancy.service";
import { recoveryUserId, tenancyStatus } from "./tenancy.spec-util";

describe("tenancyFeatureGuard", () => {
  const state$ = new BehaviorSubject<TenancyState>({
    kind: "ready",
    userId: recoveryUserId,
    status: tenancyStatus,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TenancyService, useValue: { state$ } }],
    });
  });

  function activate(feature: "allowSends" | "allowEmergencyAccess") {
    return TestBed.runInInjectionContext(() =>
      tenancyFeatureGuard(feature)(new ActivatedRouteSnapshot(), {} as RouterStateSnapshot),
    );
  }

  it.each(["allowSends", "allowEmergencyAccess"] as const)(
    "blocks direct %s routes when disallowed",
    async (feature) => {
      state$.next({ kind: "ready", userId: recoveryUserId, status: tenancyStatus });
      const result = await activate(feature);
      expect(result).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe("/vault");
    },
  );

  it.each(["allowSends", "allowEmergencyAccess"] as const)(
    "preserves single-tenant %s routes including a 404 fallback",
    async (feature) => {
      state$.next({
        kind: "ready",
        userId: recoveryUserId,
        status: { ...tenancyStatus, multiTenant: false },
      });
      expect(await activate(feature)).toBe(true);
      state$.next({ kind: "unsupported", userId: recoveryUserId });
      expect(await activate(feature)).toBe(true);
    },
  );

  it("waits for status and fails closed on status failure", async () => {
    state$.next({ kind: "loading", userId: recoveryUserId });
    const result = activate("allowSends");
    state$.next({ kind: "unavailable", userId: recoveryUserId });
    expect(await result).toBeInstanceOf(UrlTree);
    state$.next({
      kind: "ready",
      userId: recoveryUserId,
      status: { ...tenancyStatus, allowEmergencyAccess: true },
    });
    expect(await activate("allowEmergencyAccess")).toBe(true);
  });
});
