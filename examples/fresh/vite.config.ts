import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import { librejsPlugin } from "../../mod.ts";

export default defineConfig({
  plugins: [
    fresh(),
    librejsPlugin({
      license: "MIT",
      // Fresh renders HTML at request time, so the plugin's HTML hook never
      // fires during the build. The `rel="jslicense"` link lives in
      // routes/_app.tsx instead.
      injectLicenseLink: false,
    }),
  ],
});
