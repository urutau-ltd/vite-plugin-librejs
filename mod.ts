// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @module vite-plugin-librejs
 *
 * Vite plugin for GNU LibreJS compliance.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import { librejsPlugin } from "jsr:@urutau-ltd/vite-plugin-librejs";
 *
 * export default defineConfig({
 *   plugins: [
 *     librejsPlugin({
 *       license: "AGPL-3.0-or-later",
 *       sourceBase: "https://example.com/src/",
 *     }),
 *   ],
 * });
 * ```
 */
export { librejsPlugin } from "./plugin.ts";
export type { ChunkLicense, LibreJSOptions } from "./plugin.ts";
export { getLicense, LICENSES } from "./licenses.ts";
export type { LicenseInfo, LicenseMap } from "./licenses.ts";
export { generateWeblabelsHtml } from "./weblabels.ts";
export type { WeblabelEntry } from "./weblabels.ts";
