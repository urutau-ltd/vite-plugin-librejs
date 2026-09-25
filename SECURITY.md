# Security Policy

## Supported Versions

Security fixes are applied to the latest release on the `main` branch and to any
previous release still receiving maintenance. Versions that have reached end of
life or are otherwise no longer maintained are not eligible for fixes.

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Please do **not** open a public issue for a suspected security vulnerability.

Report vulnerabilities through one of the following private channels:

- **GitHub Security Advisories**: use the "Report a vulnerability" button on the
  repository's Security tab.
- **Email**: contact the maintainers directly. Reach out to the repository owner
  through the contact information listed on their GitHub profile before sending
  any sensitive details.

When reporting, include as much of the following as possible:

1. The affected version(s).
2. A description of the vulnerability, including the potential impact.
3. Steps to reproduce or a minimal proof of concept.
4. Any suggested fix, if available.

### Disclosure process

1. You will receive an acknowledgement of your report within 72 hours.
2. The maintainer will triage the report and determine severity and impact.
3. A fix will be prepared and, where appropriate, a new release will be
   published.
4. The vulnerability is disclosed publicly (e.g. via a security advisory) after
   a fix is available or after a reasonable disclosure window.

We follow responsible disclosure and ask that you refrain from publishing
details of a vulnerability until a fix has been released.

## Scope

The following are in scope:

- The plugin source code under [`mod.ts`](./mod.ts), [`plugin.ts`](./plugin.ts),
  [`licenses.ts`](./licenses.ts), [`weblabels.ts`](./weblabels.ts), and their
  tests.
- The published package
  [`@urutau-ltd/vite-plugin-librejs`](https://jsr.io/@urutau-ltd/vite-plugin-librejs).
- Documented public API behaviour.

The following are out of scope:

- Issues in upstream dependencies (`vite`, `rolldown`, `@std/*`) — report these
  to the respective projects.
- Security issues in the consumer's own build configuration or rendered output.
- Bugs that require the attacker to already have write access to the source
  repository or to the built site's content.

## Security Considerations

- The web labels page escapes all user-controlled strings before inserting them
  into the generated HTML to prevent markup injection.
- The `magnet` URIs and `source` URLs you supply through the plugin options are
  injected verbatim; only provide values you trust.
- The plugin performs no network access, file system access, or execution of
  untrusted code at runtime.

## Security-Related CI and Tooling

- All pull requests and pushes to `main` run formatting checks, type checking,
  linting, and the unit test suite via the
  [`ci.yml`](./.github/workflows/ci.yml) workflow.
- Dependency updates are managed with Dependabot for the Deno and GitHub Actions
  ecosystems.
- Dependencies are resolved from pinned, locked versions tracked in
  [`deno.lock`](./deno.lock).
- Test runs use the minimal permission set defined in
  [`deno.json`](./deno.json); npm lifecycle scripts are denied.

## Acknowledgments

We appreciate security researchers who follow responsible disclosure. With your
permission, we are happy to acknowledge your contribution in the release notes
or advisory for any confirmed vulnerability you report.
