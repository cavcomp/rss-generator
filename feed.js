export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Fetch the webpage
    const response = await fetch(url);
    const html = await response.text();

    // Simple extraction of title and links (basic implementation)
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : url;

    // Extract article links and titles (Patch.com specific patterns)
    const articles = [];
    const articlePattern = /<a[^>]+href="([^"]+)"[^>]*>.*?<\/a>/gi;
    const matches = [...html.matchAll(articlePattern)];

    // Get unique article URLs
    const seen = new Set();
    for (const match of matches) {
      const link = match[1];
      if (link.includes('/') && !link.includes('javascript:') && !seen.has(link)) {
        // Make absolute URL
        let absoluteUrl = link;
        if (link.startsWith('/')) {
          const baseUrl = new URL(url);
          absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${link}`;
        }
        
        if (absoluteUrl.includes('patch.com') && 
            !absoluteUrl.includes('/map') && 
            !absoluteUrl.includes('/compose') &&
            !absoluteUrl.includes('/contact') &&
            articles.length < 20) {
          seen.add(link);
          
          // Extract title from the link context
          const titlePattern = new RegExp(`<a[^>]+href="${link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>\\s*([^<]+)`, 'i');
          const titleMatch = html.match(titlePattern);
          const articleTitle = titleMatch ? titleMatch[1].trim() : link.split('/').pop();
          
          articles.push({
            title: articleTitle,
            link: absoluteUrl
          });
        }
      }
    }

    // Generate RSS XML
    const now = new Date().toUTCString();
    
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXML(title)}</title>
    <link>${escapeXML(url)}</link>
    <description>RSS feed for ${escapeXML(url)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${escapeXML(url)}" rel="self" type="application/rss+xml"/>
`;

    articles.forEach(article => {
      rss += `
    <item>
      <title>${escapeXML(article.title)}</title>
      <link>${escapeXML(article.link)}</link>
      <description>${escapeXML(article.title)}</description>
      <pubDate>${now}</pubDate>
      <guid>${escapeXML(article.link)}</guid>
    </item>`;
    });

    rss += `
  </channel>
</rss>`;

    // Set response headers for RSS
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(rss);

  } catch (error) {
    res.status(500).json({ error: 'Failed to generate RSS feed', message: error.message });
  }
}

function escapeXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
