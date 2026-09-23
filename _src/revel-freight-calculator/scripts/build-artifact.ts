/**
 * Builds the standalone single-file dashboard (published privately as a
 * claude.ai Artifact, not on the public site):
 *
 *   npm run build:artifact   → dist-artifact/revel-freight.html
 *
 * Embeds master data, rate cards, zones, postcodes and website product names
 * so the page needs nothing but Google Fonts.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = (f: string) => JSON.parse(readFileSync(join(root, 'public', 'data', f), 'utf8'));

const js = await build({ entryPoints: [join(root, 'src/artifact/main.ts')], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false });
const website = data('website.json');
const embedded = {
  builtAt: new Date().toISOString(),
  products: data('products.json'),
  rateCard: data('winnings-rate-card.json'),
  dfe: data('dfe-rate-card.json'),
  zones: data('winnings-zones.json'),
  postcodes: data('postcodes.json'),
  website: {
    fetchedAt: website.fetchedAt,
    products: Object.fromEntries(Object.entries(website.products as Record<string, any>).map(([k, v]) => [k, { t: v.title, v: v.variant, u: v.url, p: v.price }])),
  },
};

const html = readFileSync(join(root, 'src/artifact/template.html'), 'utf8')
  .replace('/*CSS*/', () => readFileSync(join(root, 'src/artifact/style.css'), 'utf8'))
  .replace('/*LOGO*/', () => readFileSync(join(root, 'src/artifact/logo.txt'), 'utf8').trim())
  .replace('/*DATA*/', () => JSON.stringify(embedded).replace(/</g, '\\u003c'))
  .replace('/*JS*/', () => js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));

mkdirSync(join(root, 'dist-artifact'), { recursive: true });
const out = join(root, 'dist-artifact', 'revel-freight.html');
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB)`);
