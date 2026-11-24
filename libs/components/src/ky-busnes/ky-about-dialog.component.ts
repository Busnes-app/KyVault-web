import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from "@angular/core";

const KYVAULT_LICENSE_NOTICE = `KyVault — Busnes.app Password Manager Web Client
================================================

License
-------
This web client is licensed under the GNU General Public License v3.0
(GPL-3.0-only), derived from the open-source Bitwarden® Web Vault and
the Vaultwarden web-vault project.

Corresponding source code and build instructions are provided with this
distribution and available through the Busnes.app KyVault source repository.

Trademark & Non-Affiliation Notice
----------------------------------
KyVault and Busnes.app are independent projects and are not associated
with, sponsored by, endorsed by, or affiliated with Bitwarden Inc.,
the Bitwarden® project, or the Vaultwarden project.

"Bitwarden" is a registered trademark of Bitwarden Inc.

Typography & Third-Party Notices
--------------------------------
- Space Grotesk — Copyright © The Space Grotesk Project Authors (SIL OFL 1.1)
- IBM Plex Mono — Copyright © IBM Corp. (SIL OFL 1.1)
- Bitwarden® Web Vault — Copyright © Bitwarden Inc. (GPL-3.0-only)
- Vaultwarden web-vault — Copyright © Vaultwarden contributors (GPL-3.0-only)`;

@Component({
  selector: "ky-about-trigger",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!hiddenTrigger()) {
      @if (asMenuItem()) {
        <button
          type="button"
          class="tw-flex tw-w-full tw-items-center tw-gap-2 tw-border-0 tw-bg-transparent tw-px-4 tw-py-2 tw-text-left tw-text-main hover:tw-bg-hover-default"
          (click)="open()"
        >
          <i class="bwi bwi-info-circle bwi-fw" aria-hidden="true"></i>
          <span>{{ label() }}</span>
        </button>
      } @else {
        <button type="button" class="ky-license-link" (click)="open()">
          {{ label() }}
        </button>
      }
    }

    <dialog #dialogEl class="ky-about" (click)="onBackdropClick($event)">
      <div class="ky-about-head">
        <div>
          <h2 class="ky-about-name">
            <span>KyVault</span>
            @if (version()) {
              <span class="ky-about-version">{{ version() }}</span>
            }
          </h2>
          <p class="ky-about-meta">
            Encrypted password manager for Busnes.app. Open-source licenses &amp; notices.
          </p>
        </div>
        <button type="button" class="ky-about-close" (click)="close()">Close</button>
      </div>
      <pre class="ky-about-license">{{ licenseText }}</pre>
    </dialog>
  `,
})
export class KyAboutTriggerComponent {
  readonly label = input<string>("License");
  readonly version = input<string | undefined>(undefined);
  readonly asMenuItem = input<boolean>(false);
  readonly hiddenTrigger = input<boolean>(false);

  protected readonly licenseText = KYVAULT_LICENSE_NOTICE;
  private readonly dialogEl = viewChild<ElementRef<HTMLDialogElement>>("dialogEl");

  open(): void {
    const dialog = this.dialogEl()?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  close(): void {
    this.dialogEl()?.nativeElement.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    const dialog = this.dialogEl()?.nativeElement;
    if (dialog && event.target === dialog) {
      dialog.close();
    }
  }
}
