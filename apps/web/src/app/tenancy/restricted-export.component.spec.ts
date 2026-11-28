import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { ManagedSettingsService } from "@bitwarden/managed-settings";
import { ManagedSettingsClient } from "@bitwarden/sdk-internal";

import { RestrictedExportComponent } from "./restricted-export.component";
import {
  email,
  newSdkClient,
  password,
  restrictedExportFixture,
} from "./restricted-export.spec-util";

describe("RestrictedExportComponent", () => {
  const userId = "c7312a46-17c4-4a8c-965b-123456789abc" as UserId;
  const data = restrictedExportFixture();
  const api = mock<ApiService>();
  const downloads = mock<FileDownloadService>();
  const dialogs = mock<DialogService>();
  const logout = mock<LogoutService>();
  const sdkClients = mock<SdkClientFactory>();
  const i18n = mock<I18nService>();
  const timeouts = mock<VaultTimeoutSettingsService>();
  const account$ = new BehaviorSubject({ id: userId, email });
  let fixture: ComponentFixture<RestrictedExportComponent>;
  let component: RestrictedExportComponent;

  const page = () => fixture.nativeElement as HTMLElement;
  const enterPassword = async (value: string) => {
    const input = page().querySelector<HTMLInputElement>("input[type=password]")!;
    input.value = value;
    input.dispatchEvent(new Event("input"));
    page().querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  // jsdom's Blob has no text().
  const savedText = (call: number) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(downloads.download.mock.calls[call][0].blobData as Blob);
    });

  beforeEach(async () => {
    jest.resetAllMocks();
    i18n.t.mockImplementation((key) => key);
    timeouts.getVaultTimeoutByUserId$.mockReturnValue(of(1));
    api.send.mockResolvedValue(JSON.parse(JSON.stringify(data)));
    sdkClients.createSdkClient.mockImplementation(() => Promise.resolve(newSdkClient()));
    await TestBed.configureTestingModule({
      imports: [RestrictedExportComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: AccountService, useValue: { activeAccount$: account$ } },
        { provide: FileDownloadService, useValue: downloads },
        { provide: DialogService, useValue: dialogs },
        { provide: LogoutService, useValue: logout },
        { provide: SdkClientFactory, useValue: sdkClients },
        {
          provide: ManagedSettingsService,
          useValue: { client$: of(new ManagedSettingsClient()) },
        },
        { provide: I18nService, useValue: i18n },
        { provide: VaultTimeoutSettingsService, useValue: timeouts },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RestrictedExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("says the organisation is being deleted and only personal items are exported", () => {
    const text = page().textContent!;
    expect(text).toContain("scheduled for deletion");
    expect(text).toContain("only your own personal items");
    expect(text).toContain("Organisation items are not included");
    expect(text).toContain(email);
  });

  it("calls only the export route, and refuses a wrong master password", async () => {
    await enterPassword("wrong password");

    expect(page().querySelector("[role=alert]")!.textContent).toContain("did not unlock");
    expect(page().textContent).not.toContain("Download encrypted export");
    expect(api.send.mock.calls).toEqual([["GET", "/tenancy/export", null, userId, true]]);
    expect(downloads.download).not.toHaveBeenCalled();
  });

  it("downloads the encrypted export exactly as the server returned it", async () => {
    await enterPassword(password);
    component["downloadEncrypted"]();

    expect(JSON.parse(await savedText(0))).toEqual(data);
    expect(downloads.download.mock.calls[0][0].fileName).toMatch(
      /^kyvault_restricted_export_\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(api.send).toHaveBeenCalledTimes(1);
  });

  it("decrypts locally only after the plaintext warning is accepted", async () => {
    await enterPassword(password);

    dialogs.openSimpleDialog.mockResolvedValue(false);
    await component["downloadDecrypted"]();
    expect(downloads.download).not.toHaveBeenCalled();

    dialogs.openSimpleDialog.mockResolvedValue(true);
    await component["downloadDecrypted"]();
    expect(dialogs.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { key: "exportUnencryptedWarningDesc" },
        type: "warning",
      }),
    );
    const doc = JSON.parse(await savedText(0));
    expect(doc.encrypted).toBe(false);
    expect(doc.items.map((i: { name: string }) => i.name)).toContain("Bank");
    // The SDK client never gets a token, and nothing goes back to the server.
    const tokenProvider = sdkClients.createSdkClient.mock.calls[0][0];
    await expect(tokenProvider.get_access_token()).resolves.toBeUndefined();
    expect(api.send).toHaveBeenCalledTimes(1);
  });

  it("wipes the unlocked key on sign out", async () => {
    await enterPassword(password);
    const key = component["opened"]()!.userKey;

    await component["signOut"]();

    expect(key.every((byte) => byte === 0)).toBe(true);
    expect(component["opened"]()).toBeNull();
    expect(logout.logout).toHaveBeenCalledWith(userId, "userInitiated");
  });

  it("locks the export again after the vault timeout", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    try {
      await enterPassword(password);
      const key = component["opened"]()!.userKey;
      expect(timeouts.getVaultTimeoutByUserId$).toHaveBeenCalledWith(userId);

      jest.advanceTimersByTime(59_000);
      expect(component["opened"]()).not.toBeNull();
      jest.advanceTimersByTime(1_000);
      fixture.detectChanges();

      expect(key.every((byte) => byte === 0)).toBe(true);
      expect(component["opened"]()).toBeNull();
      dialogs.openSimpleDialog.mockResolvedValue(true);
      await component["downloadDecrypted"]();
      component["downloadEncrypted"]();
      expect(downloads.download).not.toHaveBeenCalled();
      expect(page().querySelector("input[type=password]")).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("uses 15 minutes when the vault timeout is not a number", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    try {
      timeouts.getVaultTimeoutByUserId$.mockReturnValue(of("never" as const));
      await enterPassword(password);
      jest.advanceTimersByTime(15 * 60_000 - 1);
      expect(component["opened"]()).not.toBeNull();
      jest.advanceTimersByTime(1);
      expect(component["opened"]()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("recovers when the SDK client cannot start", async () => {
    await enterPassword(password);
    dialogs.openSimpleDialog.mockResolvedValue(true);
    sdkClients.createSdkClient.mockRejectedValue(new Error("no sdk"));

    await component["downloadDecrypted"]();

    expect(component["busy"]()).toBe(false);
    expect(component["error"]()).toContain("could not be decrypted");
    expect(downloads.download).not.toHaveBeenCalled();
  });
});
