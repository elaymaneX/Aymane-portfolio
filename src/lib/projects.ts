import type { CollectionEntry } from 'astro:content';

export const isApp = (p: CollectionEntry<'projects'>) => p.data.type === 'app';

export const projectHref = (p: CollectionEntry<'projects'>) =>
  isApp(p) ? p.data.externalUrl! : `/projects/${p.slug}`;
