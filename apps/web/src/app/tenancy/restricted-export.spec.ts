import {
  decryptRestrictedExport,
  parseRestrictedExport,
  unlockRestrictedExport,
} from "./restricted-export";
import {
  folderId,
  newSdkClient,
  password,
  restrictedExportFixture,
} from "./restricted-export.spec-util";

describe("restricted export crypto", () => {
  const data = restrictedExportFixture();

  it("validates the export shape", () => {
    expect(parseRestrictedExport(JSON.parse(JSON.stringify(data)))).toEqual(data);
    expect(() => parseRestrictedExport({ ...data, object: "sync" })).toThrow();
    expect(() => parseRestrictedExport({ ...data, privateKey: null })).toThrow();
    expect(() => parseRestrictedExport(null)).toThrow();
  });

  it("unlocks only with the master password", () => {
    expect(() => unlockRestrictedExport(data, "wrong password")).toThrow();
    expect(unlockRestrictedExport(data, password)).toHaveLength(64);
  });

  it("builds the stock unencrypted JSON export of personal items only", async () => {
    const userKey = unlockRestrictedExport(data, password);
    const client = newSdkClient();
    let result: { json: string; failed: number };
    try {
      result = await decryptRestrictedExport(data, userKey, client);
    } finally {
      client.free();
    }

    expect(result.failed).toBe(1);
    const doc = JSON.parse(result.json);
    expect(doc.encrypted).toBe(false);
    expect(doc.folders).toEqual([{ id: folderId, name: "Work" }]);
    expect(
      doc.items.map((i: any) => [i.name, i.notes, i.login.username, i.login.password, i.folderId]),
    ).toEqual([
      ["Bank", "personal note", "alice", "s3cret", folderId],
      ["Mail", undefined, "bob", "hunter2", undefined],
      ["", undefined, "carol", undefined, undefined],
    ]);
    expect(doc.items.every((i: any) => i.organizationId == null && !("key" in i))).toBe(true);
    expect(result.json).not.toMatch(/Org item|Broken/);
  });
});

describe("a real KyVault-backend export", () => {
  // `GET /api/tenancy/export` captured from KyVault-backend db07959f's TestLiveHostedJourney
  // (throwaway e2e user and keys; its Go client wrote the item with its own crypto).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const data = parseRestrictedExport(require("./restricted-export.backend-fixture.json"));

  it("unlocks with the member's master password and decrypts their item", async () => {
    expect(() => unlockRestrictedExport(data, "wrong")).toThrow();
    const client = newSdkClient();
    try {
      const { json, failed } = await decryptRestrictedExport(
        data,
        unlockRestrictedExport(data, "alice master password"),
        client,
      );
      expect(failed).toBe(0);
      expect(JSON.parse(json).items.map((i: { name: string }) => i.name)).toEqual([
        "alice@e2e.test secret",
      ]);
    } finally {
      client.free();
    }
  });
});
