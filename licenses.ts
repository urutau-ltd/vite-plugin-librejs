// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @module licenses
 *
 * LibreJS-recognised free software licenses.
 *
 * LibreJS identifies a license by the SHA-1 info-hash embedded in the
 * magnet URI — **not** by the human-readable SPDX string. Every entry in
 * {@link LICENSES} uses the canonical magnet link published in the
 * LibreJS documentation:
 * https://www.gnu.org/software/librejs/manual/html_node/Free-Licenses-Detection.html
 *
 * If you need a license that is not listed here, supply a `magnet` value
 * in the plugin options and LibreJS will accept it regardless.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** All metadata LibreJS and the weblabels table need for one license. */
export interface LicenseInfo {
    /** Canonical magnet URI — the SHA-1 hash is what LibreJS validates. */
    readonly magnet: string;
    /** Full human-readable name shown in the weblabels table. */
    readonly label: string;
    /** Canonical URL to the license text (used as `href` in the table). */
    readonly url: string;
}

/** Immutable map of SPDX identifier → {@link LicenseInfo}. */
export type LicenseMap = Readonly<Record<string, LicenseInfo>>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const entry = (
    magnet: string,
    label: string,
    url: string,
): LicenseInfo => Object.freeze({ magnet, label, url });

// ── License definitions ───────────────────────────────────────────────────────

const _AGPL3_INFO = entry(
    "magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt",
    "GNU Affero General Public License version 3",
    "https://www.gnu.org/licenses/agpl-3.0.html",
);

const _GPL2_INFO = entry(
    "magnet:?xt=urn:btih:cf1bbf4efb0b3c6a61e4c7e0a5f4e7e2f9a7a09d&dn=gpl-2.0.txt",
    "GNU General Public License version 2",
    "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html",
);

const _GPL3_INFO = entry(
    "magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt",
    "GNU General Public License version 3",
    "https://www.gnu.org/licenses/gpl-3.0.html",
);

const _LGPL21_INFO = entry(
    "magnet:?xt=urn:btih:5de60da917303dbfad4f93fb1b985ced5a89eac2&dn=lgpl-2.1.txt",
    "GNU Lesser General Public License version 2.1",
    "https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html",
);

const _LGPL3_INFO = entry(
    "magnet:?xt=urn:btih:0ef1b8170b3b615170ff270def6427a6c2741f86&dn=lgpl-3.0.txt",
    "GNU Lesser General Public License version 3",
    "https://www.gnu.org/licenses/lgpl-3.0.html",
);

/**
 * Map of SPDX identifiers to LibreJS license metadata.
 *
 * Includes both the modern `-only`/`-or-later` variants and the
 * deprecated bare identifiers still widely used in `package.json` files.
 *
 * Frozen at module load — treat as a compile-time constant.
 */
export const LICENSES: LicenseMap = Object.freeze(
    {
        // ── AGPL ──────────────────────────────────────────────────────────────────
        "AGPL-3.0-only": _AGPL3_INFO,
        "AGPL-3.0-or-later": Object.freeze({
            ..._AGPL3_INFO,
            label: "GNU Affero General Public License version 3 or later",
        }),
        /** @deprecated Use `AGPL-3.0-or-later`. */
        "AGPL-3.0": Object.freeze({
            ..._AGPL3_INFO,
            label: "GNU Affero General Public License version 3 or later",
        }),

        // ── GPL ───────────────────────────────────────────────────────────────────
        "GPL-2.0-only": _GPL2_INFO,
        "GPL-2.0-or-later": Object.freeze({
            ..._GPL2_INFO,
            label: "GNU General Public License version 2 or later",
        }),
        /** @deprecated Use `GPL-2.0-or-later`. */
        "GPL-2.0": Object.freeze({
            ..._GPL2_INFO,
            label: "GNU General Public License version 2 or later",
        }),

        "GPL-3.0-only": _GPL3_INFO,
        "GPL-3.0-or-later": Object.freeze({
            ..._GPL3_INFO,
            label: "GNU General Public License version 3 or later",
        }),
        /** @deprecated Use `GPL-3.0-or-later`. */
        "GPL-3.0": Object.freeze({
            ..._GPL3_INFO,
            label: "GNU General Public License version 3 or later",
        }),

        // ── LGPL ──────────────────────────────────────────────────────────────────
        "LGPL-2.1-only": _LGPL21_INFO,
        "LGPL-2.1-or-later": Object.freeze({
            ..._LGPL21_INFO,
            label: "GNU Lesser General Public License version 2.1 or later",
        }),
        /** @deprecated Use `LGPL-2.1-or-later`. */
        "LGPL-2.1": Object.freeze({
            ..._LGPL21_INFO,
            label: "GNU Lesser General Public License version 2.1 or later",
        }),

        "LGPL-3.0-only": _LGPL3_INFO,
        "LGPL-3.0-or-later": Object.freeze({
            ..._LGPL3_INFO,
            label: "GNU Lesser General Public License version 3 or later",
        }),
        /** @deprecated Use `LGPL-3.0-or-later`. */
        "LGPL-3.0": Object.freeze({
            ..._LGPL3_INFO,
            label: "GNU Lesser General Public License version 3 or later",
        }),

        // ── Permissive ────────────────────────────────────────────────────────────
        "MIT": entry(
            "magnet:?xt=urn:btih:d3d9a9a6595521f9666a5e94cc830dab83b65699&dn=expat.txt",
            "Expat (MIT) License",
            "https://directory.fsf.org/wiki/License:Expat",
        ),
        "Apache-2.0": entry(
            "magnet:?xt=urn:btih:8e4f440f4c65981c5bf93c76d35135ba5064d8b7&dn=apache-2.0.txt",
            "Apache License 2.0",
            "https://www.apache.org/licenses/LICENSE-2.0",
        ),
        "Artistic-2.0": entry(
            "magnet:?xt=urn:btih:54fd2283f9dbdf29466d2df1a98bf8f65cafe314&dn=artistic-2.0.txt",
            "Artistic License 2.0",
            "https://www.perlfoundation.org/artistic_license_2_0",
        ),
        "BSD-3-Clause": entry(
            "magnet:?xt=urn:btih:c80d50af7d3db9be66a4d0a86db0286e4fd33292&dn=bsd-3-clause.txt",
            "BSD 3-Clause License",
            "https://opensource.org/license/bsd-3-clause",
        ),
        "ISC": entry(
            "magnet:?xt=urn:btih:b8999bbaf509c08d127678643c515b9ab0836bae&dn=ISC.txt",
            "ISC License",
            "https://opensource.org/license/isc",
        ),
        "MPL-2.0": entry(
            "magnet:?xt=urn:btih:3877d6d54b3accd4bc32f8a48bf32ebc0901502a&dn=mpl-2.0.txt",
            "Mozilla Public License 2.0",
            "https://www.mozilla.org/en-US/MPL/2.0/",
        ),
        "CC0-1.0": entry(
            "magnet:?xt=urn:btih:90dc5c0be029de84e523b9b3922520e79e0e6f08&dn=cc0.txt",
            "Creative Commons Zero v1.0 Universal",
            "https://creativecommons.org/publicdomain/zero/1.0/",
        ),
    } satisfies LicenseMap,
);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up license metadata by SPDX identifier.
 *
 * Returns `undefined` for licenses not in the built-in map — callers must
 * then supply a custom `magnet` URI.
 */
export const getLicense = (spdxId: string): LicenseInfo | undefined =>
    LICENSES[spdxId];
