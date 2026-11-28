import { CipherWithIdExport, FolderWithIdExport } from "@bitwarden/common/models/export";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  EncString as SdkEncString,
  Folder as SdkFolder,
  Kdf,
  PasswordManagerClient,
  PureCrypto,
  UserId as SdkUserId,
} from "@bitwarden/sdk-internal";

/** `GET /api/tenancy/export` (KyVault-backend `src/api/core/tenancy.rs`). All ciphertext. */
export type RestrictedExport = {
  object: "kyvaultRestrictedExport";
  userId: string;
  email: string;
  kdf: { kdfType: number; iterations: number; memory: number | null; parallelism: number | null };
  key: string;
  privateKey: string;
  folders: { id: string; name: string; revisionDate: string }[];
  ciphers: unknown[];
};

export function parseRestrictedExport(value: unknown): RestrictedExport {
  const data = value as RestrictedExport | null;
  if (
    data?.object !== "kyvaultRestrictedExport" ||
    typeof data.userId !== "string" ||
    typeof data.email !== "string" ||
    typeof data.key !== "string" ||
    typeof data.privateKey !== "string" ||
    typeof data.kdf?.kdfType !== "number" ||
    typeof data.kdf.iterations !== "number" ||
    !Array.isArray(data.folders) ||
    !Array.isArray(data.ciphers)
  ) {
    throw new Error("Invalid export");
  }
  return data;
}

function sdkKdf({ kdfType, iterations, memory, parallelism }: RestrictedExport["kdf"]): Kdf {
  if (kdfType === 0) {
    return { pBKDF2: { iterations } };
  }
  if (kdfType === 1 && memory != null && parallelism != null) {
    return { argon2id: { iterations, memory, parallelism } };
  }
  throw new Error("Unsupported KDF");
}

/** Unwraps the user key with the master password, in the browser. Throws on a wrong password. */
export function unlockRestrictedExport(data: RestrictedExport, masterPassword: string): Uint8Array {
  // Salt as MasterPasswordService.emailToSalt.
  const salt = data.email.toLowerCase().trim();
  return PureCrypto.decrypt_user_key_with_master_password(
    data.key,
    masterPassword,
    salt,
    sdkKdf(data.kdf),
  );
}

/**
 * Builds the stock unencrypted individual JSON export (as IndividualVaultExportService) from the
 * restricted export, with a throwaway SDK client that holds only this user key and has no token.
 * Nothing is stored or sent. Items that fail to decrypt are left out and counted.
 */
export async function decryptRestrictedExport(
  data: RestrictedExport,
  userKey: Uint8Array,
  client: PasswordManagerClient,
): Promise<{ json: string; failed: number }> {
  await client.crypto().initialize_user_crypto({
    userId: data.userId as unknown as SdkUserId,
    email: data.email,
    kdfParams: sdkKdf(data.kdf),
    accountCryptographicState: { V1: { private_key: data.privateKey as SdkEncString } },
    method: { decryptedKey: { decrypted_user_key: Utils.fromBufferToB64(userKey) } },
  });

  const ciphers = data.ciphers
    .map((raw) => new Cipher(new CipherData(new CipherResponse(raw))))
    .filter((c) => c.organizationId == null && c.deletedDate == null);
  const result = await client
    .vault()
    .ciphers()
    .decrypt_list_full_with_failures(ciphers.map((c) => c.toSdkCipher()));

  const doc = { encrypted: false, folders: [] as FolderWithIdExport[], items: [] as unknown[] };
  for (const raw of data.folders) {
    const view = new FolderView();
    view.id = raw.id;
    view.name =
      client
        .vault()
        .folders()
        .decrypt(raw as unknown as SdkFolder).name ?? "";
    const folder = new FolderWithIdExport();
    folder.build(view);
    doc.folders.push(folder);
  }
  for (const sdkView of result.successes) {
    const view = CipherView.fromSdkCipherView(sdkView);
    if (view == null) {
      continue;
    }
    const cipher = new CipherWithIdExport();
    cipher.build(view);
    cipher.collectionIds = null;
    delete cipher.key;
    doc.items.push(cipher);
  }
  return {
    json: JSON.stringify(doc, null, "  "),
    failed: ciphers.length - doc.items.length,
  };
}
