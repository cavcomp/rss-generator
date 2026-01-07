# RSS Feed Generator

Convert any website into an RSS feed - deploy for free on Vercel!

## 🚀 Quick Deploy to Vercel (FREE)

### Step 1: Get the Files
Download all files in this folder to your computer.

### Step 2: Create a Vercel Account
1. Go to https://vercel.com
2. Sign up with GitHub (free forever)
3. No credit card required!

### Step 3: Deploy
Two options:

**Option A - Via Website (Easiest):**
1. Go to https://vercel.com/new
2. Click "Import Project"
3. Upload the entire `rss-generator` folder
4. Click "Deploy"
5. Done! You'll get a URL like: `your-app.vercel.app`

**Option B - Via Command Line:**
1. Install Vercel CLI: `npm install -g vercel`
2. Navigate to the rss-generator folder
3. Run: `vercel`
4. Follow the prompts
5. Run: `vercel --prod` to deploy to production

### Step 4: Use Your RSS Generator

Once deployed, your app will be at: `https://your-app.vercel.app`

To generate an RSS feed:
```
https://your-app.vercel.app/api/feed?url=https://patch.com
```

## 📝 How to Use

### For Patch.com:

**Main site:**
```
https://your-app.vercel.app/api/feed?url=https://patch.com
```

**Specific local Patch:**
```
https://your-app.vercel.app/api/feed?url=https://patch.com/new-jersey/brick
https://your-app.vercel.app/api/feed?url=https://patch.com/illinois/joliet
https://your-app.vercel.app/api/feed?url=https://patch.com/california/temecula
```

**Any website:**
```
https://your-app.vercel.app/api/feed?url=https://example.com
```

### Add to RSS Reader:

1. Copy your feed URL
2. Open your RSS reader (Feedly, Inoreader, etc.)
3. Click "Add Feed" or "Subscribe"
4. Paste the URL
5. Done! You'll get automatic updates

## 🎯 Examples

Once deployed, you can create feeds for:

- **Patch.com main:** `?url=https://patch.com`
- **Your local Patch:** `?url=https://patch.com/new-jersey/freehold`
- **Any blog:** `?url=https://techcrunch.com`
- **Any news site:** `?url=https://arstechnica.com`

## 🔧 What's Included

- `api/feed.js` - Serverless function that generates RSS feeds
- `public/index.html` - Simple web interface
- `vercel.json` - Vercel configuration
- `package.json` - Project metadata

## 💡 Tips

- **Free Forever** - Vercel's free tier is generous (100GB bandwidth/month)
- **Auto Updates** - Your RSS feeds update automatically when readers refresh
- **No Maintenance** - Serverless means no server management
- **Fast** - Global CDN makes it super fast worldwide

## 🆘 Troubleshooting

**"Deploy failed"**
- Make sure all 4 files are uploaded
- Check that file names are exactly as shown

**"Feed is empty"**
- The website might be blocking automated access
- Try a different website to test

**"Need help?"**
- Vercel has great docs: https://vercel.com/docs
- Their Discord community is helpful

## 📁 File Structure

```
rss-generator/
├── api/
│   └── feed.js          # RSS generation logic
├── public/
│   └── index.html       # Web interface
├── vercel.json          # Vercel config
├── package.json         # Project info
└── README.md            # This file
```

## 🎉 You're Done!

Once deployed, you have your own personal RSS generator that:
- ✅ Works forever (free)
- ✅ Updates automatically
- ✅ Works with any website
- ✅ No maintenance needed

Your feed URLs will look like:
`https://[your-app-name].vercel.app/api/feed?url=[website]`

Enjoy your RSS feeds! 🎊
