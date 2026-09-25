// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @module plugin
 *
 * Vite plugin for GNU LibreJS compliance.
 *
 * Applies three transforms during `vite build`:
 *
 * 1. **Inline comments** (`generateBundle`) — wraps every emitted `.js`
 *    chunk with `// @license <magnet> <spdx>` … `// @license-end` by
 *    mutating `chunk.code` directly in `generateBundle`, where the code is
 *    already fully minified.  Using `renderChunk` is insufficient under
 *    Vite 8 / rolldown because rolldown's minifier runs *after* all
 *    `renderChunk` hooks and strips any comments they inject.
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

import type {
    HtmlTagDescriptor,
    IndexHtmlTransformContext,
    Plugin,
    Rollup,
} from "vite";
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
     * @type {string | undefined}
     */
    readonly license?: string | undefined;
    /**
     * Custom LibreJS magnet URI for this chunk.
     * Required only when `license` is not in the built-in map.
     * @type {string | undefined}
     */
    readonly magnet?: string | undefined;
    /**
     * URL to the unminified source of this chunk.
     * Injected as `// @source <url>` and used as the third weblabels column.
     * @type {string | undefined}
     */
    readonly source?: string | undefined;
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
     * Comments are injected in `generateBundle` by mutating `chunk.code`
     * directly, after rolldown's minifier has already run.
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
     * Per-chunk overrides keyed by either Vite's final `chunk.fileName`
     * (e.g. `"assets/vendor-Bca12345.js"`) or the logical `chunk.name`
     * (e.g. `"vendor"`).
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

const JS_CHUNK_PATTERN: RegExp = /\.(?:[cm]?js)$/;

const isJsChunk = (fileName: string): boolean =>
    JS_CHUNK_PATTERN.test(fileName);

const normalizeOutputPath = (path: string): string =>
    path.replace(/^\.?\//, "").replace(/^\/+/, "");

const dirname = (path: string): string => {
    const normalized = normalizeOutputPath(path);
    const separatorIndex = normalized.lastIndexOf("/");
    return separatorIndex === -1 ? "" : normalized.slice(0, separatorIndex);
};

const relativePath = (fromFile: string, toFile: string): string => {
    const fromParts = dirname(fromFile).split("/").filter(Boolean);
    const toParts = normalizeOutputPath(toFile).split("/").filter(Boolean);

    while (fromParts[0] !== undefined && fromParts[0] === toParts[0]) {
        fromParts.shift();
        toParts.shift();
    }

    const upwardPath = "../".repeat(fromParts.length);
    return `${upwardPath}${toParts.join("/")}` || ".";
};

const getChunkOverride = (
    chunkOverrides: Readonly<Record<string, ChunkLicense>>,
    fileName: string,
    chunkName: string,
): ChunkLicense | undefined =>
    chunkOverrides[fileName] ?? chunkOverrides[chunkName];

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
        const override = getChunkOverride(chunkOverrides, fileName, chunkName);
        const spdxId: string = override?.license ?? globalLicense;
        const info: LicenseInfo | undefined = getLicense(spdxId);
        const magnet = override?.magnet ?? info?.magnet ??
            (spdxId === globalLicense ? defaultMagnet : undefined);

        if (magnet === undefined) {
            throw new Error(
                `[vite-plugin-librejs] Chunk "${fileName}" declares unsupported license "${spdxId}".\n` +
                    `Supply "chunks.${fileName}.magnet" (or "chunks.${chunkName}.magnet") to define the LibreJS magnet URI.\n` +
                    `Reference: https://www.gnu.org/software/librejs/manual/html_node/Free-Licenses-Detection.html`,
            );
        }

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
        name: "vite-plugin-librejs",

        // 1. Inline @license comments + 2. Emit jslicense-labels1 asset
        generateBundle(
            _outputOptions: Rollup.NormalizedOutputOptions,
            bundle: Rollup.OutputBundle,
        ): void {
            // Inject inline comments post-minification.
            // In vite 8 / rolldown, minification runs after all renderChunk
            // hooks; mutating chunk.code here reaches the already-final output

            if (inlineComments) {
                for (const [fileName, asset] of Object.entries(bundle)) {
                    if (asset.type !== "chunk" || !isJsChunk(fileName)) {
                        continue;
                    }
                    const {
                        spdxId,
                        magnet,
                        source,
                    } = resolveChunk(fileName, asset.name);
                    const sourceComment: string = source !== undefined
                        ? `// @source ${source}\n`
                        : "";
                    asset.code =
                        `// @license ${magnet} ${spdxId}\n${sourceComment}` +
                        asset.code + `\n// @license-end\n`;
                }
            }

            if (!weblabels) return;

            const entries: ReadonlyArray<WeblabelEntry> = Object.keys(bundle)
                .flatMap((fileName): WeblabelEntry[] => {
                    const asset:
                        | Rollup.OutputAsset
                        | Rollup.OutputChunk
                        | undefined = bundle[fileName];
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
                            scriptPath: relativePath(weblabelsPath, fileName),
                            scriptName: fileName.split("/").at(-1) ?? fileName,
                            licenseLabel: label,
                            licenseUrl,
                            ...(source !== undefined
                                ? { sourcePath: source }
                                : {}),
                        }),
                    ];
                })
                .toSorted((left, right): number =>
                    left.scriptName.localeCompare(right.scriptName)
                );

            if (entries.length === 0) return;

            this.emitFile({
                type: "asset",
                fileName: weblabelsPath,
                source: generateWeblabelsHtml(entries, licensePageTitle),
            });
        },

        // 3. Inject rel="jslicense" link into every HTML page ─────────────────
        transformIndexHtml(
            _html: string,
            context: IndexHtmlTransformContext,
        ): HtmlTagDescriptor[] {
            if (!injectLicenseLink) return [];

            return [
                {
                    tag: "a",
                    attrs: {
                        href: relativePath(context.path, weblabelsPath),
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
