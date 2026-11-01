import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// In `astro dev`, serve the Vercel functions in api/ (on Vercel they run on their own)
const vercelApiInDev = {
  name: 'vercel-api-in-dev',
  hooks: {
    'astro:server:setup': ({ server }) => {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''));
      server.middlewares.use('/api', async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!/^\/(comments|subscribe|admin\/(session|passkey|comments|subscribers|content))$/.test(url.pathname)) return next();
        const { default: handler } = await server.ssrLoadModule(`/api${url.pathname}.js`);
        let body = '';
        for await (const chunk of req) body += chunk;

        req.query = Object.fromEntries(url.searchParams);
        req.body = body || undefined;
        res.status = code => ((res.statusCode = code), res);
        res.json = data => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        await handler(req, res);
      });
    },
  },
};

export default defineConfig({
  integrations: [
    mdx(),
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es', fr: 'fr' } },
      filter: page => !page.includes('/admin'),
    }),
    vercelApiInDev,
  ],
  // Set SITE_URL in Vercel when the custom domain is live; canonical links, sitemap, RSS and share
  // images all follow it
  site: process.env.SITE_URL || 'https://aymaneelam.dev',
  markdown: {
    // $inline$ and $$block$$ maths in posts, rendered to HTML at build time (no JS for readers)
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    // Code blocks follow the site theme: light by default, dark under [data-theme="dark"] (global.css)
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: 'light' },
  },
});
