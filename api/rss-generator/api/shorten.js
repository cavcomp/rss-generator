export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let urls = [];
    
    // Get URLs from query or body
    if (req.method === 'GET' && req.query.urls) {
      urls = req.query.urls.split(',').map(u => u.trim()).filter(u => u);
    } else if (req.method === 'POST' && req.body.urls) {
      urls = Array.isArray(req.body.urls) ? req.body.urls : req.body.urls.split(',').map(u => u.trim()).filter(u => u);
    }

    if (urls.length === 0 || urls.length > 5) {
      return res.status(400).json({ 
        error: 'Please provide 1-5 URLs',
        example: '/api/shorten?urls=https://patch.com,https://techcrunch.com'
      });
    }

    // Create a hash from the URLs
    const urlString = urls.join('|');
    const encoded = Buffer.from(urlString).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Create short link
    const baseUrl = req.headers.host || 'rss-generator-six.vercel.app';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const shortUrl = `${protocol}://${baseUrl}/s/${encoded}`;
    
    // Also return the full API URL
    const fullUrl = `${protocol}://${baseUrl}/api/combine?urls=${urls.map(encodeURIComponent).join(',')}`;

    res.status(200).json({
      shortUrl,
      fullUrl,
      urls,
      count: urls.length
    });

  } catch (error) {
    console.error('Shorten Error:', error);
    res.status(500).json({ 
      error: 'Failed to create short link',
      message: error.message 
    });
  }
}
