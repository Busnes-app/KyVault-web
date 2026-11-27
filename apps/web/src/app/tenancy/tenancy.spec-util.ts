import { UserId } from "@bitwarden/common/types/guid";

import { TenancyStatus } from "./tenancy.service";

export const recoveryUserId = "c7312a46-17c4-4a8c-965b-123456789abc" as UserId;
export const tenancyStatus: TenancyStatus = {
  multiTenant: true,
  tenantId: "org-123",
  homeRegion: "eu-west-1",
  cells: ["eu-west-1"],
  status: "active",
  appEnabled: true,
  storagePoolBytes: 1073741824,
  storageCeilingBytes: 268435456,
  storageReservedBytes: 0,
  storageGrantExpiresAt: "2026-11-26T00:15:00Z",
  storageOrgUsedBytes: 1024,
  storageUsedBytes: 1024,
  storageOverSince: null,
  cipherCount: 12,
  maxCiphersPerTenant: 50000,
  maxImportCiphers: 5000,
  maxImportFolders: 500,
  allowSends: false,
  allowEmergencyAccess: false,
  recovery: { hasPersonalRecoveryKit: false },
};
