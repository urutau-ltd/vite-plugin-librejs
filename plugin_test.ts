// SPDX-License-Identifier: AGPL-3.0-or-later
import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { librejsPlugin } from "./plugin.ts";

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

// Helper: run generateBundle and return mutated chunk codes.
const runGenerateBundle = (
    plugin: ReturnType<typeof librejsPlugin>,
    bundle: Record<string, { type: string; name?: string; code?: string }>,
): Record<string, string> => {
    const generateBundle = asHook(
        plugin.generateBundle,
    ) as unknown as GenerateBundleHook;

    generateBundle.call(
        { emitFile: () => "" },
        {},
        bundle,
        true,
    );

    return Object.fromEntries(
        Object.entries(bundle)
            .filter(([, v]) => v.type === "chunk")
            .map(([k, v]) => [k, v.code ?? ""]),
    );
};

Deno.test("generateBundle injects LibreJS comments for JS-family chunks", () => {
    const plugin = librejsPlugin({
        license: "MIT",
        sourceBase: "https://example.com/source/",
    });

    const result = runGenerateBundle(plugin, {
        "assets/app.mjs": {
            type: "chunk",
            name: "app",
            code: "console.log('ok');",
        },
    });

    const code = result["assets/app.mjs"] ?? "";
    assertStringIncludes(code, "// @license ");
    assertStringIncludes(code, " MIT");
    assertStringIncludes(
        code,
        "// @source https://example.com/source/app.js",
    );
    assertStringIncludes(code, "// @license-end");
});

Deno.test("generateBundle skips non-JS assets", () => {
    const plugin = librejsPlugin({ license: "MIT" });

    const bundle: Record<
        string,
        { type: string; name?: string; code?: string }
    > = {
        "assets/style.css": { type: "asset" },
        "assets/app.js": { type: "chunk", name: "app", code: "var x=1;" },
    };

    runGenerateBundle(plugin, bundle);

    // CSS asset is untouched (no code property to begin with)
    assertEquals(
        (bundle["assets/style.css"] as { code?: string }).code,
        undefined,
    );
    assertStringIncludes(bundle["assets/app.js"].code ?? "", "// @license");
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

    const result = runGenerateBundle(plugin, {
        "assets/vendor-123.js": {
            type: "chunk",
            name: "vendor",
            code: "console.log('vendor');",
        },
    });

    assertStringIncludes(result["assets/vendor-123.js"] ?? "", "Apache-2.0");
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
    const generateBundle = asHook(
        plugin.generateBundle,
    ) as unknown as GenerateBundleHook;

    assertThrows(
        () =>
            generateBundle.call(
                { emitFile: () => "" },
                {},
                {
                    "assets/app.js": {
                        type: "chunk",
                        name: "app",
                        code: "console.log('app');",
                    },
                },
                true,
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
                code: "",
            },
            "assets/a-first.js": {
                type: "chunk",
                fileName: "assets/a-first.js",
                name: "a-first",
                code: "",
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

Deno.test("inlineComments: false skips comment injection", () => {
    const plugin = librejsPlugin({ license: "MIT", inlineComments: false });

    const result = runGenerateBundle(plugin, {
        "assets/app.js": { type: "chunk", name: "app", code: "var x=1;" },
    });

    assertEquals(result["assets/app.js"], "var x=1;");
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
