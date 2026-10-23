import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tag: z.string(),
    tagColor: z.string(),
    excerpt: z.string(),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.object({
      label: z.string(),
      accent: z.boolean().default(false),
    })),
    excerpt: z.string(),
    icon: z.string().default('code'),
    iconBg: z.string().default('#3B6CF4'),
    externalUrl: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, projects };
