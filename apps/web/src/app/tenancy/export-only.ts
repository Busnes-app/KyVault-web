import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { EMPTY, defer, firstValueFrom, switchMap } from "rxjs";

import { decodeJwtTokenToJson } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { FetchMiddleware } from "@bitwarden/common/platform/misc/fetch-middleware";
// eslint-disable-next-line no-restricted-imports -- extended for export-only sessions
import { SignalRConnectionService } from "@bitwarden/common/platform/server-notifications/internal";
import { UserId } from "@bitwarden/common/types/guid";

/** The one route an export-only session may call (KyVault-backend `src/api/core/tenancy.rs`). */
export const EXPORT_PATH = "/tenancy/export";
export const EXPORT_ROUTE = "restricted-export";

/** A KyIdentity `export_only` session: its org is scheduled for deletion (KyVault-backend #11). */
export function isExportOnlyToken(token: string | null | undefined): boolean {
  if (!token) {
    return false;
  }
  try {
    return decodeJwtTokenToJson(token)?.export_only === true;
  } catch {
    return false;
  }
}

export async function isExportOnlySession(tokens: TokenService, userId: UserId): Promise<boolean> {
  return isExportOnlyToken(await tokens.getAccessToken(userId));
}

/**
 * The server answers an export-only token with 403 everywhere but the export route, and the
 * client logs out on an authenticated 403. Refuse those requests here, before they leave the
 * browser, with an error the client does not treat as a logout.
 */
export function exportOnlyFetchGate(): FetchMiddleware {
  return (request, next) => {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
    const exportRoute =
      request.method === "GET" && new URL(request.url).pathname.endsWith(EXPORT_PATH);
    if (!isExportOnlyToken(token) || exportRoute) {
      return next(request);
    }
    return Promise.reject(
      new ErrorResponse({ message: "This session can only download an export." }, 423),
    );
  };
}

/** No notifications hub for an export-only session: the server refuses it anyway. */
export class ExportOnlySignalRConnectionService extends SignalRConnectionService {
  constructor(
    private readonly tokens: TokenService,
    apiService: ApiService,
    logService: LogService,
    platformUtilsService: PlatformUtilsService,
  ) {
    super(apiService, logService, platformUtilsService);
  }

  override connect$(userId: UserId, notificationsUrl: string) {
    return defer(() => isExportOnlySession(this.tokens, userId)).pipe(
      switchMap((exportOnly) => (exportOnly ? EMPTY : super.connect$(userId, notificationsUrl))),
    );
  }
}

async function activeExportOnly(): Promise<boolean> {
  const accounts = inject(AccountService);
  const tokens = inject(TokenService);
  const account = await firstValueFrom(accounts.activeAccount$);
  return account != null && (await isExportOnlySession(tokens, account.id));
}

/** On the lock route: an export-only session never unlocks the vault, it goes to the export. */
export const exportOnlyRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await activeExportOnly()) ? router.createUrlTree(["/" + EXPORT_ROUTE]) : true;
};

/** The export screen is only for export-only sessions. */
export const exportOnlySessionGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await activeExportOnly()) || router.createUrlTree(["/"]);
};
