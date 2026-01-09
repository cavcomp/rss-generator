export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get URLs from query parameters or POST body
  let urls = [];
  
  if (req.method === 'GET') {
    // Support multiple formats: ?urls=url1,url2,url3 or ?url1=...&url2=...&url3=...
    if (req.query.urls) {
      urls = req.query.urls.split(',').map(u => u.trim()).filter(u => u);
    } else {
      // Check for url1, url2, url3, url4, url5
      for (let i = 1; i <= 5; i++) {
        if (req.query[`url${i}`]) {
          urls.push(req.query[`url${i}`]);
        }
      }
    }
  } else if (req.method === 'POST') {
    urls = req.body.urls || [];
  }

  if (urls.length === 0) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ 
      error: 'URLs required',
      example1: '/api/combine?urls=https://patch.com,https://techcrunch.com',
      example2: '/api/combine?url1=https://patch.com&url2=https://techcrunch.com'
    });
  }

  if (urls.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 URLs allowed' });
  }

  try {
    // Fetch all URLs in parallel
    const results = await Promise.allSettled(
      urls.map(url => fetchAndExtract(url))
    );

    // Combine all articles
    const allArticles = [];
    const feedTitles = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { title, articles } = result.value;
        feedTitles.push(title);
        allArticles.push(...articles.map(article => ({
          ...article,
          source: title,
          sourceUrl: urls[index]
        })));
      }
    });

    if (allArticles.length === 0) {
      return res.status(500).json({ error: 'Could not extract any articles from provided URLs' });
    }

    // Sort by date (newest first) - for now use current time
    // In a real implementation, you'd parse dates from the feeds
    allArticles.sort((a, b) => {
      // If we have actual dates, sort by them
      // For now, just maintain order
      return 0;
    });

    // Generate combined RSS feed
    const now = new Date().toUTCString();
    const combinedTitle = feedTitles.length > 0 
      ? `Combined Feed: ${feedTitles.slice(0, 3).join(', ')}${feedTitles.length > 3 ? '...' : ''}`
      : 'Combined RSS Feed';
    
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXML(combinedTitle)}</title>
    <link>${escapeXML(urls[0])}</link>
    <description>Combined RSS feed from ${urls.length} source${urls.length > 1 ? 's' : ''}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
`;

    // Add all articles
    allArticles.forEach(article => {
      rss += `
    <item>
      <title>${escapeXML(article.title)}${article.source ? ` [${escapeXML(article.source)}]` : ''}</title>
      <link>${escapeXML(article.link)}</link>
      <description>${escapeXML(article.description || article.title)}</description>
      <pubDate>${article.pubDate || now}</pubDate>
      <guid isPermaLink="true">${escapeXML(article.link)}</guid>
      ${article.source ? `<source url="${escapeXML(article.sourceUrl)}">${escapeXML(article.source)}</source>` : ''}
    </item>`;
    });

    rss += `
  </channel>
</rss>`;

    // Set response headers
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    res.status(200).send(rss);

  } catch (error) {
    console.error('Combined Feed Error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Failed to generate combined feed', 
      message: error.message 
    });
  }
}

async function fetchAndExtract(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSGenerator/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const content = await response.text();
    const contentType = response.headers.get('content-type') || '';

    // Check if it's already an RSS/XML feed
    if (contentType.includes('xml') || contentType.includes('rss') || content.trim().startsWith('<?xml')) {
      return parseRSSFeed(content, url);
    } else {
      // It's an HTML page - extract articles
      return parseHTMLPage(content, url);
    }
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return { title: url, articles: [] };
  }
}

function parseRSSFeed(xml, sourceUrl) {
  const articles = [];
  
  // Extract feed title
  const titleMatch = xml.match(/<title>(.*?)<\/title>/i);
  const feedTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : sourceUrl;
  
  // Extract all items
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null && articles.length < 20) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title>(.*?)<\/title>/i);
    const linkMatch = itemContent.match(/<link>(.*?)<\/link>/i);
    const descMatch = itemContent.match(/<description>(.*?)<\/description>/i);
    const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/i);
    
    if (titleMatch && linkMatch) {
      articles.push({
        title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim(),
        link: linkMatch[1].trim(),
        description: descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim() : '',
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toUTCString()
      });
    }
  }
  
  return { title: feedTitle, articles };
}

function parseHTMLPage(html, sourceUrl) {
  const validUrl = new URL(sourceUrl);
  
  // Extract title
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].replace(/[\r\n]+/g, ' ').trim() : validUrl.hostname;
  
  const articles = [];
  const seen = new Set();
  
  // Pattern 1: Article elements
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
        articles.push({ 
          title, 
          link: absoluteUrl,
          pubDate: new Date().toUTCString()
        });
      }
    }
  }
  
  // Pattern 2: General links
  if (articles.length < 10) {
    const linkRegex = /<a[^>]*href=["']([^"'#]+)["'][^>]*>([^<]+)<\/a>/gi;
    while ((match = linkRegex.exec(html)) !== null && articles.length < 20) {
      const link = match[1];
      const title = match[2].replace(/[\r\n\t]+/g, ' ').trim();
      
      if (title.length > 20 && link && !seen.has(link) && 
          !link.includes('javascript:') && 
          !link.includes('mailto:')) {
        
        const absoluteUrl = makeAbsoluteUrl(link, validUrl);
        if (absoluteUrl && absoluteUrl.startsWith('http')) {
          seen.add(link);
          articles.push({ 
            title, 
            link: absoluteUrl,
            pubDate: new Date().toUTCString()
          });
        }
      }
    }
  }
  
  return { title: pageTitle, articles };
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
