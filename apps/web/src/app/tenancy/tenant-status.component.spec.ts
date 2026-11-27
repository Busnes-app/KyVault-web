import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { TenancyService, TenancyState } from "./tenancy.service";
import { recoveryUserId, tenancyStatus } from "./tenancy.spec-util";
import { TenantStatusComponent } from "./tenant-status.component";

describe("TenantStatusComponent", () => {
  const state = signal<TenancyState>({
    kind: "ready",
    userId: recoveryUserId,
    status: tenancyStatus,
  });
  beforeEach(() => {
    state.set({ kind: "ready", userId: recoveryUserId, status: tenancyStatus });
    TestBed.configureTestingModule({
      imports: [TenantStatusComponent],
      providers: [provideRouter([]), { provide: TenancyService, useValue: { state } }],
    });
  });

  it("shows tenant placement, quotas, readable storage and a recovery warning", () => {
    const fixture = TestBed.createComponent(TenantStatusComponent);
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain("org-123");
    expect(text).toContain("eu-west-1");
    expect(text).toContain("12 / 50,000");
    expect(text).toContain("1 KiB / 256 MiB");
    expect(text).toContain("1 KiB / 1 GiB");
    expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe(
      "/settings/security/personal-recovery",
    );
  });

  it("warns when over storage and removes the recovery reminder after creation", () => {
    state.set({
      kind: "ready",
      userId: recoveryUserId,
      status: {
        ...tenancyStatus,
        storageOverSince: "2026-11-26T00:00:00Z",
        recovery: { hasPersonalRecoveryKit: true },
      },
    });
    const fixture = TestBed.createComponent(TenantStatusComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("exceeded its storage pool");
    expect(fixture.nativeElement.querySelector("a")).toBeNull();
  });

  it("renders no panel or warning in single-tenant mode or on older servers", () => {
    const fixture = TestBed.createComponent(TenantStatusComponent);
    state.set({
      kind: "ready",
      userId: recoveryUserId,
      status: { ...tenancyStatus, multiTenant: false },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("section")).toBeNull();
    state.set({ kind: "unsupported", userId: recoveryUserId });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe("");
  });
});
