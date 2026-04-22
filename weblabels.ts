// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @module weblabels
 *
 * Generator for the JavaScript License Web Labels page required by LibreJS.
 *
 * Spec: https://www.gnu.org/licenses/javascript-labels.en.html
 *
 * The emitted page contains a single `<table id="jslicense-labels1">` with
 * one row per JS file: script path, license, source path.
 * Every page that loads scripts must link to this page via
 * `<a rel="jslicense" href="…">`.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** One row in the `jslicense-labels1` table. */
export interface WeblabelEntry {
    /** Web-root-relative URL to the served script, e.g. `/assets/main-A1b2.js`. */
    readonly scriptPath: string;
    /** Display name shown as the link text for the script. */
    readonly scriptName: string;
    /** Full human-readable license name shown as the link text for the license. */
    readonly licenseLabel: string;
    /** URL to the full license text (the `href` of the license cell anchor). */
    readonly licenseUrl: string;
    /**
     * URL to the corresponding unminified source file or archive.
     * Required by copyleft licenses; omit for CC0 / public domain.
     * Spec allows `.js`, `.tar.gz`, or `.zip`.
     */
    readonly sourcePath?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape the five XML/HTML special characters. */
const esc = (s: string): string =>
    s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

const basename = (path: string): string => path.split("/").at(-1) ?? path;

const renderRow = (entry: WeblabelEntry): string => {
    const sourceCell = entry.sourcePath !== undefined
        ? `<td><a href="${esc(entry.sourcePath)}">${
            esc(basename(entry.sourcePath))
        }</a></td>`
        : `<td></td>`;

    return [
        `    <tr>`,
        `      <td><a href="${esc(entry.scriptPath)}">${
            esc(entry.scriptName)
        }</a></td>`,
        `      <td><a href="${esc(entry.licenseUrl)}">${
            esc(entry.licenseLabel)
        }</a></td>`,
        `      ${sourceCell}`,
        `    </tr>`,
    ].join("\n");
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate the full HTML document for the JavaScript License Web Labels page.
 *
 * @param entries - One entry per JS chunk served by the site.
 * @param pageTitle - `<title>` and `<h1>` of the generated page.
 *
 * @returns A complete, standalone HTML document string ready to write to disk.
 */
export const generateWeblabelsHtml = (
    entries: ReadonlyArray<WeblabelEntry>,
    pageTitle = "JavaScript License Information",
): string => {
    const rows = entries.map(renderRow).join("\n");

    return [
        `<!DOCTYPE html>`,
        `<html lang="en">`,
        `<head>`,
        `  <meta charset="UTF-8">`,
        `  <meta name="viewport" content="width=device-width, initial-scale=1.0">`,
        `  <title>${esc(pageTitle)}</title>`,
        `</head>`,
        `<body>`,
        `  <h1>${esc(pageTitle)}</h1>`,
        `  <p>`,
        `    The following table lists every JavaScript file served by this site,`,
        `    its license, and a link to its source code.`,
        `  </p>`,
        `  <table id="jslicense-labels1">`,
        `    <thead>`,
        `      <tr>`,
        `        <th>Script</th>`,
        `        <th>License</th>`,
        `        <th>Source</th>`,
        `      </tr>`,
        `    </thead>`,
        `    <tbody>`,
        rows,
        `    </tbody>`,
        `  </table>`,
        `</body>`,
        `</html>`,
        ``, // trailing newline
    ].join("\n");
};
