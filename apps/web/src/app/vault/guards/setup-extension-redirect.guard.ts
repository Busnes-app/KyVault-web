import { CanActivateFn } from "@angular/router";

import {
  SETUP_EXTENSION_DISMISSED_DISK,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";

export const SETUP_EXTENSION_DISMISSED = new UserKeyDefinition<boolean>(
  SETUP_EXTENSION_DISMISSED_DISK,
  "setupExtensionDismissed",
  {
    deserializer: (dismissed) => dismissed,
    clearOn: [],
  },
);

export const setupExtensionRedirectGuard: CanActivateFn = () => {
  // KyVault self-hosted accounts land directly in their vault without the upstream
  // Bitwarden browser-extension interstitial.
  return true;
};
