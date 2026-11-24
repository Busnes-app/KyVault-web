/* eslint-disable no-console */

/// Ensure OSS `@bitwarden/sdk-internal` is pinned and commercial SDK is never added.

import fs from "fs";
import path from "path";

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
);

const sdkInternal = packageJson.dependencies["@bitwarden/sdk-internal"];
const commercialSdkInternal =
  packageJson.dependencies["@bitwarden/commercial-sdk-internal"] ??
  packageJson.devDependencies?.["@bitwarden/commercial-sdk-internal"];

if (!sdkInternal) {
  console.error("Missing required OSS dependency @bitwarden/sdk-internal.");
  process.exit(1);
}

if (commercialSdkInternal) {
  console.error(
    `Restricted dependency @bitwarden/commercial-sdk-internal (${commercialSdkInternal}) must not be present in the OSS fork.`,
  );
  process.exit(1);
}

console.log(
  `OSS SDK dependency verified: @bitwarden/sdk-internal@${sdkInternal} (commercial SDK excluded)`,
);
