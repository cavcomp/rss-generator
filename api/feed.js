export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ 
      error: 'URL parameter is required',
      example: '/api/feed?url=https://patch.com'
    });
  }

  try {
    // Validate URL
    let validUrl;
    try {
      validUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSGenerator/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const siteTitle = titleMatch ? titleMatch[1].replace(/[\r\n]+/g, ' ').trim() : validUrl.hostname;

    // Extract meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1] : `RSS feed for ${validUrl.hostname}`;

    // Extract articles
    const articles = [];
    const seen = new Set();

    // Pattern 1: Standard article links
    const articleRegex = /<article[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/article>/gi;
    let match;

    while ((match = articleRegex.exec(html)) !== null && articles.length < 20) {
      const link = match[1];
      const titleHtml = match[2];
      const title = titleHtml.replace(/<[^>]+>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
      
      if (title && link && !seen.has(link)) {
        const absoluteUrl = makeAbsoluteUrl(link, validUrl);
        if (absoluteUrl) {
          seen.add(link);
          articles.push({ title, link: absoluteUrl });
        }
      }
    }

    // Pattern 2: Links with article-like classes
    if (articles.length < 10) {
      const linkRegex = /<a[^>]*href=["']([^"'#]+)["'][^>]*>([^<]+)<\/a>/gi;
      while ((match = linkRegex.exec(html)) !== null && articles.length < 20) {
        const link = match[1];
        const title = match[2].replace(/[\r\n\t]+/g, ' ').trim();
        
        if (title.length > 20 && link && !seen.has(link) && 
            !link.includes('javascript:') && 
            !link.includes('mailto:') &&
            !link.includes('/map') &&
            !link.includes('/contact') &&
            !link.includes('/about')) {
          
          const absoluteUrl = makeAbsoluteUrl(link, validUrl);
          if (absoluteUrl && absoluteUrl.startsWith('http')) {
            seen.add(link);
            articles.push({ title, link: absoluteUrl });
          }
        }
      }
    }

    // If still no articles, create a basic entry
    if (articles.length === 0) {
      articles.push({
        title: siteTitle,
        link: url
      });
    }

    // Generate RSS XML
    const now = new Date().toUTCString();
    
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXML(siteTitle)}</title>
    <link>${escapeXML(url)}</link>
    <description>${escapeXML(description)}</description>
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
      <guid isPermaLink="true">${escapeXML(article.link)}</guid>
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
    console.error('RSS Generation Error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Failed to generate RSS feed', 
      message: error.message 
    });
  }
}

function makeAbsoluteUrl(link, baseUrl) {
  try {
    if (link.startsWith('http://') || link.startsWith('https://')) {
      return link;
    }
    if (link.startsWith('//')) {
      return `${baseUrl.protocol}${link}`;
    }
    if (link.startsWith('/')) {
      return `${baseUrl.protocol}//${baseUrl.host}${link}`;
    }
    return `${baseUrl.protocol}//${baseUrl.host}/${link}`;
  } catch (e) {
    return null;
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
