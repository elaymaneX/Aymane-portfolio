import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  integrations: [
    mdx(),
    sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es', fr: 'fr' } } }),
  ],
  site: 'https://aymane-portofolio-eta.vercel.app',
});
