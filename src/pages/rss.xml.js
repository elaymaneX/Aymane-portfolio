import rss from '@astrojs/rss';
import { localizedEntries } from '../lib/content';

// English feed
export async function GET(context) {
  const posts = (await localizedEntries('blog', 'en'))
    .sort((a, b) => b.entry.data.date.valueOf() - a.entry.data.date.valueOf());
  return rss({
    title: 'Aymane Elamrani',
    description: 'Writing on AI, quantitative finance, and the things I build.',
    site: context.site,
    items: posts.map(({ slug, entry: post }) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.excerpt,
      link: `/blog/${slug}/`,
    })),
  });
}
