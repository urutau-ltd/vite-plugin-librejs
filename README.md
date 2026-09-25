# vite-plugin-librejs

`vite` plugin for [GNU LibreJS](https://www.gnu.org/software/librejs/)
compliance.

Written in TypeScript, Deno and distributed on JSR.

This README is the documentation.

## What does it do?

GNU LibreJS blocks JavaScript that does not carry a recognised free-software
license notice. This plugin automates all three compliance methods LibreJS
supports, applied automatically during `vite build`.

In practice, this plugin does three things:

- wraps emitted JavaScript chunks with machine-readable `@license` comments
- emits a `jslicense-labels1` web labels page
- injects a `rel="jslicense"` link into every built HTML page

For further reading about why LibreJS exists and why you may want to care:

- [The JavaScript Trap](https://www.gnu.org/philosophy/javascript-trap.html)
- [Setting Your JavaScript Free](https://www.gnu.org/software/librejs/manual/html_node/Setting-Your-JavaScript-Free.html)
- [JavaScript License Web Labels](https://www.gnu.org/licenses/javascript-labels.en.html)

## Installation

```ts
// vite.config.ts
import { defineConfig } from "npm:vite";
import { librejsPlugin } from "jsr:@urutau-ltd/vite-plugin-librejs";

export default defineConfig({
    plugins: [
        librejsPlugin({
            license: "AGPL-3.0-or-later",
            sourceBase: "https://example.com/src/",
        }),
    ],
});
```

If you are using this from a Deno-managed project, the import above is enough.
If you are using a regular Vite project, the important bit is still the same:
the plugin itself comes from JSR and Vite comes from `npm:vite`.

## Quick Start

The smallest useful setup is:

```ts
import { defineConfig } from "npm:vite";
import { librejsPlugin } from "jsr:@urutau-ltd/vite-plugin-librejs";

export default defineConfig({
    plugins: [
        librejsPlugin({
            license: "MIT",
        }),
    ],
});
```

That will:

- add inline LibreJS license comments to emitted JS chunks
- generate `about/javascript.html`
- inject a link to that page in built HTML

If your code is copyleft and you want proper `@source` links too:

```ts
import { defineConfig } from "npm:vite";
import { librejsPlugin } from "jsr:@urutau-ltd/vite-plugin-librejs";

export default defineConfig({
    plugins: [
        librejsPlugin({
            license: "AGPL-3.0-or-later",
            sourceBase: "https://example.com/src/",
        }),
    ],
});
```

## How it works

### Inline Comments

Wraps every emitted JS chunk with the machine-readable comment pair LibreJS
checks:

```js
// @license magnet:?xt=urn:btih:...&dn=agpl-3.0.txt AGPL-3.0-or-later
// @source https://example.com/src/main.js
(() => {/* minified code */})();
// @license-end
```

The hook runs **after** `esbuild`/`terser` minification, so the comment survives
without being stripped, something heretical for the JS devs, which makes it even
cooler. The `@source` line is injected automatically when `sourceBase` is set,
satisfying the copyleft requirement to provide access to source code.

This currently applies to emitted `.js`, `.mjs` and `.cjs` chunks.

### Web Labels Page

This emits an HTML asset at `weblabelsPath` (by default `about/javascript.html`)
containing the `jslicense-labels1` table:

```html
<table id="jslicense-labels1">
    <tr>
        <td><a href="../assets/main-A1b2.js">main-A1b2.js</a></td>
        <td>
            <a href="https://www.gnu.org/licenses/agpl-3.0.html">
                GNU Affero General Public License version 3 or later
            </a>
        </td>
        <td><a href="https://example.com/src/main.js">main.js</a></td>
    </tr>
</table>
```

LibreJS falls back to this table when a script has no inline comment, or when
something in front of your app strips or rewrites comments.

One behavior detail that matters: script links in the generated table are
relative to the web labels page itself. This means nested output layouts work
correctly instead of assuming everything lives at web root.

### License Link Injection

Appends to the `<body>` of every HTML page:

```html
<a
    href="../about/javascript.html"
    rel="jslicense"
    style="font-size: 0.8em; opacity: 0.7"
>
    JavaScript license information
</a>
```

The `rel="jslicense"` attribute is how LibreJS discovers the web labels page for
a given site.

The injected `href` is also relative to each HTML file, which matters if your
build emits pages into nested directories.

## A Complete Example

Here is a more realistic setup where your own code is AGPL, but a vendor chunk
needs a different license label and a different source link:

```ts
import { defineConfig } from "npm:vite";
import { librejsPlugin } from "jsr:@urutau-ltd/vite-plugin-librejs";

export default defineConfig({
    build: {
        sourcemap: false,
        output: {
            // Vite 8 / Rolldown requires a function
            manualChunks: (id) =>
                id.includes("node_modules") ? "vendor" : "undefined",
        },
    },
    plugins: [
        librejsPlugin({
            license: "AGPL-3.0-or-later",
            sourceBase: "https://example.com/src/",
            weblabelsPath: "about/javascript.html",
            licensePageTitle: "JavaScript license information",
            chunks: {
                vendor: {
                    license: "MIT",
                    source:
                        "https://registry.npmjs.org/some-dep/-/some-dep-1.0.0.tgz",
                },
            },
        }),
    ],
});
```

This is not magic. The plugin can only label what Vite emits, and the source
URLs you provide still need to actually exist and be accessible.

## Options

```ts
interface ChunkLicense {
    license?: string;
    magnet?: string;
    source?: string;
}

interface LibreJSOptions {
    license: string;
    magnet?: string;
    sourceBase?: string;
    weblabelsPath?: string;
    inlineComments?: boolean;
    weblabels?: boolean;
    injectLicenseLink?: boolean;
    licensePageTitle?: string;
    chunks?: Record<string, ChunkLicense>;
}
```

### `license`

The default SPDX identifier applied to every JS chunk.

Examples:

- `AGPL-3.0-or-later`
- `GPL-3.0-or-later`
- `MIT`
- `Apache-2.0`

This must either:

- exist in the built-in license map
- or be paired with a `magnet` option

If not, plugin creation throws immediately and the build fails early.

### `magnet`

Custom LibreJS magnet URI for the default license.

Use this when your chosen SPDX identifier is not in the built-in map:

```ts
librejsPlugin({
    license: "EUPL-1.2",
    magnet:
        "magnet:?xt=urn:btih:e4ae48d8b484fce88a6cf1d33d4a4bfcbc1fdcf1&dn=eupl-1.2.txt",
});
```

LibreJS identifies licenses by the SHA-1 info-hash embedded in the magnet URI,
not by the human-readable SPDX string.

### `sourceBase`

Base URL used to generate automatic `@source` links:

```ts
sourceBase: "https://example.com/src/";
```

For a chunk named `main`, the generated source URL becomes:

```txt
https://example.com/src/main.js
```

This is convenient for simple deployments, but it is based on `chunk.name`, not
the final hashed file name.

If you need exact per-file source URLs, use `chunks[].source`.

### `weblabelsPath`

Output path for the web labels HTML page, relative to Vite's `outDir`.

Default:

```txt
about/javascript.html
```

Examples:

- `about/javascript.html`
- `legal/javascript.html`
- `javascript.html`

The plugin computes relative links against this path, so moving it deeper into
the output tree is supported.

### `inlineComments`

Whether to inject `@license` and `@license-end` comments into emitted JS chunks.

Default:

```ts
inlineComments: true;
```

Disable it if you only want the web labels page:

```ts
librejsPlugin({
    license: "MIT",
    inlineComments: false,
});
```

### `weblabels`

Whether to emit the `jslicense-labels1` HTML page.

Default:

```ts
weblabels: true;
```

### `injectLicenseLink`

Whether to append the `rel="jslicense"` link to built HTML pages.

Default:

```ts
injectLicenseLink: true;
```

If you disable this, the page can still be generated, but LibreJS will not
discover it automatically unless you add the link yourself.

### `licensePageTitle`

Visible text of the injected license link and the `<title>` / `<h1>` of the
generated web labels page.

Default:

```txt
JavaScript license information
```

Example:

```ts
librejsPlugin({
    license: "MIT",
    licensePageTitle: "LibreJS metadata",
});
```

### `chunks`

Per-chunk overrides.

Each entry can override:

- `license`
- `magnet`
- `source`

Keys can be either:

- the final emitted `chunk.fileName`, for example `assets/vendor-Bca12345.js`
- the logical `chunk.name`, for example `vendor`

Example keyed by chunk name:

```ts
librejsPlugin({
    license: "AGPL-3.0-or-later",
    sourceBase: "https://example.com/src/",
    chunks: {
        vendor: {
            license: "MIT",
            source: "https://registry.npmjs.org/some-dep/-/some-dep-1.0.0.tgz",
        },
    },
});
```

Example keyed by final emitted file name:

```ts
librejsPlugin({
    license: "AGPL-3.0-or-later",
    chunks: {
        "assets/vendor-Bca12345.js": {
            license: "MIT",
        },
    },
});
```

When both are present, exact `fileName` matches win over `chunk.name` matches.

If a chunk declares a license that is not in the built-in map, that chunk must
also define a matching `magnet`. The plugin now fails fast instead of silently
reusing the global magnet, because silent wrong metadata is garbage.

## How Chunk Resolution Works

For every emitted JS chunk, the plugin resolves metadata in this order:

1. pick a per-chunk override, first by exact `fileName`, then by `chunk.name`
2. resolve the SPDX identifier from `chunks[].license` or the global `license`
3. resolve the magnet from `chunks[].magnet`, built-in license metadata, or the
   global default magnet if the chunk still uses the global license
4. resolve the source URL from `chunks[].source` or `sourceBase`

This means:

- the global `license` is your default
- `chunks` is the escape hatch for special cases
- unknown per-chunk licenses must bring their own `magnet`

## Output Behavior

During `vite build`, the plugin hooks into:

- `renderChunk`
- `generateBundle`
- `transformIndexHtml`

It is a build-time plugin. It is not doing anything interesting during dev
server operation, and that is intentional.

The plugin name reported to Vite is:

```txt
vite-plugin-librejs
```

The plugin uses `enforce: "post"` so comment injection happens after minifiers
have already done their thing.

## Supported Licenses

Built-in license support includes:

| SPDX Identifier     | License Name                                           |
| ------------------- | ------------------------------------------------------ |
| `AGPL-3.0-only`     | GNU Affero General Public License version 3            |
| `AGPL-3.0-or-later` | GNU Affero General Public License version 3 or later   |
| `GPL-2.0-only`      | GNU General Public License version 2                   |
| `GPL-2.0-or-later`  | GNU General Public License version 2 or later          |
| `GPL-3.0-only`      | GNU General Public License version 3                   |
| `GPL-3.0-or-later`  | GNU General Public License version 3 or later          |
| `LGPL-2.1-only`     | GNU Lesser General Public License version 2.1          |
| `LGPL-2.1-or-later` | GNU Lesser General Public License version 2.1 or later |
| `LGPL-3.0-only`     | GNU Lesser General Public License version 3            |
| `LGPL-3.0-or-later` | GNU Lesser General Public License version 3 or later   |
| `MIT`               | Expat (MIT) License                                    |
| `Apache-2.0`        | Apache License 2.0                                     |
| `Artistic-2.0`      | Artistic License 2.0                                   |
| `BSD-3-Clause`      | BSD 3-Clause License                                   |
| `ISC`               | ISC License                                            |
| `MPL-2.0`           | Mozilla Public License 2.0                             |
| `CC0-1.0`           | Creative Commons Zero v1.0 Universal                   |

Deprecated bare identifiers are also accepted for compatibility with older
`package.json` files:

- `AGPL-3.0`
- `GPL-2.0`
- `GPL-3.0`
- `LGPL-2.1`
- `LGPL-3.0`

Canonical magnet links are sourced from:
https://www.gnu.org/software/librejs/manual/html_node/Free-Licenses-Detection.html

If you need a license that is not listed here, supply a custom `magnet`. The
plugin does not try to be a universal SPDX resolver because that would be
pretentious and wrong.

## Vite Compatibility

Supported:

- Vite 6.x
- Vite 7.x
- Vite 8.x

Vite 7 and 8 moved more of their bundler surface toward Rolldown. This plugin
imports `OutputBundle`, `OutputChunk`, `OutputAsset` and
`NormalizedOutputOptions` through vite's re-exported `Rollup` type namespace, so
it only depends on `vite` — rolldown is a transitive dependency of vite itself.

That import is type-level only. It is not there for decoration.

## Programmatic API

Everything is exported from `mod.ts`:

```ts
export { librejsPlugin } from "./plugin.ts";
export type { ChunkLicense, LibreJSOptions } from "./plugin.ts";
export { getLicense, LICENSES } from "./licenses.ts";
export type { LicenseInfo, LicenseMap } from "./licenses.ts";
export { generateWeblabelsHtml } from "./weblabels.ts";
export type { WeblabelEntry } from "./weblabels.ts";
```

### `librejsPlugin`

Creates the Vite plugin.

```ts
import { librejsPlugin } from "jsr:@urutau-ltd/vite-plugin-librejs";
```

### `LICENSES`

Immutable map of built-in SPDX identifiers to LibreJS metadata.

```ts
import { LICENSES } from "jsr:@urutau-ltd/vite-plugin-librejs";

console.log(LICENSES["MIT"]);
```

### `getLicense`

Looks up one built-in license by SPDX identifier.

```ts
import { getLicense } from "jsr:@urutau-ltd/vite-plugin-librejs";

const info = getLicense("MIT");
// -> { magnet, label, url }
```

Returns `undefined` for licenses not present in the built-in map.

### `generateWeblabelsHtml`

Generates a complete standalone web labels document.

```ts
import { generateWeblabelsHtml } from "jsr:@urutau-ltd/vite-plugin-librejs";

const html = generateWeblabelsHtml([
    {
        scriptPath: "/assets/app.js",
        scriptName: "app.js",
        licenseLabel: "GNU General Public License version 3 or later",
        licenseUrl: "https://www.gnu.org/licenses/gpl-3.0.html",
        sourcePath: "https://example.com/src/app.js",
    },
]);
```

This is useful if you need custom build scripts outside Vite.

## FAQ

### Why both inline comments and web labels?

Because LibreJS supports both, and sites in the real world are messy. Inline
comments are direct and nice. Web labels are a fallback and a discovery
mechanism. Doing both is the most reliable option.

### Does this work in dev mode?

This plugin is meant for build output. The interesting behavior happens during
`vite build`.

### Do I need `sourceBase`?

Not always.

- For permissive licenses, maybe not.
- For copyleft licenses, you probably do want source links.
- For complex setups, use per-chunk `source` instead of `sourceBase`.

### Why are generated source URLs based on `chunk.name` instead of hashed output files?

Because the point of `@source` is to point to corresponding source code, not to
the built artifact. Using `chunk.name` is the simplest stable default.

If that mapping is wrong for your project, override it with `chunks[].source`.

### Why does an unknown per-chunk license throw now?

Because silently inheriting the global magnet for a different license is wrong.
Wrong compliance metadata is worse than a failing build.

### Why are the injected links relative instead of absolute?

Because nested output directories exist, and absolute-root assumptions break
there. Relative links are the correct default for emitted static artifacts.

## Troubleshooting

### Build fails with:

```txt
[vite-plugin-librejs] License "X" is not in the built-in map.
Supply a "magnet" URI in the plugin options.
```

Your global `license` is unknown to the built-in map. Provide `magnet`.

### Build fails with:

```txt
[vite-plugin-librejs] Chunk "..." declares unsupported license "X".
Supply "chunks....magnet" ...
```

One chunk override uses an SPDX identifier the plugin does not know. Add a
matching `magnet` for that specific chunk.

### The generated source URLs are wrong

You are probably relying on `sourceBase` but your output naming does not map
cleanly to `chunk.name`. Use explicit `chunks[].source` values.

### LibreJS still does not detect the page

Check:

- that `injectLicenseLink` is enabled, or that you manually added
  `rel="jslicense"`
- that `weblabels` is enabled
- that the generated path actually matches your deployed output
- that another transform or proxy is not rewriting the HTML

### My HTML pages are nested and links look different than before

That is intentional. The plugin now emits relative links so the generated files
work when pages are not served from root.

## Testing and Release Notes

This repository now has tests for:

- inline comment injection
- chunk-name overrides
- unsupported per-chunk license failures
- relative web labels links
- relative HTML link injection

The package metadata is set for `1.0.0`, and the repo includes Deno tasks for:

- `deno task check`
- `deno task fmt`
- `deno task lint`
- `deno task test`

## License

This project is under the terms of the GNU Affero General Public License version
3 or later (`AGPL-3.0-or-later`).
