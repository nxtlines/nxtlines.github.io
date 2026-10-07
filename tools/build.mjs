// Builds the site from content/: the Janus privacy policy, terms and support pages from their
// Markdown — the policy and terms word for word, exactly as written — and the small pages around
// them (the root, Janus's own, and the page for an address that isn't there). Plain HTML and one stylesheet: no script, nothing from
// another site (each page's Content-Security-Policy lets the browser load only this site's own
// files). Run after changing anything in content/: node tools/build.mjs — then node
// tools/check.mjs.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const SUPPORT_EMAIL = 'nxtlines.support@gmail.com';

// The Janus mark, at rest — the app's own outline (lib/janus/glyph-morph.ts at the end of its
// morph), in its 1000 box.
const MARK_PATH =
  'M70 521.8C97.6 581.3 125.3 640.9 152.9 700.4C205.9 814.6 306.1 886.5 415.6 886.5C525.1 886.5 628.8 816.1 678.4 700.4C762.3 504.8 846.1 309.1 930 113.5C839.2 121.4 748.5 129.3 657.7 137.3C585.2 306.5 512.6 475.8 440.1 645C435.6 655.5 427.3 663.8 416.8 668.2C406.4 672.6 394.6 672.7 384.1 668.6C373.5 664.6 364.9 656.5 360.1 646.2C337.8 598.2 315.6 550.3 293.3 502.3C218.9 508.8 144.4 515.3 70 521.8Z';
const mark = (className) => `<svg class="${className}" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false"><path d="${MARK_PATH}"/></svg>`;

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// The support address, wherever it's written, is a link to write to it — its words unchanged.
const linkEmail = (html) => html.replaceAll(SUPPORT_EMAIL, `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`);

// The Markdown these pages use, and only it: # to ### headings, "- " lists, and paragraphs, whose
// own line breaks are kept (the contact lines). Anything else is a paragraph, as written.
function markdownToHtml(markdown) {
  const blocks = markdown.trim().split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      const heading = block.match(/^(#{1,3}) (.*)$/);
      if (heading && lines.length === 1) {
        const level = heading[1].length;
        return `<h${level}>${escape(heading[2])}</h${level}>`;
      }
      if (lines.every((line) => line.startsWith('- '))) {
        return `<ul>\n${lines.map((line) => `  <li>${linkEmail(escape(line.slice(2)))}</li>`).join('\n')}\n</ul>`;
      }
      const html = linkEmail(lines.map(escape).join('<br>\n'));
      return /^Effective: /.test(block) ? `<p class="effective">${html}</p>` : `<p>${html}</p>`;
    })
    .join('\n');
}

// Nothing from anywhere but this site, and no script at all; no referrer sent on leaving it.
const HEAD_SECURITY = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="no-referrer">`;

function page({ title, description, body, className = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  ${HEAD_SECURITY}
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#FDFCF7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1F1E22" media="(prefers-color-scheme: dark)">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="/style.css">
</head>
<body${className ? ` class="${className}"` : ''}>
${body}
</body>
</html>
`;
}

const JANUS_PAGES = [
  { href: '/janus/privacy/', label: 'Privacy Policy' },
  { href: '/janus/terms/', label: 'Terms of Use' },
  { href: '/janus/support/', label: 'Support' },
];
const janusLinks = (current) =>
  JANUS_PAGES.map(({ href, label }) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('\n    ');

// The top of a Janus page: the full logo, as the app has it — the mark, and JANUS beside it in the
// serif, the mark as tall as the name and a quarter of it apart — back to Janus's own page.
const JANUS_TOP = `<header class="top">
  <a class="home" href="/janus/" aria-label="Janus">${mark('mark')}<span aria-hidden="true">JANUS</span></a>
</header>`;

// A Janus page with words to read: the logo at the top; the three pages at the foot, the one you're
// on not a link to follow.
function janusDocument({ title, description, contentFile, href }) {
  return page({
    title,
    description,
    body: `${JANUS_TOP}
<main class="document">
${markdownToHtml(read(contentFile))}
</main>
<footer class="foot">
  <nav aria-label="Janus">
    ${janusLinks(href)}
  </nav>
  <p>Made by (nxt)lines</p>
</footer>`,
  });
}

function write(file, html) {
  mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  writeFileSync(path.join(ROOT, file), html);
  console.log(`wrote ${file}`);
}

write(
  'index.html',
  page({
    title: '(nxt)lines',
    description: '(nxt)lines makes Janus.',
    className: 'center',
    body: `<main class="studio">
  <h1>(nxt)lines</h1>
  <p><a href="/janus/">Janus</a></p>
</main>`,
  })
);

// For an address that isn't there — GitHub Pages serves it in place of its own, which loads from
// GitHub. Janus's logo at the top, as on its pages; its links are from the root, so they hold at
// any depth.
write(
  '404.html',
  page({
    title: 'Page not found',
    description: 'This page isn\'t here.',
    className: 'center',
    body: `${JANUS_TOP}
<main class="studio">
  <h1>Page not found</h1>
  <p><a href="/">Home</a></p>
</main>`,
  })
);

write(
  'janus/index.html',
  page({
    title: 'Janus',
    description: 'Janus — your habits, honestly.',
    className: 'center',
    body: `<main class="janus">
  <h1 class="wordmark">${mark('mark')}<span>JANUS</span></h1>
  <p class="tagline">Your habits, honestly.</p>
  <nav aria-label="Janus">
    ${janusLinks(null)}
  </nav>
</main>
<footer class="foot">
  <p>Made by (nxt)lines</p>
</footer>`,
  })
);

write('janus/privacy/index.html', janusDocument({ title: 'Janus Privacy Policy', description: 'How Janus handles your information: it stays on your device.', contentFile: 'content/privacy.md', href: '/janus/privacy/' }));
write('janus/terms/index.html', janusDocument({ title: 'Janus Terms of Use', description: 'The terms for using Janus.', contentFile: 'content/terms.md', href: '/janus/terms/' }));
write('janus/support/index.html', janusDocument({ title: 'Janus Support', description: 'Questions, bugs, or ideas about Janus? Let us know.', contentFile: 'content/support.md', href: '/janus/support/' }));

// The favicon: the mark in ink blue, lighter on a dark tab.
write(
  'favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><style>path{fill:#1F5F95}@media (prefers-color-scheme:dark){path{fill:#4F86B8}}</style><path d="${MARK_PATH}"/></svg>\n`
);
