import { webcrypto } from "node:crypto";

import { createPersonalRecovery, openPersonalRecovery } from "./personal-recovery-crypto";

describe("Personal Recovery Kit WebCrypto envelope", () => {
  const context = { userId: "user-123", tenantId: "org-123" };
  const originalCrypto = globalThis.crypto;

  beforeAll(() => {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true });
  });

  it("round trips user and private keys and wipes owned inputs", async () => {
    const expected = crypto.getRandomValues(new Uint8Array(64));
    const expectedPrivate = crypto.getRandomValues(new Uint8Array(512));
    const user = expected.slice();
    const privateKey = expectedPrivate.slice();
    const { secret, payload } = await createPersonalRecovery(user, context, privateKey);
    expect(secret).toMatch(/^[a-f0-9]{8}(-[a-f0-9]{8}){7}$/);
    expect(user.every((byte) => byte === 0)).toBe(true);
    expect(privateKey.every((byte) => byte === 0)).toBe(true);
    const opened = await openPersonalRecovery(payload, secret, context);
    expect(opened.userKey).toEqual(expected);
    expect(opened.privateKey).toEqual(expectedPrivate);
    opened.userKey.fill(0);
    opened.privateKey?.fill(0);
  });

  it("sends only ciphertext and public KDF parameters within backend size caps", async () => {
    const user = crypto.getRandomValues(new Uint8Array(64));
    const rawBase64 = btoa(String.fromCharCode(...user));
    const { secret, payload } = await createPersonalRecovery(user, context);
    const wire = JSON.stringify(payload);
    expect(wire).not.toContain(secret);
    expect(wire).not.toContain(secret.replace(/-/g, ""));
    expect(wire).not.toContain(rawBase64);
    expect(Object.keys(payload).sort()).toEqual(["kdfParams", "version", "wrappedUserKey"]);
    expect(payload.wrappedUserKey.length).toBeLessThanOrEqual(65536);
    expect(JSON.stringify(payload.kdfParams).length).toBeLessThanOrEqual(4096);
  });

  it("rejects tampered ciphertext, wrong secrets, swapped fields and another tenant", async () => {
    const { secret, payload } = await createPersonalRecovery(
      new Uint8Array(64).fill(7),
      context,
      new Uint8Array(512).fill(8),
    );
    const bytes = atob(payload.wrappedUserKey);
    const tampered = btoa(
      bytes.slice(0, -1) + String.fromCharCode(bytes.charCodeAt(bytes.length - 1) ^ 1),
    );
    await expect(
      openPersonalRecovery({ ...payload, wrappedUserKey: tampered }, secret, context),
    ).rejects.toThrow();
    await expect(openPersonalRecovery(payload, "0".repeat(64), context)).rejects.toThrow();
    await expect(
      openPersonalRecovery(
        { ...payload, wrappedPrivateKey: payload.wrappedUserKey },
        secret,
        context,
      ),
    ).rejects.toThrow();
    await expect(
      openPersonalRecovery(payload, secret, { ...context, tenantId: "other" }),
    ).rejects.toThrow();
    await expect(
      openPersonalRecovery(payload, secret, { ...context, userId: "other" }),
    ).rejects.toThrow();
  });

  it("uses fresh random secrets, salts and IVs, and rejects unknown parameters", async () => {
    const first = await createPersonalRecovery(new Uint8Array(64).fill(7), context);
    const second = await createPersonalRecovery(new Uint8Array(64).fill(7), context);
    expect(first.secret).not.toEqual(second.secret);
    expect(first.payload.kdfParams.salt).not.toEqual(second.payload.kdfParams.salt);
    expect(first.payload.wrappedUserKey).not.toEqual(second.payload.wrappedUserKey);
    await expect(
      openPersonalRecovery({ ...first.payload, version: 2 }, first.secret, context),
    ).rejects.toThrow();
    await expect(
      openPersonalRecovery(
        { ...first.payload, kdfParams: { ...first.payload.kdfParams, name: "PBKDF2" } },
        first.secret,
        context,
      ),
    ).rejects.toThrow();
    await expect(
      openPersonalRecovery(
        { ...first.payload, wrappedUserKey: "!".repeat(65537) },
        first.secret,
        context,
      ),
    ).rejects.toThrow();
  });

  it("wipes all input keys when wrapping fails", async () => {
    const user = new Uint8Array(64).fill(1);
    const privateKey = new Uint8Array(65536).fill(2);
    await expect(createPersonalRecovery(user, context, privateKey)).rejects.toThrow();
    expect(user.every((byte) => byte === 0)).toBe(true);
    expect(privateKey.every((byte) => byte === 0)).toBe(true);
  });
});
