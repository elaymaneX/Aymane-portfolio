import { getCollection, type CollectionEntry } from 'astro:content';
import { defaultLang, type Lang } from '../i18n';

// Content lives in <collection>/<lang>/<slug>.mdx (Decap's multiple_folders layout)
type Entry = CollectionEntry<'blog'> | CollectionEntry<'projects'>;
export const entryLang = (e: Entry) => e.slug.split('/')[0];
export const entrySlug = (e: Entry) => e.slug.split('/').slice(1).join('/');

// Text a translation may override; everything else (dates, links, flags) always comes from English
const translatable = ['title', 'excerpt', 'tag', 'tags', 'stats', 'gallery'];
const isFilled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

// Every published English entry, swapped for its translation when one exists.
// The CMS may save empty translation files, so a translation only counts once it has a title.
export async function localizedEntries<C extends 'blog' | 'projects'>(collection: C, lang: Lang) {
  const all = (await getCollection(collection)) as CollectionEntry<C>[];
  return all
    .filter(e => entryLang(e) === defaultLang && !e.data.draft)
    .map(base => {
      if (!base.data.title || !base.data.date) {
        throw new Error(`${collection}/${base.slug}: English entries need a title and a date`);
      }
      const slug = entrySlug(base);
      const tr = lang === defaultLang ? undefined
        : all.find(e => entryLang(e) === lang && entrySlug(e) === slug && e.data.title);
      if (!tr) return { entry: base, slug, fallback: lang !== defaultLang };
      const data = { ...base.data };
      for (const key of translatable) if (isFilled(tr.data[key])) data[key] = tr.data[key];
      // Use the translated body (render) unless it's still empty
      const body = tr.body?.trim() ? tr : base;
      return { entry: { ...body, data } as CollectionEntry<C>, slug, fallback: false };
    });
}

// Minutes to read a post at ~220 words a minute, ignoring code fences and MDX/HTML tags
export const readingMinutes = (body: string) => {
  const words = body.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
};
