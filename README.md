# KyVault-web

**Busnes-app's GPL-3.0 fork of the [Bitwarden web vault](https://github.com/bitwarden/clients)** (`apps/web` and shared `libs/`) — the self-hosted web client paired with [KyVault-backend](https://github.com/Busnes-app/KyVault-backend) in the [Busnes.app](https://busnes.app) Ky suite.

> [!IMPORTANT]
> **Report bugs and issues for this fork in [Busnes-app/KyVault-web](https://github.com/Busnes-app/KyVault-web/issues).** Do not report KyVault-web issues to official Bitwarden support channels. For private vulnerability reporting, see the repository's GitHub **Security** tab (and upstream policy context in [SECURITY.md](SECURITY.md)).

## Development and build

Requires the Node.js major version specified in [`.nvmrc`](.nvmrc) (`v24`).

```sh
npm ci
```

Common commands (matching [`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

```sh
# Production self-hosted OSS web vault build
npm run build:oss:selfhost:prod --workspace apps/web

# Development watch server (self-hosted OSS)
npm run build:oss:selfhost:watch --workspace apps/web

# Lint and typecheck
npm run lint
npm run test:types

# Run unit tests
npm test -- apps/web --ci
npm test -- libs --ci
```

For large builds or test runs, set `NODE_OPTIONS=--max-old-space-size=6144`.

## Documentation

- [docs/cipher-types.md](docs/cipher-types.md) — cipher type architecture reference across models, UI, and tests
- [docs/using-nx-to-build-projects.md](docs/using-nx-to-build-projects.md) — Nx workspace build reference
- [CONTRIBUTING.md](CONTRIBUTING.md) and the [Busnes.app shared contribution policy](https://github.com/Busnes-app/.github/blob/main/CONTRIBUTING.md)

## Related Busnes.app repositories

- [Busnes-app/KyVault-backend](https://github.com/Busnes-app/KyVault-backend) — AGPL-3.0 Vaultwarden fork providing the Bitwarden-compatible API server for KyVault

## Upstream attribution and license

`KyVault-web` is forked from [bitwarden/clients](https://github.com/bitwarden/clients) and carries the open-source self-hosted web vault (`apps/web` and shared `libs/`). Source code in this repository is licensed under the GNU General Public License v3.0 — see [LICENSE.txt](LICENSE.txt) and [LICENSE_GPL.txt](LICENSE_GPL.txt).

**Not affiliated with or endorsed by Bitwarden, Inc.** Bitwarden trademarks remain the property of Bitwarden, Inc.
