import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, filter, firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { TenancyService, parseTenancyStatus, tenancyAllows } from "./tenancy.service";
import { recoveryUserId, tenancyStatus } from "./tenancy.spec-util";

describe("TenancyService", () => {
  const api = mock<ApiService>();
  const accounts = new BehaviorSubject<{ id: typeof recoveryUserId } | null>({
    id: recoveryUserId,
  });
  let service: TenancyService;

  beforeEach(() => {
    jest.resetAllMocks();
    accounts.next({ id: recoveryUserId });
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AccountService, useValue: { activeAccount$: accounts } },
      ],
    });
  });

  async function settled() {
    service = TestBed.inject(TenancyService);
    return firstValueFrom(service.state$.pipe(filter((state) => state.kind !== "loading")));
  }

  it("silently preserves single-tenant features on an authenticated 404", async () => {
    api.send.mockRejectedValue({ statusCode: 404 });
    const log = jest.spyOn(console, "error").mockImplementation();
    const state = await settled();
    expect(state.kind).toBe("unsupported");
    expect(tenancyAllows(state, "allowSends")).toBe(true);
    expect(tenancyAllows(state, "allowEmergencyAccess")).toBe(true);
    expect(api.send).toHaveBeenCalledWith("GET", "/tenancy/status", null, recoveryUserId, true);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("parses and caches every backend status field", async () => {
    api.send.mockResolvedValue(tenancyStatus);
    const state = await settled();
    expect(state).toEqual({ kind: "ready", userId: recoveryUserId, status: tenancyStatus });
    expect(await settled()).toEqual(state);
    expect(api.send).toHaveBeenCalledTimes(1);
    expect(tenancyAllows(state, "allowSends")).toBe(false);
  });

  it("keeps single-tenant features enabled even when deployment flags are false", async () => {
    api.send.mockResolvedValue({ ...tenancyStatus, multiTenant: false });
    const state = await settled();
    expect(state.kind).toBe("ready");
    expect(tenancyAllows(state, "allowSends")).toBe(true);
    expect(tenancyAllows(state, "allowEmergencyAccess")).toBe(true);
  });

  it("refreshes kit presence and drops cached tenant data on logout", async () => {
    api.send
      .mockResolvedValueOnce(tenancyStatus)
      .mockResolvedValueOnce({ ...tenancyStatus, recovery: { hasPersonalRecoveryKit: true } });
    await settled();
    service.refresh();
    expect(await settled()).toMatchObject({
      status: { recovery: { hasPersonalRecoveryKit: true } },
    });
    accounts.next(null);
    expect(service.state()).toEqual({ kind: "loading", userId: null });
  });

  it("fails closed on network failure or malformed responses", async () => {
    api.send.mockRejectedValue({ statusCode: 503 });
    const state = await settled();
    expect(state.kind).toBe("unavailable");
    expect(tenancyAllows(state, "allowSends")).toBe(false);
    expect(() => parseTenancyStatus({ ...tenancyStatus, allowSends: "yes" })).toThrow();
    expect(() => parseTenancyStatus({ ...tenancyStatus, storageUsedBytes: -1 })).toThrow();
    expect(() => parseTenancyStatus({ ...tenancyStatus, recovery: null })).toThrow();
  });
});
