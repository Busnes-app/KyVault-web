import { webcrypto } from "node:crypto";

import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { UserKey, UserPrivateKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { PersonalRecoveryService } from "./personal-recovery.service";
import { TenancyService } from "./tenancy.service";
import { recoveryUserId } from "./tenancy.spec-util";

describe("PersonalRecoveryService", () => {
  const api = mock<ApiService>();
  const keys = mock<KeyService>();
  const refresh = jest.fn();
  const context = { userId: recoveryUserId, tenantId: "org-123" };
  const originalCrypto = globalThis.crypto;
  let service: PersonalRecoveryService;

  beforeAll(() => {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true });
  });
  beforeEach(() => {
    jest.resetAllMocks();
    const user = makeSymmetricCryptoKey<UserKey>(64, 17);
    user.keyB64 = btoa(String.fromCharCode(...new Uint8Array(64).fill(17)));
    keys.userKey$.mockReturnValue(of(user));
    keys.userPrivateKey$.mockReturnValue(of(null));
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: KeyService, useValue: keys },
        { provide: TenancyService, useValue: { refresh } },
      ],
    });
    service = TestBed.inject(PersonalRecoveryService);
  });

  it("keeps live keys intact, uploads only encrypted payloads, and refreshes after mutations", async () => {
    const livePrivate = new Uint8Array(512).fill(29) as UserPrivateKey;
    keys.userPrivateKey$.mockReturnValue(of(livePrivate));
    const prepared = await service.prepare(context);
    expect(api.send).not.toHaveBeenCalled();
    expect(livePrivate.every((byte) => byte === 29)).toBe(true);
    await service.save(prepared.payload, recoveryUserId);
    const wire = JSON.stringify(api.send.mock.calls);
    expect(wire).not.toContain(prepared.secret);
    expect(wire).not.toContain(btoa(String.fromCharCode(...livePrivate)));
    expect(wire).not.toContain(btoa(String.fromCharCode(...new Uint8Array(64).fill(17))));
    expect(api.send).toHaveBeenCalledWith(
      "PUT",
      "/tenancy/recovery/personal",
      prepared.payload,
      recoveryUserId,
      true,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    api.send.mockResolvedValue(prepared.payload);
    expect(await service.verify(prepared.secret, context)).toBe(true);
    expect(api.send).toHaveBeenLastCalledWith(
      "GET",
      "/tenancy/recovery/personal",
      null,
      recoveryUserId,
      true,
    );
    await service.revoke(recoveryUserId);
    expect(api.send).toHaveBeenLastCalledWith(
      "DELETE",
      "/tenancy/recovery/personal",
      null,
      recoveryUserId,
      false,
    );
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("detects a recovery bundle made stale by user-key rotation", async () => {
    const prepared = await service.prepare(context);
    api.send.mockResolvedValue(prepared.payload);
    const rotated = makeSymmetricCryptoKey<UserKey>(64, 99);
    rotated.keyB64 = btoa(String.fromCharCode(...new Uint8Array(64).fill(99)));
    keys.userKey$.mockReturnValue(of(rotated));
    expect(await service.verify(prepared.secret, context)).toBe(false);
  });

  it("requires an unlocked key and leaves status untouched after a failed write", async () => {
    keys.userKey$.mockReturnValue(of(null));
    await expect(service.prepare(context)).rejects.toThrow("Unlock");
    api.send.mockRejectedValue({ statusCode: 403 });
    await expect(service.revoke(recoveryUserId)).rejects.toEqual({ statusCode: 403 });
    expect(refresh).not.toHaveBeenCalled();
  });
});
