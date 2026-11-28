import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { UserId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  DialogService,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import { ManagedSettingsService } from "@bitwarden/managed-settings";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";
import { ExportHelper } from "@bitwarden/vault-export-core";

import { EXPORT_PATH } from "./export-only";
import {
  RestrictedExport,
  decryptRestrictedExport,
  parseRestrictedExport,
  unlockRestrictedExport,
} from "./restricted-export";

/** The whole web vault for an export-only session (org scheduled for deletion). */
@Component({
  selector: "ky-restricted-export",
  imports: [ReactiveFormsModule, ButtonModule, FormFieldModule, TypographyModule],
  templateUrl: "restricted-export.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestrictedExportComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly accounts = inject(AccountService);
  private readonly downloads = inject(FileDownloadService);
  private readonly dialogs = inject(DialogService);
  private readonly logout = inject(LogoutService);
  private readonly router = inject(Router);
  private readonly sdkClients = inject(SdkClientFactory);
  private readonly managedSettings = inject(ManagedSettingsService);
  private readonly timeouts = inject(VaultTimeoutSettingsService);
  private readonly zone = inject(NgZone);
  private readonly expiry = { timer: undefined as ReturnType<typeof setTimeout> | undefined };

  protected readonly account = toSignal(this.accounts.activeAccount$);
  protected readonly form = new FormGroup({
    password: new FormControl("", { nonNullable: true }),
  });
  protected readonly password = this.form.controls.password;
  /** The export and its unwrapped user key, held in memory only until sign-out or leaving. */
  private readonly opened = signal<{ data: RestrictedExport; userKey: Uint8Array } | null>(null);
  protected readonly unlocked = computed(() => this.opened() !== null);
  protected readonly busy = signal(false);
  protected readonly error = signal("");
  protected readonly message = signal("");

  ngOnDestroy(): void {
    this.clear();
  }

  protected async unlock(): Promise<void> {
    const account = this.account();
    if (this.busy() || !account) {
      return;
    }
    const password = this.password.value;
    this.password.reset();
    this.busy.set(true);
    this.error.set("");
    try {
      let data: RestrictedExport;
      try {
        data = parseRestrictedExport(
          await this.api.send("GET", EXPORT_PATH, null, account.id, true),
        );
      } catch {
        this.error.set(
          "Your export could not be loaded. Your session may have ended: sign in again.",
        );
        return;
      }
      try {
        const lockAfter = await this.lockAfterMs(account.id);
        this.opened.set({ data, userKey: unlockRestrictedExport(data, password) });
        // The vault timeout does not see this screen (the account stays locked): apply it here.
        // Outside the zone, so a long timer does not hold the app unstable.
        this.expiry.timer = this.zone.runOutsideAngular(() =>
          setTimeout(
            () =>
              this.zone.run(() => {
                this.clear();
                this.message.set("");
                this.error.set("Your export locked again. Enter your master password to continue.");
              }),
            lockAfter,
          ),
        );
      } catch {
        this.error.set("That master password did not unlock your export.");
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected downloadEncrypted(): void {
    const opened = this.opened();
    if (opened) {
      // The server's response, unchanged: only your master password can open it.
      this.save(JSON.stringify(opened.data), `kyvault_restricted_export_${this.today()}.json`);
      this.message.set("Encrypted export downloaded.");
    }
  }

  protected async downloadDecrypted(): Promise<void> {
    const opened = this.opened();
    if (this.busy() || !opened) {
      return;
    }
    const confirmed = await this.dialogs.openSimpleDialog({
      title: { key: "confirmVaultExport" },
      content: { key: "exportUnencryptedWarningDesc" },
      acceptButtonText: { key: "continue" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    this.error.set("");
    this.message.set("");
    let client: PasswordManagerClient | undefined;
    try {
      client = await this.sdkClients.createSdkClient(
        { get_access_token: () => Promise.resolve(undefined) },
        null,
        await firstValueFrom(this.managedSettings.client$),
      );
      const { json, failed } = await decryptRestrictedExport(opened.data, opened.userKey, client);
      if (this.opened() !== opened) {
        return; // Locked or signed out meanwhile.
      }
      this.save(json, ExportHelper.getFileName("", "json"));
      this.message.set(
        failed === 0
          ? "Unencrypted export downloaded."
          : `Unencrypted export downloaded. ${failed} item(s) could not be decrypted and are not in the file; the encrypted export still holds them.`,
      );
    } catch {
      this.error.set("Your export could not be decrypted. Download the encrypted export instead.");
    } finally {
      client?.free();
      this.busy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    const account = this.account();
    this.clear();
    if (account) {
      await this.logout.logout(account.id, "userInitiated");
    }
    await this.router.navigate(["/"]);
  }

  /** The configured vault timeout; web's default 15 minutes when it is not a number. */
  private async lockAfterMs(userId: UserId): Promise<number> {
    try {
      const timeout = await firstValueFrom(this.timeouts.getVaultTimeoutByUserId$(userId));
      return Math.max(1, typeof timeout === "number" ? timeout : 15) * 60_000;
    } catch {
      return 15 * 60_000;
    }
  }

  private clear(): void {
    clearTimeout(this.expiry.timer);
    this.opened()?.userKey.fill(0);
    this.opened.set(null);
    this.password.reset();
  }

  private save(contents: string, fileName: string): void {
    this.downloads.download({
      fileName,
      blobData: new Blob([contents], { type: "application/json;charset=utf-8" }),
      downloadMethod: "save",
    });
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
