import { defineCollection, z } from 'astro:content';

// Entries live in <collection>/<lang>/<slug>.mdx. English entries hold the full data; translations
// (es/fr) only need the text fields, so non-text fields are optional here and checked in lib/content.ts.
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().default(''),
    date: z.date().optional(),
    tag: z.string().default(''),
    tagColor: z.string().default('#3B6CF4'),
    excerpt: z.string().default(''),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().default(''),
    date: z.date().optional(),
    // app: card links straight to the live site; analysis: card opens its own page
    type: z.enum(['app', 'analysis']).default('analysis'),
    tags: z.array(z.object({
      label: z.string(),
      accent: z.boolean().default(false),
    })).default([]),
    excerpt: z.string().default(''),
    icon: z.string().default('code'),
    iconBg: z.string().default('#3B6CF4'),
    externalUrl: z.string().url().optional(),
    colabUrl: z.string().url().optional(),
    repoUrl: z.string().url().optional(),
    stats: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    gallery: z.array(z.object({
      image: z.string(),
      title: z.string(),
      caption: z.string().optional(),
    })).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, projects };
