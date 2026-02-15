// tools/grabProxies.js
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// URL target untuk SOCKS5, Elite/High Anonimity
const RAW_URL = 'https://www.freeproxy.world/?type=socks5&anonymity=4&country=&speed=2000&port=&page=1';

async function scrapeProxies() {
  console.log('🔄 Memulai pengambilan proxy...');
  try {
    const { data } = await axios.get(RAW_URL);
    const $ = cheerio.load(data);
    const proxies = [];

    $('table.layui-table tbody tr').each((i, elem) => {
      const tds = $(elem).find('td');
      // Pastikan ada cukup kolom dan format IP valid
      if (tds.length < 8) return; 

      const ip = $(tds[0]).text().trim();
      const port = $(tds[1]).find('a').text().trim() || $(tds[1]).text().trim();
      const speedRaw = $(tds[4]).find('.layui-progress-bar').attr('lay-percent'); // Ambil speed bar
      
      if (ip && port) {
         // Format standard: socks5://ip:port
        proxies.push(`socks5://${ip}:${port}`);
      }
    });

    if (proxies.length > 0) {
        // Simpan ke root folder sebagai TXT biar ringan
        const filePath = path.join(__dirname, '../proxies.txt');
        fs.writeFileSync(filePath, proxies.join('\n'));
        console.log(`✅ Berhasil menyimpan ${proxies.length} proxy SOCKS5 ke proxies.txt`);
    } else {
        console.log('⚠️ Tidak ditemukan proxy yang valid, mungkin struktur web berubah.');
    }

  } catch (err) {
    console.error('❌ Error scraping proxies:', err.message);
  }
}

scrapeProxies();
