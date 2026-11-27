import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { PersonalRecoveryPayload } from "./personal-recovery-crypto";
import { PersonalRecoveryComponent } from "./personal-recovery.component";
import { PersonalRecoveryService } from "./personal-recovery.service";
import { TenancyService, TenancyState } from "./tenancy.service";
import { recoveryUserId, tenancyStatus } from "./tenancy.spec-util";

describe("PersonalRecoveryComponent", () => {
  const recovery = mock<PersonalRecoveryService>();
  const platform = mock<PlatformUtilsService>();
  const downloads = mock<FileDownloadService>();
  const keys = mock<KeyService>();
  const i18n = mock<I18nService>();
  const state = signal<TenancyState>({
    kind: "ready",
    userId: recoveryUserId,
    status: tenancyStatus,
  });
  const userKey$ = new BehaviorSubject<UserKey | null>(mock<UserKey>());
  const payload: PersonalRecoveryPayload = {
    version: 1,
    kdfParams: {
      name: "HKDF",
      hash: "SHA-256",
      salt: "public-salt",
      info: "KyVault personal recovery v1",
      cipher: "AES-256-GCM",
    },
    wrappedUserKey: "ciphertext",
  };
  let fixture: ComponentFixture<PersonalRecoveryComponent>;
  let component: PersonalRecoveryComponent;

  beforeEach(async () => {
    jest.resetAllMocks();
    state.set({ kind: "ready", userId: recoveryUserId, status: tenancyStatus });
    userKey$.next(mock<UserKey>());
    keys.userKey$.mockReturnValue(userKey$);
    i18n.t.mockImplementation((key) => key);
    recovery.prepare.mockResolvedValue({ secret: "offline-secret", payload });
    await TestBed.configureTestingModule({
      imports: [PersonalRecoveryComponent, NoopAnimationsModule],
      providers: [
        { provide: TenancyService, useValue: { state } },
        { provide: PersonalRecoveryService, useValue: recovery },
        { provide: PlatformUtilsService, useValue: platform },
        { provide: FileDownloadService, useValue: downloads },
        { provide: KeyService, useValue: keys },
        { provide: AccountService, useValue: { activeAccount$: of({ id: recoveryUserId }) } },
        { provide: I18nService, useValue: i18n },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PersonalRecoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("requires offline acknowledgement before activation and offers copy/download", async () => {
    await component["prepare"]();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("offline-secret");
    await component["activate"]();
    expect(recovery.save).not.toHaveBeenCalled();
    component["copy"]();
    expect(platform.copyToClipboard).toHaveBeenCalledWith("offline-secret");
    component["download"]();
    expect(downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "KyVault-personal-recovery-kit.txt",
        downloadMethod: "save",
        blobData: expect.any(Blob),
      }),
    );
    component["savedOffline"].setValue(true);
    await component["activate"]();
    expect(recovery.save).toHaveBeenCalledWith(payload, recoveryUserId);
    expect(component["pending"]()).toBeNull();
    expect(component["message"]()).toContain("activated");
  });

  it("does not replace an existing kit until activation succeeds, and allows retry", async () => {
    state.set({
      kind: "ready",
      userId: recoveryUserId,
      status: { ...tenancyStatus, recovery: { hasPersonalRecoveryKit: true } },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Rotate recovery kit");
    await component["prepare"]();
    expect(recovery.save).not.toHaveBeenCalled();
    recovery.save.mockRejectedValue(new Error("private server details"));
    component["savedOffline"].setValue(true);
    await component["activate"]();
    expect(component["pending"]()?.secret).toBe("offline-secret");
    expect(component["error"]()).not.toContain("private server details");
    recovery.save.mockResolvedValue();
    await component["activate"]();
    expect(component["pending"]()).toBeNull();
  });

  it("verifies locally, clears typed secrets, and distinguishes stale keys", async () => {
    component["testSecret"].setValue("typed-secret");
    recovery.verify.mockResolvedValue(true);
    await component["verify"]();
    expect(recovery.verify).toHaveBeenCalledWith("typed-secret", {
      userId: recoveryUserId,
      tenantId: tenancyStatus.tenantId,
    });
    expect(component["testSecret"].value).toBe("");
    expect(component["message"]()).toContain("verified locally");
    recovery.verify.mockResolvedValue(false);
    component["testSecret"].setValue("old-secret");
    await component["verify"]();
    expect(component["error"]()).toContain("does not match");
  });

  it("requires explicit confirmation to revoke", async () => {
    await component["revoke"]();
    expect(recovery.revoke).not.toHaveBeenCalled();
    component["confirmRevoke"].setValue(true);
    await component["revoke"]();
    expect(recovery.revoke).toHaveBeenCalledWith(recoveryUserId);
    expect(component["confirmRevoke"].value).toBe(false);
  });

  it("clears secrets on lock and discards a preparation that completes after lock", async () => {
    await component["prepare"]();
    component["testSecret"].setValue("typed");
    userKey$.next(null);
    expect(component["pending"]()).toBeNull();
    expect(component["testSecret"].value).toBe("");
    userKey$.next(mock<UserKey>());
    let finish!: (value: { secret: string; payload: PersonalRecoveryPayload }) => void;
    recovery.prepare.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const running = component["prepare"]();
    userKey$.next(null);
    finish({ secret: "too-late", payload });
    await running;
    expect(component["pending"]()).toBeNull();
  });

  it("hides controls when unsupported but supports single-tenant recovery endpoints", () => {
    state.set({ kind: "unsupported", userId: recoveryUserId });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("unavailable on this server");
    expect(fixture.nativeElement.querySelector("button")).toBeNull();
    state.set({
      kind: "ready",
      userId: recoveryUserId,
      status: { ...tenancyStatus, multiTenant: false },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Create recovery kit");
  });
});
