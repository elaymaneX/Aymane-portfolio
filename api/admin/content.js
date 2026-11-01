// Posts and projects for the admin panel (signed-in session required). Each entry is
// src/content/<collection>/<lang>/<slug>.mdx; English is required, Spanish and French are optional.
// GET  /api/admin/content?collection=blog|projects             -> { items: [{ slug, title, date, draft, featured, langs }] }
// GET  /api/admin/content?collection=blog|projects&slug=<slug> -> { slug, langs: { en: { data, body }, es, fr } }
// POST /api/admin/content { action: 'save', collection, slug, isNew, langs }
//                         { action: 'delete', collection, slug }
//                         { action: 'upload', name, base64 }  -> { url }   image for posts and projects
import YAML from 'yaml';
import { guard } from '../_lib/admin.js';
import { readBody } from '../_lib/comments.js';
import { repo, repoReady } from '../_lib/repo.js';

const COLLECTIONS = ['blog', 'projects'];
const LANGS = ['en', 'es', 'fr'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i; // no SVG: it can carry scripts
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const pathOf = (collection, lang, slug) => `src/content/${collection}/${lang}/${slug}.mdx`;

function parse(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: source };
  return { data: YAML.parse(match[1]) ?? {}, body: match[2].replace(/^\n+/, '') };
}
// Dates stay plain YYYY-MM-DD scalars, which Astro reads as dates
const serialize = ({ data, body }) =>
  `---\n${YAML.stringify(data, { lineWidth: 0 })}---\n${body.trim() ? `\n${body.trim()}\n` : ''}`;

async function readEntry(collection, slug) {
  const langs = {};
  for (const lang of LANGS) {
    const source = await repo.read(pathOf(collection, lang, slug));
    langs[lang] = source === null ? null : parse(source);
  }
  return langs;
}

export default async function handler(req, res) {
  if (!(await guard(req, res))) return;
  if (!repoReady) return res.status(503).json({ error: 'not_configured' });

  try {
    if (req.method === 'GET') {
      const collection = String(req.query.collection ?? '');
      if (!COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'invalid_collection' });
      const slug = req.query.slug === undefined ? null : String(req.query.slug);

      if (slug !== null) {
        if (!SLUG.test(slug)) return res.status(400).json({ error: 'invalid_slug' });
        const langs = await readEntry(collection, slug);
        if (!langs.en) return res.status(404).json({ error: 'not_found' });
        return res.status(200).json({ slug, langs });
      }

      const files = await repo.list(`src/content/${collection}`);
      const slugsIn = lang => new Set(files.filter(f => f.startsWith(`src/content/${collection}/${lang}/`) && f.endsWith('.mdx'))
        .map(f => f.split('/').pop().replace(/\.mdx$/, '')));
      const translated = { es: slugsIn('es'), fr: slugsIn('fr') };
      const items = [];
      for (const slug of slugsIn('en')) {
        const { data } = parse((await repo.read(pathOf(collection, 'en', slug))) ?? '');
        items.push({
          slug,
          title: data.title ?? slug,
          date: data.date ? String(data.date).slice(0, 10) : '',
          draft: Boolean(data.draft),
          featured: Boolean(data.featured),
          langs: ['en', ...LANGS.slice(1).filter(lang => translated[lang].has(slug))],
        });
      }
      items.sort((a, b) => b.date.localeCompare(a.date));
      return res.status(200).json({ items });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = readBody(req) ?? {};

    if (body.action === 'upload') {
      const name = String(body.name ?? '').toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '');
      const base64 = String(body.base64 ?? '');
      if (!IMAGE.test(name)) return res.status(400).json({ error: 'invalid_image_type' });
      if (Buffer.byteLength(base64, 'base64') > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'image_too_large' });
      const month = new Date().toISOString().slice(0, 7);
      const path = `public/images/uploads/${month}/${Date.now().toString(36)}-${name}`;
      await repo.commit([{ path, base64 }], `Upload image ${name} (admin panel)`);
      return res.status(201).json({ url: path.replace(/^public/, '') });
    }

    const collection = String(body.collection ?? '');
    const slug = String(body.slug ?? '');
    if (!COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'invalid_collection' });
    if (!SLUG.test(slug) || slug.length > 80) return res.status(400).json({ error: 'invalid_slug' });
    const label = collection === 'blog' ? 'post' : 'project';

    if (body.action === 'delete') {
      const existing = await readEntry(collection, slug);
      if (!existing.en) return res.status(404).json({ error: 'not_found' });
      const changes = LANGS.filter(lang => existing[lang]).map(lang => ({ path: pathOf(collection, lang, slug), remove: true }));
      await repo.commit(changes, `Delete ${label} ${slug} (admin panel)`);
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'save') {
      const langs = body.langs ?? {};
      const en = langs.en;
      if (!en?.data?.title || !en?.data?.date) return res.status(400).json({ error: 'missing_title_or_date' });
      const existing = await readEntry(collection, slug);
      if (body.isNew && existing.en) return res.status(409).json({ error: 'slug_taken' });

      const changes = [];
      for (const lang of LANGS) {
        const entry = langs[lang];
        const path = pathOf(collection, lang, slug);
        const data = entry?.data && typeof entry.data === 'object' ? entry.data : {};
        const text = typeof entry?.body === 'string' ? entry.body : '';
        // An empty translation is removed so the site falls back to English
        if (lang !== 'en' && !data.title && !text.trim()) {
          if (existing[lang]) changes.push({ path, remove: true });
          continue;
        }
        const next = serialize({ data, body: text });
        const current = existing[lang] ? serialize(existing[lang]) : null;
        if (next !== current) changes.push({ path, text: next });
      }
      if (!changes.length) return res.status(200).json({ ok: true, unchanged: true });
      await repo.commit(changes, `${body.isNew ? 'Add' : 'Update'} ${label}: ${en.data.title} (admin panel)`);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'invalid_action' });
  } catch (error) {
    console.error('admin/content:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}
