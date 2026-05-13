// SPDX-License-Identifier: AGPL-3.0-or-later
import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { librejsPlugin } from "./plugin.ts";

type RenderChunkHook = (
    this: unknown,
    code: string,
    chunk: { fileName: string; name: string },
    outputOptions: unknown,
    meta: unknown,
) => { code: string } | null;

type GenerateBundleHook = (
    this: { emitFile: (file: { fileName: string; source: string }) => string },
    outputOptions: unknown,
    bundle: Record<string, unknown>,
    isWrite: boolean,
) => void;

type TransformIndexHtmlHook = (
    this: unknown,
    html: string,
    context: { path: string },
) => Array<{ attrs?: Record<string, string> }>;

const asHook = <T>(hook: T | { handler: T } | undefined): T => {
    if (typeof hook === "function") {
        return hook as T;
    }

    const hookRecord = hook as { handler?: T } | null | undefined;
    if (typeof hookRecord?.handler === "function") {
        return hookRecord.handler;
    }

    throw new Error("Expected plugin hook to be defined.");
};

Deno.test("renderChunk injects LibreJS comments for JS-family chunks", () => {
    const plugin = librejsPlugin({
        license: "MIT",
        sourceBase: "https://example.com/source/",
    });
    const renderChunk = asHook(plugin.renderChunk) as RenderChunkHook;

    const result = renderChunk.call(
        {},
        "console.log('ok');",
        {
            fileName: "assets/app.mjs",
            name: "app",
        },
        {},
        {},
    );

    assertStringIncludes(result?.code ?? "", "// @license ");
    assertStringIncludes(result?.code ?? "", " MIT");
    assertStringIncludes(
        result?.code ?? "",
        "// @source https://example.com/source/app.js",
    );
    assertStringIncludes(result?.code ?? "", "// @license-end");
});

Deno.test("chunk overrides can be keyed by logical chunk name", () => {
    const plugin = librejsPlugin({
        license: "MIT",
        chunks: {
            vendor: {
                license: "Apache-2.0",
            },
        },
    });
    const renderChunk = asHook(plugin.renderChunk) as RenderChunkHook;

    const result = renderChunk.call(
        {},
        "console.log('vendor');",
        {
            fileName: "assets/vendor-123.js",
            name: "vendor",
        },
        {},
        {},
    );

    assertStringIncludes(result?.code ?? "", "Apache-2.0");
});

Deno.test("unsupported per-chunk licenses require an explicit magnet", () => {
    const plugin = librejsPlugin({
        license: "MIT",
        chunks: {
            app: {
                license: "EUPL-1.2",
            },
        },
    });
    const renderChunk = asHook(plugin.renderChunk) as RenderChunkHook;

    assertThrows(
        () =>
            renderChunk.call(
                {},
                "console.log('app');",
                {
                    fileName: "assets/app.js",
                    name: "app",
                },
                {},
                {},
            ),
        Error,
        'Chunk "assets/app.js" declares unsupported license "EUPL-1.2"',
    );
});

Deno.test("generateBundle emits sorted relative script links for weblabels", () => {
    const plugin = librejsPlugin({
        license: "AGPL-3.0-or-later",
        weblabelsPath: "about/javascript.html",
    });
    const emitted: Array<{ fileName: string; source: string }> = [];
    const generateBundle = asHook(
        plugin.generateBundle,
    ) as unknown as GenerateBundleHook;

    generateBundle.call(
        {
            emitFile(file: { fileName: string; source: string }) {
                emitted.push(file);
                return "weblabels";
            },
        },
        {},
        {
            "assets/z-last.js": {
                type: "chunk",
                fileName: "assets/z-last.js",
                name: "z-last",
            },
            "assets/a-first.js": {
                type: "chunk",
                fileName: "assets/a-first.js",
                name: "a-first",
            },
            "assets/ignored.css": {
                type: "asset",
                fileName: "assets/ignored.css",
                source: "",
            },
        },
        true,
    );

    assertEquals(emitted.length, 1);
    assertEquals(emitted[0]?.fileName, "about/javascript.html");
    const html = emitted[0]?.source ?? "";
    assertStringIncludes(html, "../assets/a-first.js");
    assertStringIncludes(html, "../assets/z-last.js");
    assertEquals(
        html.indexOf("../assets/a-first.js") <
            html.indexOf("../assets/z-last.js"),
        true,
    );
});

Deno.test("transformIndexHtml injects a relative link to the weblabels page", () => {
    const plugin = librejsPlugin({
        license: "MIT",
        weblabelsPath: "about/javascript.html",
    });
    const transformIndexHtml = asHook(
        plugin.transformIndexHtml,
    ) as unknown as TransformIndexHtmlHook;

    const tags = transformIndexHtml.call(
        {},
        "<html></html>",
        {
            path: "nested/index.html",
            filename: "/virtual/dist/nested/index.html",
        },
    );

    assertEquals(tags[0]?.attrs?.href, "../about/javascript.html");
    assertEquals(tags[0]?.attrs?.rel, "jslicense");
});
