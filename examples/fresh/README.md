# Fresh example

A stock [Fresh 2](https://usefresh.dev/) project (scaffolded with
`deno run -Ar jsr:@fresh/init`, Fresh and Preact are MIT-licensed) wired up with
`vite-plugin-librejs`.

Fresh 2 builds with Vite through
[`@fresh/plugin-vite`](https://jsr.io/@fresh/plugin-vite), so the plugin slots
in next to it in `vite.config.ts`. This example uses the plugin's
`license:
"MIT"` and imports the plugin directly from the repository source
(`../../mod.ts`) instead of the published JSR package.

## What the plugin does here

- wraps every emitted client JS chunk with LibreJS `@license` / `@license-end`
  comments during `vite build`
- emits the `jslicense-labels1` web labels page as a build asset

One thing does not carry over from plain Vite: Fresh renders HTML at request
time on the server, so the plugin's HTML hook never fires during the build and
`injectLicenseLink` is disabled in `vite.config.ts`. The `rel="jslicense"` link
is added by hand in `routes/_app.tsx` instead, which is the only place Fresh
lets you touch the page shell.

## Running it

```sh
deno install
deno task dev        # dev server with HMR
deno task build      # production build into _fresh/
deno task start      # serve the production build
```

After `deno task build`, check the built client JS in `_fresh/` for the
`@license` comments, and the `about/javascript.html` asset for the web labels
table.
