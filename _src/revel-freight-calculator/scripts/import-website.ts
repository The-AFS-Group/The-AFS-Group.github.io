/**
 * revelsaunas.com.au catalogue → public/data/website.json
 *
 *   npm run import:website
 *
 * Reads the public Shopify catalogue (/products.json) and keeps, per variant
 * SKU: product title, variant name, price, compare-at price, product URL,
 * image, availability and the weight the store uses for shipping rates.
 * Joined to master data by SKU (case-insensitive) in the calculator.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = 'https://revelsaunas.com.au';

interface ShopifyVariant { sku: string | null; title: string; price: string; compare_at_price: string | null; grams: number; available: boolean; featured_image?: { src: string } | null }
interface ShopifyProduct { title: string; handle: string; product_type: string; variants: ShopifyVariant[]; images: { src: string }[] }

const products: ShopifyProduct[] = [];
for (let page = 1; page < 20; page++) {
  const res = await fetch(`${STORE}/products.json?limit=250&page=${page}`);
  if (!res.ok) throw new Error(`products.json page ${page}: ${res.status}`);
  const batch = ((await res.json()) as { products: ShopifyProduct[] }).products;
  if (!batch.length) break;
  products.push(...batch);
}

const thumb = (src?: string) => (src ? `${src}${src.includes('?') ? '&' : '?'}width=160` : null);
const bySku: Record<string, unknown> = {};
for (const p of products) {
  for (const v of p.variants) {
    if (!v.sku) continue;
    const key = v.sku.trim().toUpperCase();
    if (bySku[key]) continue;
    bySku[key] = {
      title: p.title,
      variant: v.title === 'Default Title' ? '' : v.title,
      type: p.product_type,
      price: Number(v.price),
      compareAt: v.compare_at_price ? Number(v.compare_at_price) : null,
      url: `${STORE}/products/${p.handle}`,
      image: thumb(v.featured_image?.src || p.images[0]?.src),
      available: v.available,
      grams: v.grams,
    };
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'website.json');
writeFileSync(out, JSON.stringify({ source: STORE, fetchedAt: new Date().toISOString(), products: bySku }) + '\n');
console.log(`Products: ${products.length}, SKUs: ${Object.keys(bySku).length}`);
console.log(`Wrote ${out}`);
