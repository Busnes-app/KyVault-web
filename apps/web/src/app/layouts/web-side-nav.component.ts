import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SideNavVariant, NavigationModule, SideNavService } from "@bitwarden/components";
import { VaultTourCalloutComponent } from "@bitwarden/vault";

import { KySidebarFooterComponent } from "./ky-sidebar-footer/ky-sidebar-footer.component";
import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";

@Component({
  selector: "app-side-nav",
  templateUrl: "web-side-nav.component.html",
  imports: [
    KySidebarFooterComponent,
    NavigationModule,
    ProductSwitcherModule,
    VaultTourCalloutComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebSideNavComponent {
  readonly variant = input<SideNavVariant>("primary");
  protected readonly sideNavService = inject(SideNavService);

  /**
   * Whether the VFO1 Foundation flag is enabled.
   */
  protected readonly vfo1FoundationEnabled = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );
}
