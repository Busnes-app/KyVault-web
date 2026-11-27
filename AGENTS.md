# Purpose

KyVault web vault: the Angular client for KyVault-backend, retaining upstream single-tenant compatibility.

# Ownership

- `apps/web` owns the web application; shared Bitwarden libraries remain under `libs`.
- Existing subtree `CLAUDE.md` files carry platform constraints.

# Local Contracts

- Match the merged KyVault-backend API; UI feature visibility supplements server authorization.
- Preserve supported single-tenant workflows and existing Ky themes.

# Work Guidance

# Verification

- Run the checks defined in `.github/workflows/ci.yml` before hand-back.

# Child DOX Index

- `apps/web/src/app/tenancy/AGENTS.md`: authenticated tenant status, feature gating and client-only Personal Recovery Kits.
