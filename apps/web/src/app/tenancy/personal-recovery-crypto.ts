/** Versioned client-only envelope. No recovery secret or unwrapped key belongs in this payload. */
export type PersonalRecoveryPayload = {
  version: 1;
  kdfParams: {
    name: "HKDF";
    hash: "SHA-256";
    salt: string;
    info: "KyVault personal recovery v1";
    cipher: "AES-256-GCM";
  };
  wrappedUserKey: string;
  wrappedPrivateKey?: string;
};

export type RecoveryContext = { userId: string; tenantId: string };

const INFO = "KyVault personal recovery v1";
const encoder = new TextEncoder();

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function decode(value: string, maxLength: number): Uint8Array<ArrayBuffer> {
  if (
    value.length > maxLength ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error("Invalid recovery envelope");
  }
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveKey(
  secret: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: encoder.encode(INFO) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function aad(context: RecoveryContext, field: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify([INFO, context.tenantId, context.userId, field]));
}

async function wrap(
  key: CryptoKey,
  bytes: Uint8Array<ArrayBuffer>,
  context: RecoveryContext,
  field: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad(context, field), tagLength: 128 },
      key,
      bytes,
    ),
  );
  const envelope = new Uint8Array(iv.length + encrypted.length);
  envelope.set(iv);
  envelope.set(encrypted, iv.length);
  const result = encode(envelope);
  if (result.length > 65_536) {
    throw new Error("Recovery envelope exceeds server limit");
  }
  return result;
}

async function unwrap(
  key: CryptoKey,
  value: string,
  context: RecoveryContext,
  field: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = decode(value, 65_536);
  if (bytes.length < 29) {
    throw new Error("Invalid recovery envelope");
  }
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes.slice(0, 12),
        additionalData: aad(context, field),
        tagLength: 128,
      },
      key,
      bytes.slice(12),
    ),
  );
}

/** Takes ownership of these temporary copies and wipes them, including on error. */
export async function createPersonalRecovery(
  userKey: Uint8Array<ArrayBuffer>,
  context: RecoveryContext,
  privateKey?: Uint8Array<ArrayBuffer>,
): Promise<{ secret: string; payload: PersonalRecoveryPayload }> {
  const secret = new Uint8Array(32);
  try {
    crypto.getRandomValues(secret);
    if (userKey.length === 0 || userKey.length > 32_768) {
      throw new Error("Invalid user key");
    }
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const key = await deriveKey(secret, salt);
    const payload: PersonalRecoveryPayload = {
      version: 1,
      kdfParams: {
        name: "HKDF",
        hash: "SHA-256",
        salt: encode(salt),
        info: INFO,
        cipher: "AES-256-GCM",
      },
      wrappedUserKey: await wrap(key, userKey, context, "userKey"),
      ...(privateKey
        ? { wrappedPrivateKey: await wrap(key, privateKey, context, "privateKey") }
        : {}),
    };
    return {
      secret: Array.from(secret, (byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .match(/.{8}/g)!
        .join("-"),
      payload,
    };
  } finally {
    secret.fill(0);
    userKey.fill(0);
    privateKey?.fill(0);
  }
}

/** Treat a stored bundle as untrusted input. Unknown versions/algorithms never fall back. */
export async function openPersonalRecovery(
  value: unknown,
  recoverySecret: string,
  context: RecoveryContext,
): Promise<{ userKey: Uint8Array<ArrayBuffer>; privateKey?: Uint8Array<ArrayBuffer> }> {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1 ||
    !("kdfParams" in value) ||
    !("wrappedUserKey" in value) ||
    typeof value.wrappedUserKey !== "string"
  ) {
    throw new Error("Unsupported recovery envelope");
  }
  const params = value.kdfParams;
  if (
    typeof params !== "object" ||
    params === null ||
    !("name" in params) ||
    params.name !== "HKDF" ||
    !("hash" in params) ||
    params.hash !== "SHA-256" ||
    !("info" in params) ||
    params.info !== INFO ||
    !("cipher" in params) ||
    params.cipher !== "AES-256-GCM" ||
    !("salt" in params) ||
    typeof params.salt !== "string" ||
    JSON.stringify(params).length > 4096
  ) {
    throw new Error("Unsupported recovery parameters");
  }
  const normalized = recoverySecret.replace(/[\s-]/g, "");
  if (!/^[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error("Enter the 64 hexadecimal characters from your recovery kit");
  }
  const secret = Uint8Array.from(normalized.match(/../g)!, (hex) => parseInt(hex, 16));
  let userKey: Uint8Array<ArrayBuffer> | undefined;
  try {
    const salt = decode(params.salt, 44);
    if (salt.length !== 32) {
      throw new Error("Invalid recovery salt");
    }
    const key = await deriveKey(secret, salt);
    userKey = await unwrap(key, value.wrappedUserKey, context, "userKey");
    if (
      "wrappedPrivateKey" in value &&
      value.wrappedPrivateKey !== null &&
      value.wrappedPrivateKey !== undefined
    ) {
      if (typeof value.wrappedPrivateKey !== "string") {
        throw new Error("Invalid wrapped private key");
      }
      return {
        userKey,
        privateKey: await unwrap(key, value.wrappedPrivateKey, context, "privateKey"),
      };
    }
    return { userKey };
  } catch (error) {
    userKey?.fill(0);
    throw error;
  } finally {
    secret.fill(0);
  }
}
