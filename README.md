# nxtlines.github.io

The pages behind Janus: its privacy policy, terms and support, at /janus/. Plain HTML and one
stylesheet — no script, no analytics, no cookies, nothing loaded from anywhere but here (each
page's Content-Security-Policy holds the browser to it). Fraunces is kept here too, under its
license (fonts/OFL.txt).

- The words live in content/ — the policy and terms exactly as written.
- `node tools/build.mjs` makes the pages from them; `node tools/check.mjs` proves the policy and
  terms are word for word, and that nothing comes from another site.
