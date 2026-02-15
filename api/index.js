const app = require('express')();
const axios = require('axios');
const cheerio = require('cheerio');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

app.use(cors());

// --- UTILS: Baca Proxy ---
function getRandomProxy() {
  try {
    const filePath = path.join(process.cwd(), 'proxies.txt');
    // Jika file tidak ada (kasus pertama kali deploy lupa generate), return null
    if (!fs.existsSync(filePath)) return null;
    
    const data = fs.readFileSync(filePath, 'utf-8');
    const proxies = data.split('\n').filter(line => line.trim() !== '');
    if (proxies.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex].trim();
  } catch (e) {
    console.error("Error reading proxy file", e);
    return null;
  }
}

// --- MAIN ROUTE ---
app.get('/api/tools/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  const startTime = Date.now();

  // Validasi Input
  if (!targetUrl) {
    return res.status(400).json({ success: false, message: "URL parameter is required" });
  }

  // 1. Setup Proxy
  const proxyUrl = getRandomProxy();
  const httpsAgent = proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined;
  
  // Console log untuk debugging di dashboard Vercel
  console.log(`Requesting: ${targetUrl} | Using Proxy: ${proxyUrl || 'Direct (No Proxy Found)'}`);

  try {
    // 2. Request ke Target URL
    const response = await axios.get(targetUrl, {
      httpsAgent: httpsAgent,
      httpAgent: httpsAgent, // Jaga-jaga kalau targetnya HTTP biasa
      timeout: 15000, // Timeout 15 detik biar serverless ga hang
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': targetUrl
      }
    });

    // 3. Parsing Data (Logic Scraping ala Manga)
    // Ingat: Tiap web punya struktur beda. Ini CONTOH GENERIC scraping ala KomikCast/Web Manga.
    const $ = cheerio.load(response.data);
    const resultImages = [];
    
    // Pola umum website manga: mencari gambar di dalam div reader area
    // Sesuaikan selector ini ('#readerarea img') dengan target website aslimu nanti
    $('img[src*="wp-content"], #readerarea img, .main-reading-area img').each((i, el) => {
        let imgSrc = $(el).attr('src') || $(el).attr('data-src');
        if(imgSrc && !imgSrc.includes('logo') && !imgSrc.includes('banner')) {
            resultImages.push(imgSrc);
        }
    });

    const pageTitle = $('title').text().replace(' - KomikCast', '').trim();
    
    // Coba cari navigasi prev/next
    const prevLink = $('.nextprev .prev a').attr('href') || '#';
    const nextLink = $('.nextprev .next a').attr('href') || '#';

    // 4. Susun Format Response Final
    const endTime = Date.now();
    const finalJson = {
      success: true,
      result: {
        status: response.status,
        content: {
          creator: "Sanka Vollerei Project",
          success: true,
          data: {
            title: pageTitle,
            comicSlug: targetUrl.split('/').filter(Boolean).pop() || "unknown-slug",
            proxyUsed: proxyUrl, // Info tambahan debug
            images: resultImages,
            navigation: {
              prev: prevLink,
              next: nextLink,
              allChapters: "https://your-comic-list-source.com"
            }
          }
        }
      },
      headers: {
        // Headers dummy biar mirip cloudflare/asli seperti request kamu
        "date": new Date().toUTCString(),
        "content-type": "application/json; charset=utf-8",
        "server": "Vercel-Proxy-Agent",
        "x-powered-by": "Express"
      },
      timestamp: new Date().toISOString(),
      responseTime: `${endTime - startTime}ms`
    };

    return res.json(finalJson);

  } catch (error) {
    // Error Handling
    return res.status(500).json({
      success: false,
      message: "Proxy or Fetch Error",
      error: error.message,
      usingProxy: proxyUrl
    });
  }
});

// Route test biar tau API hidup
app.get('/', (req, res) => res.send('API is Ready. Use /api/tools/proxy?url=...'));

module.exports = app;
