import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>fresh-scaffold</title>
      </head>
      <body>
        <Component />
        <a
          href="/about/javascript.html"
          rel="jslicense"
          style="font-size: 0.8em; opacity: 0.7"
        >
          JavaScript license information
        </a>
      </body>
    </html>
  );
});
