// Share cards (1200×630) shown when a page is posted on LinkedIn, X, Slack…, rendered at build time:
// /og/site.png, /og/blog/<slug>.png, /og/projects/<slug>.png
import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { localizedEntries } from '../../lib/content';

type Card = { title: string; label: string; labelColor: string; subtitle: string };

export async function getStaticPaths() {
  const cards: { params: { path: string }; props: Card }[] = [
    {
      params: { path: 'site' },
      props: {
        title: 'Machine learning, quantitative finance & AI agents',
        label: 'Portfolio',
        labelColor: '#3B6CF4',
        subtitle: 'Projects, write-ups and notes by a quantitative data scientist with a quantum physics background.',
      },
    },
  ];
  for (const { slug, entry } of await localizedEntries('blog', 'en')) {
    cards.push({
      params: { path: `blog/${slug}` },
      props: { title: entry.data.title, label: entry.data.tag || 'Blog', labelColor: entry.data.tagColor, subtitle: entry.data.excerpt },
    });
  }
  for (const { slug, entry } of await localizedEntries('projects', 'en')) {
    cards.push({
      params: { path: `projects/${slug}` },
      props: { title: entry.data.title, label: 'Project', labelColor: entry.data.iconBg, subtitle: entry.data.excerpt },
    });
  }
  return cards;
}

const font = (file: string) => readFile(join(process.cwd(), 'node_modules/@fontsource', file));
const fontsPromise = Promise.all([
  font('dm-sans/files/dm-sans-latin-400-normal.woff'),
  font('dm-sans/files/dm-sans-latin-700-normal.woff'),
  font('fraunces/files/fraunces-latin-500-normal.woff'),
  // Fallback for symbols the text fonts lack (≈, Greek letters, arrows…)
  readFile(join(process.cwd(), 'node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff')),
]);

// Minimal element builder for satori (it takes React-like objects; every multi-child box needs display: flex)
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]) => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});

// Shorten to whole words so the card never ends mid-word
const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '').replace(/[,;:.]$/, '')}…` : text;

// Light labels (the gold project colour) need dark text
const labelText = (color: string) => (/^#(F5C563|FFFFFF|FFF)$/i.test(color) ? '#111827' : '#FFFFFF');

export const GET: APIRoute = async ({ props }) => {
  const { title, label, labelColor, subtitle } = props as Card;
  const [dmSans, dmSansBold, fraunces, symbols] = await fontsPromise;

  const card = h('div', { width: '100%', height: '100%', position: 'relative', background: '#0F1117', color: '#F3F4F6', fontFamily: 'DM Sans' },
    // Soft glow in the corner, echoing the site's hero
    h('div', { position: 'absolute', top: -260, right: -200, width: 700, height: 700, borderRadius: 9999,
      background: 'radial-gradient(circle, rgba(107,80,220,0.35) 0%, rgba(59,108,244,0.16) 45%, rgba(15,17,23,0) 70%)' }),
    h('div', { position: 'absolute', top: 64, left: 72, width: 1056, height: 502, flexDirection: 'column', justifyContent: 'space-between' },
      h('div', { alignItems: 'center', justifyContent: 'space-between', width: '100%' },
        h('div', { fontFamily: 'Fraunces', fontSize: 40 }, 'Aymane', h('span', { color: '#6B8FF8' }, '.')),
        h('div', { fontSize: 22, fontWeight: 700, padding: '8px 22px', borderRadius: 9999, background: labelColor, color: labelText(labelColor) }, label),
      ),
      h('div', { flexDirection: 'column', gap: 24, maxWidth: 1000 },
        h('div', { fontFamily: 'Fraunces', fontSize: title.length > 60 ? 56 : 68, lineHeight: 1.1, letterSpacing: -1.5 }, clip(title, 110)),
        h('div', { fontSize: 26, lineHeight: 1.45, color: '#9CA3AF' }, clip(subtitle, 150)),
      ),
      h('div', { alignItems: 'center', gap: 18, fontSize: 24 },
        h('div', { width: 56, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #6B8FF8, #F5C563)' }),
        h('div', { fontWeight: 700 }, 'Aymane Elamrani'),
        h('div', { color: '#9CA3AF' }, 'Quantitative Data Scientist & ML'),
      ),
    ),
  );

  const svg = await satori(card as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'DM Sans', data: dmSans, weight: 400, style: 'normal' },
      { name: 'DM Sans', data: dmSansBold, weight: 700, style: 'normal' },
      { name: 'Fraunces', data: fraunces, weight: 500, style: 'normal' },
      { name: 'Symbols', data: symbols, weight: 400, style: 'normal' },
    ],
  });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
