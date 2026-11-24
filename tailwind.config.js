/* eslint-disable */
const fs = require("fs");
const path = require("path");

const config = require("./libs/components/tailwind.config.base");
const webConfig = require("./apps/web/tailwind.config");
const browserConfigPath = path.resolve(__dirname, "apps/browser/tailwind.config.js");
const desktopConfigPath = path.resolve(__dirname, "apps/desktop/tailwind.config.js");
const browserConfig = fs.existsSync(browserConfigPath)
  ? require(browserConfigPath)
  : { browserContent: [] };
const desktopConfig = fs.existsSync(desktopConfigPath)
  ? require(desktopConfigPath)
  : { desktopContent: [] };

/**
 * Pull together all the tailwind configs for the shared libs and clients for use in Storybook.
 *
 * Do not add new paths here directly. Add shared libs to tailwind.config.base.js, and add
 * app-specific paths to their respective tailwind.config.js file
 */
config.content = [
  ...config.content,
  ...webConfig.webContent,
  ...browserConfig.browserContent,
  ...desktopConfig.desktopContent,
  path.resolve(__dirname, ".storybook/preview.tsx"),
];

// Safelist is required for dynamic color classes in Storybook color documentation (colors.mdx).
// Tailwind's JIT compiler cannot detect dynamically constructed class names like `tw-bg-${name}`,
// so we must explicitly safelist these patterns to ensure all color utilities are generated.
config.safelist = [
  {
    pattern: /tw-bg-(.*)/,
  },
];

config.corePlugins.preflight = true;

module.exports = config;
