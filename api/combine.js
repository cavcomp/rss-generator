export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let urls = [];
    
    if (req.query.urls) {
      urls = req.query.urls.split(',').map(u => u.trim()).filter(u => u);
    } else {
      for (let i = 1; i <= 5; i++) {
        const url = req.query[`url${i}`];
        if (url) urls.push(url.trim());
      }
    }

    if (urls.length === 0 || urls.length > 5) {
      return res.status(400).json({ 
        error: 'Please provide 1-5 URLs',
        example: '/api/combine?urls=https://patch.com,https://techcrunch.com'
      });
    }

    const results = await Promise.allSettled(
      urls.map(url => fetchAndExtract(url))
    );

    let allArticles = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { articles, sourceName } = result.value;
        allArticles.push(...articles.map(article => ({
          ...article,
          source: sourceName
        })));
      }
    });

    if (allArticles.length === 0) {
      return res.status(404).json({ 
        error: 'No articles found',
        message: 'Could not extract articles from any of the provided URLs'
      });
    }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Combined Feed</title>
    <link>${urls[0]}</link>
    <description>Combined RSS feed from ${urls.length} sources</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${allArticles.slice(0, 100).map(article => `    <item>
      <title>${escapeXML(`[${article.source}] ${article.title}`)}</title>
      <link>${escapeXML(article.link)}</link>
      <description>${escapeXML(article.description)}</description>
      <pubDate>${article.pubDate}</pubDate>
      <source>${escapeXML(article.source)}</source>
    </item>`).join('\n')}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(rss);

  } catch (error) {
    console.error('Combine Error:', error);
    res.status(500).json({ 
      error: 'Failed to combine feeds',
      message: error.message 
    });
  }
}

async function fetchAndExtract(url) {
  try {
    new URL(url);
  } catch (e) {
    throw new Error(`Invalid URL format: ${url}`);
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RSS-Generator/1.0)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  let articles = [];
  let sourceName = '';

  try {
    const urlObj = new URL(url);
    sourceName = urlObj.hostname.replace(/^www\./, '');
  } catch {
    sourceName = 'Unknown Source';
  }

  if (contentType.includes('xml') || contentType.includes('rss') || text.trim().startsWith('<?xml')) {
    articles = parseRSSFeed(text);
  } else {
    articles = parseHTMLPage(text, url);
  }

  return { articles: articles.slice(0, 20), sourceName };
}

function parseRSSFeed(xmlText) {
  const articles = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemPattern.exec(xmlText)) !== null) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
    const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i);
    const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/i);

    if (titleMatch && linkMatch) {
      articles.push({
        title: decodeHTML(titleMatch[1].trim()),
        link: linkMatch[1].trim(),
        description: descMatch ? decodeHTML(descMatch[1].trim()) : '',
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toUTCString()
      });
    }
  }

  return articles;
}

function parseHTMLPage(html, baseUrl) {
  const articles = [];
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : 'Articles';

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
        link: makeAbsoluteUrl(link, baseUrl),
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
          link: makeAbsoluteUrl(link, baseUrl),
          description: linkTitle,
          pubDate: new Date().toUTCString()
        });
      }
    }
  }

  return articles;
}

function makeAbsoluteUrl(link, baseUrl) {
  try {
    return new URL(link, baseUrl).href;
  } catch {
    return link;
  }
}

function decodeHTML(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
