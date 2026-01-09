
export default async function handler(req, res) {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ 
      error: 'Please provide a URL parameter',
      example: '/api/feed?url=https://patch.com'
    });
  }

  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS-Generator/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'RSS Feed';
    
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                     html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1] : `RSS feed for ${url}`;

    const articles = [];
    
    const articlePattern = /<article[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<\/article>/gi;
    let match;
    while ((match = articlePattern.exec(html)) !== null && articles.length < 20) {
      const link = match[1];
      const articleHtml = match[0];
      
      const linkTitleMatch = articleHtml.match(/<a[^>]+href=["'][^"']+["'][^>]*>([^<]+)<\/a>/i);
      const articleTitle = linkTitleMatch ? linkTitleMatch[1].trim() : 'Article';
      
      if (articleTitle.length > 5) {
        articles.push({
          title: articleTitle,
          link: makeAbsoluteUrl(link, url),
          description: articleTitle,
          pubDate: new Date().toUTCString()
        });
      }
    }

    if (articles.length === 0) {
      const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
      while ((match = linkPattern.exec(html)) !== null && articles.length < 20) {
        const link = match[1];
        const linkTitle = match[2].trim();
        
        if (linkTitle.length > 20 && 
            !link.includes('javascript:') && 
            !link.includes('mailto:') &&
            !link.match(/\/(map|contact|about)$/i)) {
          articles.push({
            title: linkTitle,
            link: makeAbsoluteUrl(link, url),
            description: linkTitle,
            pubDate: new Date().toUTCString()
          });
        }
      }
    }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXML(title)}</title>
    <link>${escapeXML(url)}</link>
    <description>${escapeXML(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${articles.map(article => `    <item>
      <title>${escapeXML(article.title)}</title>
      <link>${escapeXML(article.link)}</link>
      <description>${escapeXML(article.description)}</description>
      <pubDate>${article.pubDate}</pubDate>
    </item>`).join('\n')}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(rss);

  } catch (error) {
    console.error('Feed generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate feed',
      message: error.message 
    });
  }
}

function makeAbsoluteUrl(link, baseUrl) {
  try {
    return new URL(link, baseUrl).href;
  } catch {
    return link;
  }
}

function escapeXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

