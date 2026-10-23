import type { CollectionEntry } from 'astro:content';

export const isApp = (p: CollectionEntry<'projects'>) => p.data.type === 'app';

// undefined for an app with no live URL yet: its card is not a link
export const projectHref = (p: CollectionEntry<'projects'>) =>
  isApp(p) ? p.data.externalUrl : `/projects/${p.slug}`;
