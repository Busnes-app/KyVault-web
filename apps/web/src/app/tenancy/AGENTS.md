# Purpose

Tenant status, feature visibility, user-owned Personal Recovery Kits and the export-only screen for the web vault.

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
- An `export_only` access token (org `deletion_scheduled`, KyVault-backend #11) reaches only `GET /api/tenancy/export`; the server 403s everything else and the client logs out on an authenticated 403. `exportOnlyFetchGate` refuses every other authenticated request in the browser, `ExportOnlySignalRConnectionService` opens no hub, and the lock route sends the session to `/restricted-export`. The vault never unlocks: no sync, no notifications, no tenancy status.
- The export screen unwraps the user key with the master password locally (SDK `PureCrypto`), offers the server's ciphertext unchanged first, and builds the stock unencrypted JSON export only after the stock plaintext warning, with a throwaway SDK client that has no token and no state. It sends nothing back. It wipes the key buffer on sign-out, on destruction and when the configured vault timeout (15 minutes when not a number) runs out, counted from unlock, because the global vault timeout never sees this locked account.

# Work Guidance

- Reuse Bitwarden form controls, buttons and typography with existing Ky theme tokens.

# Verification

- Jest specs in this folder exercise real WebCrypto, API payload secrecy, status fallback, recovery flows and guards. Layout specs cover visible gating.
- Export-only specs drive the real `ApiService`, `CoreModule` providers and routes, and decrypt with the real SDK WASM, including a response captured from KyVault-backend's live journey test.
- Repository CI commands are in `.github/workflows/ci.yml`.

# Child DOX Index
