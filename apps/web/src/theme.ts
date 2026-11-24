import { applyKyTheme, readStoredKyTheme } from "@bitwarden/common/platform/theming/ky-theme";

/**
 * Apply the active Busnes theme palette and color scheme before Angular boots
 * so there is zero flash of unthemed content.
 */
applyKyTheme(readStoredKyTheme(), document.documentElement);
