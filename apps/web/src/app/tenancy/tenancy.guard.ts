import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { filter, firstValueFrom } from "rxjs";

import { TenancyService, tenancyAllows } from "./tenancy.service";

export function tenancyFeatureGuard(feature: "allowSends" | "allowEmergencyAccess"): CanActivateFn {
  return async () => {
    const router = inject(Router);
    const tenancy = inject(TenancyService);
    const state = await firstValueFrom(
      tenancy.state$.pipe(filter((state) => state.kind !== "loading")),
    );
    return tenancyAllows(state, feature) || router.parseUrl("/vault");
  };
}
