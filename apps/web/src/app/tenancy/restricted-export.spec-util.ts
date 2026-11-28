import { ManagedSettingsClient, PasswordManagerClient, PureCrypto } from "@bitwarden/sdk-internal";

import { RestrictedExport } from "./restricted-export";

export const email = "Member@Example.test";
export const password = "correct horse battery staple";
export const folderId = "22222222-2222-4222-8222-222222222222";

/** A restricted export as KyVault-backend serialises it, encrypted with the real SDK. */
export function restrictedExportFixture(): RestrictedExport {
  const kdf = { pBKDF2: { iterations: 600000 } };
  const userKey = PureCrypto.make_user_key_aes256_cbc_hmac();
  const itemKey = PureCrypto.make_user_key_aes256_cbc_hmac();
  const enc = (value: string, key = userKey) => PureCrypto.symmetric_encrypt_string(value, key);
  const cipher = (id: string, extra: object): Record<string, unknown> => ({
    object: "cipherDetails",
    id,
    type: 1,
    creationDate: "2026-11-01T00:00:00.000000Z",
    revisionDate: "2026-11-02T00:00:00.000000Z",
    deletedDate: null,
    archivedDate: null,
    reprompt: 0,
    organizationId: null,
    folderId: null,
    key: null,
    attachments: null,
    organizationUseTotp: false,
    collectionIds: [],
    fields: null,
    passwordHistory: null,
    favorite: false,
    edit: true,
    viewPassword: true,
    permissions: { delete: true, restore: true },
    ...extra,
  });
  return {
    object: "kyvaultRestrictedExport",
    userId: "c7312a46-17c4-4a8c-965b-123456789abc",
    email,
    kdf: { kdfType: 0, iterations: 600000, memory: null, parallelism: null },
    key: PureCrypto.encrypt_user_key_with_master_password(
      userKey,
      password,
      email.toLowerCase(),
      kdf,
    ),
    privateKey: PureCrypto.wrap_decapsulation_key(PureCrypto.rsa_generate_keypair(), userKey),
    folders: [
      { id: folderId, name: enc("Work"), revisionDate: "2026-11-01T00:00:00.000000Z" },
    ] as RestrictedExport["folders"],
    ciphers: [
      cipher("11111111-1111-4111-8111-111111111111", {
        name: enc("Bank"),
        notes: enc("personal note"),
        folderId,
        login: { username: enc("alice"), password: enc("s3cret"), uris: null, totp: null },
      }),
      // A per-item key, as current clients write.
      cipher("33333333-3333-4333-8333-333333333333", {
        key: PureCrypto.wrap_symmetric_key(itemKey, userKey),
        name: enc("Mail", itemKey),
        login: { username: enc("bob", itemKey), password: enc("hunter2", itemKey) },
      }),
      // The server sends none, but an organisation item must never be exported here.
      cipher("44444444-4444-4444-8444-444444444444", {
        organizationId: "55555555-5555-4555-8555-555555555555",
        name: enc("Org item"),
        login: {},
      }),
      // An item key under another key: the item fails, is counted and is not exported.
      cipher("66666666-6666-4666-8666-666666666666", {
        key: PureCrypto.wrap_symmetric_key(itemKey, PureCrypto.make_user_key_aes256_cbc_hmac()),
        name: enc("Broken", itemKey),
        login: {},
      }),
      // A field under another key: the SDK blanks the field, as in the stock export.
      cipher("77777777-7777-4777-8777-777777777777", {
        name: enc("Blank", PureCrypto.make_user_key_aes256_cbc_hmac()),
        login: { username: enc("carol") },
      }),
    ],
  };
}

export const newSdkClient = () =>
  new PasswordManagerClient(
    { get_access_token: () => Promise.resolve(undefined) },
    null,
    new ManagedSettingsClient(),
  );
