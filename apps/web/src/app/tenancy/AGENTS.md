# Purpose

Tenant status, feature visibility and user-owned Personal Recovery Kits for the web vault.

# Ownership

- This folder owns tenancy services, route guards, cryptographic envelopes and settings components.
- Navigation and route integration remain in the existing layouts and routing modules.

# Local Contracts

- Use authenticated `ApiService.send` with an explicit account ID. Status cache follows the active account and clears on logout; a status 404 preserves legacy single-tenant features. Other failures close gated entry points and expose retry in Settings.
- The wire contract is `KyVault-backend/src/api/core/tenancy.rs`; `MULTI_TENANCY.md` describes isolation and storage grants.
- Version 1 envelopes use a fresh 256-bit random secret, HKDF-SHA256 with a 32-byte random salt, and AES-256-GCM. Wrapped blobs are standard base64 of 12-byte IV followed by ciphertext and 128-bit tag. KDF info is `KyVault personal recovery v1`. AAD is JSON `[info, tenantId, userId, field]`, with field `userKey` or `privateKey`.
- Keep recovery secrets and unwrapped keys in the browser. Wrap owned key copies and wipe raw buffers on success and failure; do not wipe live KeyService buffers. WebCrypto keys are non-extractable. JavaScript strings cannot be reliably zeroized: clear references on cancel, lock, account change and destruction; persist secrets only through an explicit copy or file download.
- Prepare first, then activate only after offline-storage acknowledgement. Rotation replaces the active server bundle; revocation cannot erase downloaded copies. Verify against the current user key so stale kits are detected after encryption-key rotation.
- A kit is not a vault backup, server escrow or organisation-admin escrow. This UI manages and tests kits; it does not add an unauthenticated login or restore protocol.

# Work Guidance

- Reuse Bitwarden form controls, buttons and typography with existing Ky theme tokens.

# Verification

- Jest specs in this folder exercise real WebCrypto, API payload secrecy, status fallback, recovery flows and guards. Layout specs cover visible gating.
- Repository CI commands are in `.github/workflows/ci.yml`.

# Child DOX Index
