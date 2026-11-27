import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { distinctUntilChanged, map, of, switchMap } from "rxjs";

import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  CheckboxModule,
  DialogService,
  FormControlModule,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { PersonalRecoveryPayload, RecoveryContext } from "./personal-recovery-crypto";
import { PersonalRecoveryService } from "./personal-recovery.service";
import { TenancyService } from "./tenancy.service";

@Component({
  selector: "ky-personal-recovery",
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    CheckboxModule,
    FormControlModule,
    FormFieldModule,
    TypographyModule,
  ],
  templateUrl: "personal-recovery.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalRecoveryComponent implements OnDestroy {
  protected readonly tenancy = inject(TenancyService);
  private readonly recovery = inject(PersonalRecoveryService);
  private readonly platform = inject(PlatformUtilsService);
  private readonly downloads = inject(FileDownloadService);
  private readonly accounts = inject(AccountService);
  private readonly keys = inject(KeyService);
  private readonly dialogs = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly pending = signal<{ secret: string; payload: PersonalRecoveryPayload } | null>(
    null,
  );
  protected readonly busy = signal(false);
  protected readonly message = signal("");
  protected readonly error = signal("");
  protected readonly unlocked = signal(false);
  protected readonly savedOffline = new FormControl(false, { nonNullable: true });
  protected readonly confirmRevoke = new FormControl(false, { nonNullable: true });
  protected readonly testSecret = new FormControl("", { nonNullable: true });
  private readonly generation = signal(0);

  constructor() {
    this.accounts.activeAccount$
      .pipe(
        map((account) => account?.id ?? null),
        distinctUntilChanged(),
        switchMap((userId) => {
          this.clearSecrets();
          return userId ? this.keys.userKey$(userId) : of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((key) => {
        this.unlocked.set(key !== null);
        if (!key) {
          this.clearSecrets();
        }
      });
  }

  ngOnDestroy(): void {
    this.clearSecrets();
  }

  protected clearSecrets(): void {
    this.generation.update((value) => value + 1);
    this.pending.set(null);
    this.savedOffline.reset();
    this.confirmRevoke.reset();
    this.testSecret.reset();
    this.message.set("");
    this.error.set("");
  }

  private context(): RecoveryContext & { userId: UserId } {
    const state = this.tenancy.state();
    if (state.kind !== "ready" || !this.unlocked()) {
      throw new Error("Recovery is unavailable");
    }
    return { userId: state.userId, tenantId: state.status.tenantId };
  }

  private async run(
    action: (context: RecoveryContext & { userId: UserId }, generation: number) => Promise<void>,
    failure: string,
  ): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.message.set("");
    this.error.set("");
    const generation = this.generation();
    try {
      await action(this.context(), generation);
    } catch {
      if (generation === this.generation()) {
        // Never forward network/crypto errors: they may contain sensitive input.
        this.error.set(failure);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected prepare(): Promise<void> {
    return this.run(async (context, generation) => {
      // Fresh verification for every kit: it exports decryption material, like vault export.
      const { verificationSuccess } = await UserVerificationDialogComponent.open(this.dialogs, {});
      if (!verificationSuccess || generation !== this.generation()) {
        return;
      }
      const prepared = await this.recovery.prepare(context);
      if (generation === this.generation()) {
        this.pending.set(prepared);
        this.savedOffline.reset();
      }
    }, "Could not prepare a recovery kit. Unlock your vault and try again.");
  }

  protected activate(): Promise<void> {
    const pending = this.pending();
    if (!pending || !this.savedOffline.value) {
      return Promise.resolve();
    }
    return this.run(async (context, generation) => {
      await this.recovery.save(pending.payload, context.userId);
      if (generation === this.generation()) {
        this.clearSecrets();
        this.message.set("Recovery kit activated. Any previous kit has been replaced.");
      }
    }, "Could not activate the kit. Keep this secret and retry activation; check your tenant storage grant if the problem continues.");
  }

  protected verify(): Promise<void> {
    return this.run(async (context, generation) => {
      const secret = this.testSecret.value;
      this.testSecret.reset();
      const matches = await this.recovery.verify(secret, context);
      if (generation === this.generation()) {
        if (matches) {
          this.message.set("Recovery key verified locally against your current vault key.");
        } else {
          this.error.set("This kit does not match your current vault key. Create a new kit.");
        }
      }
    }, "Recovery key could not be verified. Check the key, ensure a kit is active, and try again.");
  }

  protected revoke(): Promise<void> {
    if (!this.confirmRevoke.value) {
      return Promise.resolve();
    }
    return this.run(async (context, generation) => {
      await this.recovery.revoke(context.userId);
      if (generation === this.generation()) {
        this.clearSecrets();
        this.message.set("Personal Recovery Kit revoked.");
      }
    }, "Could not revoke the kit. Try again.");
  }

  protected copy(): void {
    const pending = this.pending();
    if (pending) {
      this.platform.copyToClipboard(pending.secret);
      this.message.set("Recovery secret copied. Clear your clipboard after saving it securely.");
    }
  }

  protected download(): void {
    const pending = this.pending();
    const state = this.tenancy.state();
    if (pending && state.kind === "ready") {
      const context = { userId: state.userId, tenantId: state.status.tenantId };
      this.downloads.download({
        fileName: "KyVault-personal-recovery-kit.txt",
        blobData: new Blob(
          [
            `KyVault Personal Recovery Kit — version 1\n\nKEEP OFFLINE AND PRIVATE. Anyone with this secret and your encrypted recovery bundle can decrypt your vault key.\n\nRecovery secret: ${pending.secret}\nUser: ${context.userId}\nTenant: ${context.tenantId}\nServer: ${window.location.origin}\n\nSave or print this file and keep it in a safe place outside your vault. This plain-text file contains your recovery secret. Activate the kit in Security settings after saving it. Rotation replaces the previous kit.\n\nThe server stores only encrypted keys, never this secret. No server escrow or organisation-admin escrow exists. The encrypted bundle is also required for recovery; this secret alone is not a vault backup.\n`,
          ],
          { type: "text/plain;charset=utf-8" },
        ),
        downloadMethod: "save",
      });
    }
  }
}
