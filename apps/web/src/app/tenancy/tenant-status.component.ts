import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { LinkModule, TypographyModule } from "@bitwarden/components";

import { TenancyService } from "./tenancy.service";

@Component({
  selector: "ky-tenant-status",
  imports: [LinkModule, TypographyModule, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let state = tenancy.state();
    @if (state.kind === "ready" && state.status.multiTenant) {
      @let tenant = state.status;
      <section
        class="tw-py-6 tw-border-0 tw-border-b tw-border-solid tw-border-secondary-300"
        aria-labelledby="tenant-status-title"
      >
        <h2 bitTypography="h2" id="tenant-status-title">Tenant &amp; Storage</h2>
        <dl class="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-x-8 tw-gap-y-2 tw-mb-4">
          <dt>Tenant</dt>
          <dd class="tw-m-0 tw-break-all">{{ tenant.tenantId }}</dd>
          <dt>Home region</dt>
          <dd class="tw-m-0">{{ tenant.homeRegion }}</dd>
          <dt>Status</dt>
          <dd class="tw-m-0">
            {{ tenant.status }}{{ tenant.appEnabled ? "" : " (app disabled)" }}
          </dd>
          <dt>Vault items</dt>
          <dd class="tw-m-0">
            {{ tenant.cipherCount | number }} / {{ tenant.maxCiphersPerTenant | number }}
          </dd>
          <dt>Vault storage used / ceiling</dt>
          <dd class="tw-m-0">
            {{ bytes(tenant.storageUsedBytes) }} / {{ bytes(tenant.storageCeilingBytes) }}
          </dd>
          <dt>Organisation used / pool</dt>
          <dd class="tw-m-0">
            {{ bytes(tenant.storageOrgUsedBytes) }} / {{ bytes(tenant.storagePoolBytes) }}
          </dd>
        </dl>
        @if (tenant.storageOverSince !== null) {
          <p role="status" class="tw-text-danger">
            Your organisation has exceeded its storage pool since {{ tenant.storageOverSince }}. New
            storage may be refused. Contact your administrator.
          </p>
        }
        @if (!tenant.recovery.hasPersonalRecoveryKit) {
          <p role="status">
            <a bitLink routerLink="/settings/security/personal-recovery"
              >Set up your Personal Recovery Kit</a
            >
            to protect access to your vault key.
          </p>
        }
      </section>
    } @else if (state.kind === "unavailable") {
      <p role="status">
        Tenant status could not be loaded.
        <button bitLink type="button" (click)="tenancy.refresh()">Retry</button>
      </p>
    }
  `,
})
export class TenantStatusComponent {
  protected readonly tenancy = inject(TenancyService);

  protected bytes(value: number | null): string {
    if (value === null) {
      return "Not available";
    }
    if (value === 0) {
      return "0 B";
    }
    const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / 1024 ** index).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[index]}`;
  }
}
