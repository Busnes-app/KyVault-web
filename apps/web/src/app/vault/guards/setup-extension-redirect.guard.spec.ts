import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { setupExtensionRedirectGuard } from "./setup-extension-redirect.guard";

describe("setupExtensionRedirectGuard", () => {
  it("lets every user into the vault without the extension interstitial", () => {
    const result = TestBed.runInInjectionContext(() =>
      setupExtensionRedirectGuard(
        { queryParams: {} } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    expect(result).toBe(true);
  });
});
