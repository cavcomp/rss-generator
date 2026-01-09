export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Short code required' });
  }

  try {
    // Decode the base64 encoded URLs
    const padded = code
      .replace(/-/g, '+')
      .replace(/_/g, '/') + '==';
    
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    const urls = decoded.split('|').filter(u => u);

    if (urls.length === 0) {
      return res.status(400).json({ error: 'Invalid short code' });
    }

    // Build the redirect URL
    const baseUrl = req.headers.host || 'rss-generator-six.vercel.app';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const combineUrl = `${protocol}://${baseUrl}/api/combine?urls=${urls.map(encodeURIComponent).join(',')}`;

    // Redirect to the combined feed
    res.setHeader('Location', combineUrl);
    res.status(302).end();

  } catch (error) {
    console.error('Redirect Error:', error);
    res.status(400).json({ 
      error: 'Invalid or corrupted short code',
      message: error.message 
    });
  }
}
