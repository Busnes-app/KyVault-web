import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { LayoutComponent } from "@bitwarden/components";

import {
  KyMobileActionsComponent,
  KyMobileFooterComponent,
} from "./ky-sidebar-footer/ky-sidebar-footer.component";
import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-layout",
  templateUrl: "web-layout.component.html",
  imports: [
    CommonModule,
    LayoutComponent,
    ProductSwitcherModule,
    KyMobileActionsComponent,
    KyMobileFooterComponent,
  ],
})
export class WebLayoutComponent {
  constructor() {}
}
