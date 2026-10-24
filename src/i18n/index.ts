import { ui } from './ui';

export const locales = ['en', 'es', 'fr'] as const;
export type Lang = (typeof locales)[number];
export const defaultLang: Lang = 'en';

export const langNames: Record<Lang, string> = { en: 'English', es: 'Español', fr: 'Français' };
const dateLocales: Record<Lang, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR' };

// getStaticPaths for pages under src/pages/[...lang]/: English has no prefix
export const langPaths = () => locales.map(l => ({ params: { lang: l === defaultLang ? undefined : l } }));

export const getLang = (param: string | undefined): Lang =>
  (locales as readonly string[]).includes(param ?? '') ? (param as Lang) : defaultLang;

export const t = (lang: Lang) => ui[lang];

// '/blog' -> '/es/blog' ; '/' -> '/es/'
export const localePath = (lang: Lang, path: string) =>
  lang === defaultLang ? path : `/${lang}${path === '/' ? '/' : path}`;

// Strip any locale prefix from a pathname: '/fr/blog' -> '/blog'
export const unlocalizedPath = (pathname: string) => {
  const m = pathname.match(/^\/(es|fr)(\/.*)?$/);
  return m ? m[2] || '/' : pathname;
};

export const formatDate = (lang: Lang, date: Date, opts: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString(dateLocales[lang], { timeZone: 'UTC', ...opts });
