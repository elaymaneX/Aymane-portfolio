import type { CollectionEntry } from 'astro:content';
import { localePath, type Lang } from '../i18n';
import { entrySlug } from './content';

export const isApp = (p: CollectionEntry<'projects'>) => p.data.type === 'app';

// undefined for an app with no live URL yet: its card is not a link
export const projectHref = (p: CollectionEntry<'projects'>, lang: Lang) =>
  isApp(p) ? p.data.externalUrl : localePath(lang, `/projects/${entrySlug(p)}`);
