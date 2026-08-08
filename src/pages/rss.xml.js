import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: 'GxPSoft AI Blog',
    description: 'Thoughts on autonomous AI agents, GxP validation, secure backups, and developer tools for critical systems.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      customData: post.data.author ? `<author>${post.data.author}</author>` : '',
      link: `/blog/${post.id}.html`,
    })),
  });
}
