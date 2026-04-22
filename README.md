# vite-plugin-librejs

`vite` pluginfor [GNU LibreJS](https://www.gnu.org/software/librejs/)
compliance.

Written in TypeScript, Deno and distributed on JSR.

## What does it do?

GNU LibreJS blocks JavaScript that does not carry a recognised free-software
license notice. This plugin automates all three compliance methods LibreJS
supports, applied automatically during `vite build`.

## How it works

### Inline Comments

Wraps every emitted `.js` chunk with the machine-readable comment pair that
LibreJS checks:

```javascript
// @license magnet:?xt=urn:btih:…&dn=agpl-3.0.txt AGPL-3.0-or-later
// @source https://example.com/src/main.js
(() => {/* minified code */})();
// @license-end
```

The hook runs **after** `esbuild`/`terser` minification, so the comment survives
without being stripped, something heretical for the JS devs, which makes it even
cooler. The `@source` line is injected automatically when `sourceBase` is set,
satisfying the copyleft requirement to provide access to source code.

### Web Labels Page

This temits an HTML asset at `weblabelsPath` (by default
`about/javascript.html`) containing the `jslicense-labels1` table:

```html
<table id="jslicense-labels1">
    <tr>
        <td><a href="/assets/main-A1b2.js">main-A1b2.js</a></td>
        <td>
            <a href="https://www.gnu.org/licenses/agpl-3.0.html">
                GNU Affero General Public License version 3 or later</a>
        </td>
        <td><a href="https://example.com/src/main.js">main.js</a></td>
    </tr>
</table>
```

LibreJS falls back to this table when a script has no inline comment (e.g,
third-party scripts served from a CDN you do not control).

### License link injection

Appewnds to the `<body>` of every HTML page:

```html
<a
    href="/about/javascript.html"
    rel="jslicense"
    style="font-size: 0.8em; opacity: 0.7"
>
    JavaScript license information
</a>
```

The `rel="jslicense"` attribute is how LibreJS discovers the web labels page for
a given site.

## Installation

```typescript
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

## Options

```typescript
interface LibreJSOptions {
    /**
     * Default SPDX identifier applied to every JS chunk. Required.
     * Must be a key in the built-in license map, or supply `magnet` as well.
     */
    license: string;

    /**
     * Custom LibreJS magnet URI for the default license.
     * Required when `license` is not in the built-in map.
     */
    magnet?: string;

    /**
     * Base URL for automatic @source links: `${sourceBase}/${chunk.name}.js`
     * @example "https://example.com/src/"
     */
    sourceBase?: string;

    /**
     * Output path of the web labels HTML page (relative to outDir).
     * @default "about/javascript.html"
     */
    weblabelsPath?: string;

    /** Inject @license … @license-end comments into JS chunks. @default true */
    inlineComments?: boolean;

    /** Emit the jslicense-labels1 HTML asset. @default true */
    weblabels?: boolean;

    /** Inject <a rel="jslicense"> into HTML pages. @default true */
    injectLicenseLink?: boolean;

    /** Link text and page title for the web labels page.
     *  @default "JavaScript license information" */
    licensePageTitle?: string;

    /**
     * Per-chunk overrides keyed by Vite's chunk.fileName,
     * e.g. "assets/vendor-Bca12345.js".
     */
    chunks?: Record<string, {
        license?: string;
        magnet?: string;
        source?: string;
    }>;
}
```

### Per-chunk overriding

Use `chunks` when different parts of your bundle have different licenses, for
example, when vendored dependencies carry a permissive license while your own
code is AGPL:

```typescript
librejsPlugin({
    license: "AGPL-3.0-or-later",
    sourceBase: "https://example.com/src/",
    chunks: {
        "assets/vendor-Bca12345.js": {
            license: "MIT",
            source: "https://registry.npmjs.org/some-dep/-/some-dep-1.0.0.tgz",
        },
    },
});
```

### License not in the build-in map

```typescript
librejsPlugin({
    license: "EUPL-1.2",
    magnet:
        "magnet:?xt=urn:btih:e4ae48d8b484fce88a6cf1d33d4a4bfcbc1fdcf1&dn=eupl-1.2.txt",
});
```

The magnet URI is a BitTorrent info-hash of the license text file.

### Supported licenses

| SPDX Identifier                     | License Name                               |
| ----------------------------------- | ------------------------------------------ |
| `AGPL-3.0-only`/`AGPL-3.0-or-later` | GNU Affero GPL 3                           |
| `GPL-2.0-only`/`GPL-2.0-or-later`   | GNU GPL v2                                 |
| `GPL-3.0-only`/`GPL-3.0-or-later`   | GNU GPL v3                                 |
| `LGPL-2.1-only`/`LGPL-2.1-or-later` | GNU LGPL v2                                |
| `LGPL-3.0-only`/`LGPL-3.0-or-later` | GNU LGPL v3                                |
| `MIT`                               | Expat (MIT)                                |
| `Apache-2.0`                        | Apache License 2.0                         |
| `MPL-2.0`                           | Mozilla Public License 2.0                 |
| `BSD-3-Clause`                      | BSD 3 Clause License                       |
| `ISC`                               | ISC License                                |
| `Artistic-2.0`                      | Artistic License 2.0                       |
| `CC0-1.0`                           | Creative Commons Zero v1.0 (Public Domain) |

There are a few deprecated bare identifiers:

- `AGPL-3.0`
- `GPL-2.0`
- `GPL-3.0`
- `LGPL-2.1`
- `LGPL-3.0`

These are also accepted for compatiblity with older `package.json` files, should
you fall into that scenario.

Canonical magnet links sourced from:
https://www.gnu.org/software/librejs/manual/html_node/Free-Licenses-Detection.html

## Vite Compatiblity

| Vite version | Bundler backend | Notes                                                           |
| ------------ | --------------- | --------------------------------------------------------------- |
| 6.X          | Rollup          | Fully Supported                                                 |
| 7.x/8.x      | Rolldown        | Fully Supported - Hook types imported from `rolldown` directly. |

The plugin imports `OutputBundle`, `OutputChunk`, `RenderedChunk` and
`NormalizedOutputOptions` from `"rolldown"` rather than `"vite"` due to versions
7 ans 8 no longer exposing those types on their public API. Since `vite` 6 it
seems that `rolldown` was already a transitive dependency so, this shouldn't add
a new dependency to any supported `vite` version.

## Programmatic API

All internals are exposed for use outside Vite (e.g: If you need custom build
scripts):

```typescript
import {
    generateWeblabelsHtml,
    getLicense,
    LICENSES,
} from "jsr:@urutau-ltd/vite-plugin-librejs";

// Look up a license by SPDX ID
const info = getLicense("MIT");
// → { magnet: "magnet:?xt=...", label: "Expat (MIT) License", url: "..." }

// Generate a web labels page from a custom list
const html = generateWeblabelsHtml([
    {
        scriptPath: "/assets/app.js",
        scriptName: "app.js",
        licenseLabel: "GNU GPL v3 or later",
        licenseUrl: "https://www.gnu.org/licenses/gpl-3.0.html",
        sourcePath: "https://example.com/src/app.js",
    },
]);
```

## LICENSE

This project is under the terms of the GNU Affero General Public License version
3 or later (`AGPL-3.0-or-later`). See https://www.gnu.org/licenses/agpl-3.0.html
