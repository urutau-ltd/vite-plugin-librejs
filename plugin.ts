// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @module plugin
 *
 * Vite plugin for GNU LibreJS compliance.
 *
 * Applies three transforms during `vite build`:
 *
 * 1. **Inline comments** (`renderChunk`, `enforce: "post"`) — wraps every
 *    emitted `.js` chunk with `// @license <magnet> <spdx>` …
 *    `// @license-end` *after* minification, so the comment survives
 *    esbuild/terser without being stripped.
 *
 * 2. **Web Labels page** (`generateBundle`) — emits an HTML asset at
 *    `weblabelsPath` containing the `jslicense-labels1` table that LibreJS
 *    uses to validate scripts when inline comments are absent or stripped
 *    by a reverse proxy.
 *
 * 3. **License link injection** (`transformIndexHtml`) — appends
 *    `<a rel="jslicense" href="…">` to every HTML page so LibreJS can
 *    discover the web labels page automatically.
 */

import type { HtmlTagDescriptor, Plugin } from "vite";
// In Vite ≥7 the bundler backend switched from Rollup to Rolldown.
// These types live in rolldown; Vite re-exports a subset but not all of
// them in every version.  Importing directly from "rolldown" is safe for
// both Vite 6 (rolldown was already a transitive dep) and Vite 7/8.
import type {
    NormalizedOutputOptions,
    OutputAsset,
    OutputBundle,
    OutputChunk,
    RenderedChunk,
} from "rolldown";
import { getLicense, type LicenseInfo } from "./licenses.ts";
import { generateWeblabelsHtml, type WeblabelEntry } from "./weblabels.ts";

// ── Public option types ───────────────────────────────────────────────────────

/**
 * Per-chunk license override.
 * All fields are optional; unset fields fall back to the plugin-level defaults.
 */
export interface ChunkLicense {
    /**
     * SPDX identifier for this specific chunk.
     * Falls back to the global `license` option when omitted.
     */
    readonly license?: string;
    /**
     * Custom LibreJS magnet URI for this chunk.
     * Required only when `license` is not in the built-in map.
     */
    readonly magnet?: string;
    /**
     * URL to the unminified source of this chunk.
     * Injected as `// @source <url>` and used as the third weblabels column.
     */
    readonly source?: string;
}

/** Configuration for {@link librejsPlugin}. */
export interface LibreJSOptions {
    /**
     * Default SPDX identifier applied to every JS chunk.
     *
     * Must be a key in the built-in license map, **or** you must also supply
     * `magnet` with a valid LibreJS magnet URI.
     *
     * @example "AGPL-3.0-or-later"
     * @example "GPL-3.0-or-later"
     * @example "MIT"
     */
    readonly license: string;

    /**
     * Custom LibreJS magnet URI for the default license.
     * Required when `license` is not present in the built-in map.
     */
    readonly magnet?: string;

    /**
     * Base URL prepended to chunk names to form automatic `@source` links:
     * `${sourceBase}/${chunk.name}.js`.
     *
     * Overridden per-chunk via `chunks[fileName].source`.
     *
     * @example "https://example.com/src/"
     */
    readonly sourceBase?: string;

    /**
     * Output path for the web labels HTML page, relative to Vite's `outDir`.
     * @default "about/javascript.html"
     */
    readonly weblabelsPath?: string;

    /**
     * Inject `// @license` … `// @license-end` comments into every JS chunk.
     *
     * Uses `renderChunk` with `enforce: "post"` so the comment wraps
     * the already-minified output.
     * @default true
     */
    readonly inlineComments?: boolean;

    /**
     * Emit the `jslicense-labels1` HTML page as a build asset.
     * @default true
     */
    readonly weblabels?: boolean;

    /**
     * Append `<a rel="jslicense">…</a>` to the `<body>` of every HTML page.
     * @default true
     */
    readonly injectLicenseLink?: boolean;

    /**
     * Visible text of the injected license link and the `<title>` / `<h1>`
     * of the generated web labels page.
     * @default "JavaScript license information"
     */
    readonly licensePageTitle?: string;

    /**
     * Per-chunk overrides keyed by Vite's `chunk.fileName`
     * (e.g. `"assets/vendor-Bca12345.js"`).
     */
    readonly chunks?: Readonly<Record<string, ChunkLicense>>;
}

// ── Internal resolved type ────────────────────────────────────────────────────

interface ResolvedChunk {
    readonly spdxId: string;
    readonly magnet: string;
    readonly label: string;
    readonly licenseUrl: string;
    readonly source: string | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isJsChunk = (fileName: string): boolean => fileName.endsWith(".js");

const autoSourceUrl = (base: string, chunkName: string): string =>
    `${base.replace(/\/$/, "")}/${chunkName}.js`;

// ── Plugin factory ────────────────────────────────────────────────────────────

/**
 * Create a Vite plugin that makes your build output compliant with
 * [GNU LibreJS](https://www.gnu.org/software/librejs/).
 *
 * @throws {Error} If `options.license` is not in the built-in map and no
 *   `options.magnet` is provided — caught at plugin instantiation time so
 *   the build fails before any file is written.
 */
export const librejsPlugin = (options: LibreJSOptions): Plugin => {
    const {
        license: globalLicense,
        magnet: globalMagnetOverride,
        sourceBase,
        weblabelsPath = "about/javascript.html",
        inlineComments = true,
        weblabels = true,
        injectLicenseLink = true,
        licensePageTitle = "JavaScript license information",
        chunks: chunkOverrides = {},
    } = options;

    // ── Validate default license at plugin-creation time ─────────────────────
    const defaultInfo: LicenseInfo | undefined = getLicense(globalLicense);
    const rawDefaultMagnet: string | undefined = globalMagnetOverride ??
        defaultInfo?.magnet;

    if (rawDefaultMagnet === undefined) {
        throw new Error(
            `[vite-plugin-librejs] License "${globalLicense}" is not in the built-in map.\n` +
                `Supply a "magnet" URI in the plugin options.\n` +
                `Reference: https://www.gnu.org/software/librejs/manual/html_node/Free-Licenses-Detection.html`,
        );
    }

    // Re-bind as a non-optional string so closures below retain the narrowing.
    const defaultMagnet: string = rawDefaultMagnet;

    // ── Pure chunk resolver ───────────────────────────────────────────────────
    const resolveChunk = (
        fileName: string,
        chunkName: string,
    ): ResolvedChunk => {
        const override: ChunkLicense | undefined = chunkOverrides[fileName];
        const spdxId: string = override?.license ?? globalLicense;
        const info: LicenseInfo | undefined = getLicense(spdxId);
        const magnet: string = override?.magnet ?? info?.magnet ??
            defaultMagnet;
        const label: string = info?.label ?? spdxId;
        const licenseUrl: string = info?.url ?? magnet;
        const source: string | undefined = override?.source ??
            (sourceBase !== undefined
                ? autoSourceUrl(sourceBase, chunkName)
                : undefined);

        return Object.freeze({ spdxId, magnet, label, licenseUrl, source });
    };

    // ── Plugin object ─────────────────────────────────────────────────────────
    return {
        name: "librejs",
        enforce: "post",

        // 1. Wrap every JS chunk with @license / @license-end ─────────────────
        renderChunk(
            code: string,
            chunk: RenderedChunk,
            _outputOptions: NormalizedOutputOptions,
        ) {
            if (!inlineComments || !isJsChunk(chunk.fileName)) {
                return null;
            }

            const { spdxId, magnet, source } = resolveChunk(
                chunk.fileName,
                chunk.name,
            );
            const sourceComment: string = source !== undefined
                ? `// @source ${source}\n`
                : "";
            const header = `// @license ${magnet} ${spdxId}\n${sourceComment}`;
            const footer = `\n// @license-end\n`;

            return {
                code: `${header}${code}${footer}`,
                map: null,
            };
        },

        // 2. Emit jslicense-labels1 HTML asset ────────────────────────────────
        generateBundle(
            _outputOptions: NormalizedOutputOptions,
            bundle: OutputBundle,
        ): void {
            if (!weblabels) return;

            const entries: ReadonlyArray<WeblabelEntry> = Object.keys(bundle)
                .flatMap((fileName): WeblabelEntry[] => {
                    const asset: OutputAsset | OutputChunk | undefined =
                        bundle[fileName];
                    if (
                        asset === undefined ||
                        asset.type !== "chunk" ||
                        !isJsChunk(fileName)
                    ) {
                        return [];
                    }
                    const { label, licenseUrl, source } = resolveChunk(
                        fileName,
                        asset.name,
                    );
                    return [
                        Object.freeze<WeblabelEntry>({
                            scriptPath: `/${fileName}`,
                            scriptName: fileName.split("/").at(-1) ?? fileName,
                            licenseLabel: label,
                            licenseUrl,
                            ...(source !== undefined
                                ? { sourcePath: source }
                                : {}),
                        }),
                    ];
                });

            if (entries.length === 0) return;

            this.emitFile({
                type: "asset",
                fileName: weblabelsPath,
                source: generateWeblabelsHtml(entries, licensePageTitle),
            });
        },

        // 3. Inject rel="jslicense" link into every HTML page ─────────────────
        transformIndexHtml(): HtmlTagDescriptor[] {
            if (!injectLicenseLink) return [];

            return [
                {
                    tag: "a",
                    attrs: {
                        href: `/${weblabelsPath}`,
                        rel: "jslicense",
                        style: "font-size:0.8em;opacity:0.7",
                    },
                    children: licensePageTitle,
                    injectTo: "body" as const,
                },
            ];
        },
    };
};
