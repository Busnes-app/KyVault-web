import { Injectable, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  Subject,
  defer,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

export type TenancyStatus = {
  multiTenant: boolean;
  tenantId: string;
  homeRegion: string;
  cells: string[];
  status: string;
  appEnabled: boolean;
  storagePoolBytes: number | null;
  storageCeilingBytes: number | null;
  storageReservedBytes: number | null;
  storageGrantExpiresAt: string | null;
  storageOrgUsedBytes: number | null;
  storageUsedBytes: number;
  storageOverSince: string | null;
  cipherCount: number;
  maxCiphersPerTenant: number;
  maxImportCiphers: number;
  maxImportFolders: number;
  allowSends: boolean;
  allowEmergencyAccess: boolean;
  recovery: { hasPersonalRecoveryKit: boolean };
};

export type TenancyState =
  | { kind: "loading" | "unavailable" | "unsupported"; userId: UserId | null }
  | { kind: "ready"; userId: UserId; status: TenancyStatus };

export function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 404
  );
}

/** Validate the wire response once; consumers can trust the typed status. */
export function parseTenancyStatus(value: unknown): TenancyStatus {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid tenancy status");
  }
  const booleans = ["multiTenant", "appEnabled", "allowSends", "allowEmergencyAccess"];
  const strings = ["tenantId", "homeRegion", "status"];
  const numbers = [
    "storageUsedBytes",
    "cipherCount",
    "maxCiphersPerTenant",
    "maxImportCiphers",
    "maxImportFolders",
  ];
  const nullableNumbers = [
    "storagePoolBytes",
    "storageCeilingBytes",
    "storageReservedBytes",
    "storageOrgUsedBytes",
  ];
  const nullableStrings = ["storageGrantExpiresAt", "storageOverSince"];
  const data = value as Record<string, unknown>;
  const recovery = data.recovery;
  if (
    booleans.some((key) => typeof data[key] !== "boolean") ||
    strings.some((key) => typeof data[key] !== "string") ||
    numbers.some(
      (key) =>
        typeof data[key] !== "number" || !Number.isSafeInteger(data[key]) || Number(data[key]) < 0,
    ) ||
    nullableNumbers.some(
      (key) =>
        data[key] !== null &&
        (typeof data[key] !== "number" ||
          !Number.isSafeInteger(data[key]) ||
          Number(data[key]) < 0),
    ) ||
    nullableStrings.some((key) => data[key] !== null && typeof data[key] !== "string") ||
    !Array.isArray(data.cells) ||
    data.cells.some((cell: unknown) => typeof cell !== "string") ||
    typeof recovery !== "object" ||
    recovery === null ||
    !("hasPersonalRecoveryKit" in recovery) ||
    typeof recovery.hasPersonalRecoveryKit !== "boolean"
  ) {
    throw new Error("Invalid tenancy status");
  }
  // All contract fields are checked above at the API boundary.
  return value as TenancyStatus;
}

export function tenancyAllows(
  state: TenancyState,
  feature: "allowSends" | "allowEmergencyAccess",
): boolean {
  return (
    state.kind === "unsupported" ||
    (state.kind === "ready" && (!state.status.multiTenant || state.status[feature]))
  );
}

@Injectable({ providedIn: "root" })
export class TenancyService {
  private readonly api = inject(ApiService);
  private readonly accountService = inject(AccountService);
  private readonly refreshRequested = new Subject<void>();

  readonly state$ = this.accountService.activeAccount$.pipe(
    map((account) => account?.id ?? null),
    distinctUntilChanged(),
    switchMap((userId) =>
      userId === null
        ? of<TenancyState>({ kind: "loading", userId })
        : this.refreshRequested.pipe(
            startWith(undefined),
            switchMap(() =>
              defer(() => this.load(userId)).pipe(
                startWith<TenancyState>({ kind: "loading", userId }),
              ),
            ),
          ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  readonly state = toSignal(this.state$, {
    initialValue: { kind: "loading", userId: null } satisfies TenancyState,
  });

  refresh(): void {
    this.refreshRequested.next();
  }

  private async load(userId: UserId): Promise<TenancyState> {
    try {
      const response: unknown = await this.api.send("GET", "/tenancy/status", null, userId, true);
      return { kind: "ready", userId, status: parseTenancyStatus(response) };
    } catch (error) {
      // Older Vaultwarden servers have no tenancy endpoint. Do not log an expected 404.
      return { kind: isNotFound(error) ? "unsupported" : "unavailable", userId };
    }
  }
}
