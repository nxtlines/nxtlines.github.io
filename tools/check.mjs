// Proves what the site promises, from its own files: node tools/check.mjs
//   1. The policy and terms are word for word — each page's text, read back out of its HTML, is
//      exactly its Markdown's text (and support's own lines are there as written).
//   2. Nothing is loaded from another site: no URL to anywhere else in any page, the stylesheet or
//      the favicon; every link, image, font and stylesheet is this site's own (or mailto:).
//   3. No script of any kind, no frames, no forms; every page carries the Content-Security-Policy
//      that lets the browser load nothing but this site's own files, and nothing as a script.
//   4. Every link inside the site leads to a file that's there.
//   5. Every text is at least 4.5:1 on its page, by day and at night (WCAG AA), measured from the
//      stylesheet's own colors.
// And lists every URL anywhere in the repository, with where it is.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const failures = [];
const fail = (message) => failures.push(message);

function listFiles(directory = '') {
  return readdirSync(path.join(ROOT, directory)).flatMap((name) => {
    if (name === '.git' || name === '.DS_Store') return [];
    const file = path.join(directory, name);
    return statSync(path.join(ROOT, file)).isDirectory() ? listFiles(file) : [file];
  });
}

const files = listFiles();
const pages = files.filter((file) => file.endsWith('.html'));
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

// 1. Word for word.
const unescape = (text) => text.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const words = (text) => text.split(/\s+/).filter(Boolean).join(' ');
const pageText = (file) => words(unescape(read(file).match(/<main[^>]*>([\s\S]*)<\/main>/)[1].replace(/<[^>]+>/g, ' ')));
const markdownText = (file) => words(read(file).replace(/^#{1,3} /gm, '').replace(/^- /gm, ''));
for (const [content, page] of [
  ['content/privacy.md', 'janus/privacy/index.html'],
  ['content/terms.md', 'janus/terms/index.html'],
  ['content/support.md', 'janus/support/index.html'],
]) {
  const expected = markdownText(content);
  const actual = pageText(page);
  if (expected !== actual) {
    const at = [...expected].findIndex((character, index) => character !== actual[index]);
    fail(`${page} isn't word for word with ${content}, from: "${expected.slice(at, at + 60)}" ≠ "${actual.slice(at, at + 60)}"`);
  } else {
    console.log(`✓ ${page}: word for word with ${content} (${expected.split(' ').length} words)`);
  }
}
// The policy and terms in effect from launch — no placeholder left.
for (const page of ['janus/privacy/index.html', 'janus/terms/index.html']) {
  if (!read(page).includes('<p class="effective">Effective: October 8, 2026</p>')) fail(`${page} lacks its effective date`);
}
if (pages.some((page) => read(page).includes('[launch date]'))) fail('a page still says [launch date]');
// The changes to the words since they were written, approved: the children's heading, and the
// studio's name as it's also written, in the definition of "nxtlines" in both.
if (!read('janus/privacy/index.html').includes("<h2>Children's privacy</h2>")) fail('the privacy policy lacks its heading "Children\'s privacy"');
for (const page of ['janus/privacy/index.html', 'janus/terms/index.html']) {
  if (!read(page).includes('&quot;nxtlines&quot; (also written &quot;(nxt)lines&quot;), &quot;we&quot; and &quot;us&quot; mean')) fail(`${page} lacks "(nxt)lines" in its definition of "nxtlines"`);
}
for (const line of ['Questions, bugs, or ideas? Let us know.', 'href="mailto:nxtlines.support@gmail.com"']) {
  if (!read('janus/support/index.html').includes(line)) fail(`the support page lacks ${line}`);
}

// 2 and 3. What the browser loads.
const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)]*/gi;
// The SVG namespace is a name, not an address: nothing is ever fetched from it.
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
for (const file of files.filter((file) => /\.(html|css|svg)$/.test(file))) {
  const text = read(file);
  const urls = (text.match(URL_PATTERN) ?? []).filter((url) => !(file.endsWith('.svg') && url === SVG_NAMESPACE));
  if (urls.length > 0) fail(`${file} has URLs to elsewhere: ${urls.join(', ')}`);
  const references = [...text.matchAll(/(?:href|src)="([^"]*)"|url\(['"]?([^'")]*)/g)].map((match) => match[1] ?? match[2]);
  for (const reference of references) {
    if (!reference.startsWith('/') && !reference.startsWith('mailto:') && !reference.startsWith('#')) fail(`${file} refers to ${reference}`);
    if (reference.startsWith('//')) fail(`${file} refers to another site: ${reference}`);
  }
  if (/<script|\son[a-z]+=|@import|<iframe|<form|<object|<embed|javascript:/i.test(text)) fail(`${file} has a script, frame, form or import`);
}
const CSP = `default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'`;
for (const page of pages) {
  if (!read(page).includes(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`)) fail(`${page} lacks the Content-Security-Policy`);
}

// 4. Links inside the site.
for (const page of pages) {
  for (const [, href] of read(page).matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const target = href.endsWith('/') ? path.join(href, 'index.html') : href;
    if (!existsSync(path.join(ROOT, target))) fail(`${page} links to ${href}, which isn't there`);
  }
}

// 5. Contrast, by WCAG's measure (relative luminance), for the colors text is set in.
const linear = (channel) => (channel / 255 <= 0.04045 ? channel / 255 / 12.92 : ((channel / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((index) => linear(parseInt(hex.slice(index, index + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};
const css = read('style.css');
const colorsIn = (block) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name, value]) => [name, value]));
const day = colorsIn(css.match(/:root \{([\s\S]*?)\n\}/)[1]);
const night = { ...day, ...colorsIn(css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\}/)[1]) };
const ratios = [];
for (const [mode, colors] of [['light', day], ['dark', night]]) {
  for (const name of ['text', 'text-muted', 'accent']) {
    const ratio = contrast(colors[name], colors.background);
    ratios.push(`${mode} ${name} ${colors[name]} ${ratio.toFixed(2)}:1`);
    if (ratio < 4.5) fail(`${mode}: --${name} ${colors[name]} is ${ratio.toFixed(2)}:1 on ${colors.background}, under 4.5`);
  }
}

console.log(`✓ ${pages.length} pages, the stylesheet and the favicon: no URL to another site; every reference this site's own or mailto:`);
console.log(`✓ no script, frame, form or import anywhere; the Content-Security-Policy on every page; every internal link leads somewhere`);
console.log(`✓ contrast, every text at least 4.5:1 on its page: ${ratios.join(' · ')}`);

// Every URL anywhere in the repository, for the record — the license's, and the font's own name
// table (read as UTF-16 too, the way a font keeps its names). None is ever fetched.
console.log('\nEvery URL anywhere in the repository:');
for (const file of files) {
  const bytes = readFileSync(path.join(ROOT, file));
  const swapped = Buffer.from(bytes.subarray(0, bytes.length - (bytes.length % 2))).swap16();
  // Scheme and host only: a font's names run into each other, with nothing between to end a URL on.
  const found = [bytes.toString('latin1'), swapped.toString('utf16le')].flatMap((text) => text.match(/https?:\/\/[A-Za-z0-9.-]+/g) ?? []);
  const urls = [...new Set(found)];
  if (urls.length > 0) console.log(`  ${file}: ${urls.join(', ')}`);
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
