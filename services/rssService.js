/* ===========================
   rssService.js — Noticias de fútbol
   
   Fuentes confirmadas que funcionan desde Render:
   1. ESPN API (confirmado en logs: "news:27")
   2. The Guardian API (free tier, cloud-friendly)  
   3. Noticias generadas desde partidos reales (fallback garantizado)
   =========================== */

const fetch = require('node-fetch');

const FETCH_OPTS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/html, */*',
    'Referer': 'https://www.espn.com/',
  },
  timeout: 8000,
};

/* ---- 1. ESPN API — fuente primaria (confirmado funciona en Render) ---- */
async function fetchESPNNews() {
  const urls = [
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=20&lang=es&region=ec',
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=20',
    'https://site.api.espn.com/apis/site/v2/sports/soccer/news?limit=10',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, FETCH_OPTS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.articles?.length > 0) {
        const items = data.articles.map(a => ({
          title:     a.headline || a.title || '',
          link:      a.links?.web?.href || a.links?.mobile?.href || '#',
          source:    'ESPN',
          published: a.published || new Date().toISOString(),
          time:      timeAgo(new Date(a.published)),
        })).filter(a => a.title.length > 5);
        console.log(`[News] ✓ ESPN: ${items.length} artículos`);
        return items;
      }
    } catch(e) {
      console.warn(`[News] ✗ ESPN: ${e.message}`);
    }
  }
  return [];
}

/* ---- 2. The Guardian API — free, cloud-friendly ---- */
async function fetchGuardianNews() {
  const searches = [
    'world+cup+2026+football',
    'fifa+world+cup+2026',
    'soccer+2026',
  ];

  for (const q of searches) {
    const url = `https://content.guardianapis.com/search?q=${q}&section=football&show-fields=headline,webPublicationDate&page-size=10&api-key=test`;
    try {
      const res = await fetch(url, { timeout: 8000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.response?.results?.length > 0) {
        const items = data.response.results.map(a => ({
          title:     a.webTitle || '',
          link:      a.webUrl || '#',
          source:    'The Guardian',
          published: a.webPublicationDate || new Date().toISOString(),
          time:      timeAgo(new Date(a.webPublicationDate)),
        })).filter(a => a.title.length > 5);
        console.log(`[News] ✓ Guardian "${q}": ${items.length}`);
        return items;
      }
    } catch(e) {
      console.warn(`[News] ✗ Guardian: ${e.message}`);
    }
  }
  return [];
}

/* ---- 3. Noticias generadas desde partidos reales ----
   Funciona siempre sin dependencias. Genera titulares reales
   con goleadores, resultados y próximos partidos. ---- */
function generateMatchNews(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return [];

  const news = [];
  const now = new Date();

  const recent = matches
    .filter(m => m.status === 'post' && m.home.score !== null)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  for (const m of recent) {
    const hg = m.home.score, ag = m.away.score;
    const winner = hg > ag ? m.home.name : ag > hg ? m.away.name : null;
    let title = winner
      ? `${winner} gana en el Mundial: ${m.home.name} ${hg}–${ag} ${m.away.name}`
      : `Empate: ${m.home.name} ${hg}–${ag} ${m.away.name}`;

    const scorers = [...(m.home.goals||[]), ...(m.away.goals||[])];
    if (scorers.length > 0) {
      const names = scorers.map(g => `${g.scorer} ${g.minute}`).join(', ');
      title += ` ⚽ ${names}`;
    }
    const phase = m.group || 'Mundial 2026';
    title += ` — ${phase}`;

    news.push({
      title, link: '#', source: 'Goool Live',
      published: m.date || now.toISOString(),
      time: timeAgo(new Date(m.date || now)),
    });
  }

  const upcoming = matches
    .filter(m => m.status === 'pre')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 6);

  for (const m of upcoming) {
    news.push({
      title: `⏰ Próximo: ${m.home.name} vs ${m.away.name} — ${m.group || 'Mundial 2026'}, ${m.venue || ''}`,
      link: '#', source: 'Goool Live',
      published: m.date || now.toISOString(),
      time: timeAgo(new Date(m.date || now)),
    });
  }

  console.log(`[News] ✓ Generadas: ${news.length}`);
  return news;
}

function timeAgo(date) {
  if (!date || isNaN(date.getTime())) return 'Reciente';
  const diff = (Date.now() - date) / 1000;
  if (diff < 60)    return 'Ahora';
  if (diff < 3600)  return `Hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff/3600)}h`;
  return `Hace ${Math.floor(diff/86400)}d`;
}

/* ---- Función principal: combina las 3 fuentes ---- */
async function getAllFootballNews(matches = []) {
  const [espnItems, guardianItems] = await Promise.all([
    fetchESPNNews().catch(() => []),
    fetchGuardianNews().catch(() => []),
  ]);

  const generatedItems = generateMatchNews(matches);

  // Combina ESPN + Guardian primero
  let all = [...espnItems, ...guardianItems];

  // Deduplicar
  const seen = new Set();
  all = all.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Agregar generadas si hay pocas noticias externas
  if (all.length < 15) {
    const genKey = new Set(all.map(i => i.title.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50)));
    const extra = generatedItems.filter(i => {
      const k = i.title.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);
      if (genKey.has(k)) return false;
      genKey.add(k);
      return true;
    });
    all = [...all, ...extra];
  }

  all.sort((a, b) => new Date(b.published) - new Date(a.published));
  console.log(`[News] Total: ${all.length} noticias`);
  return all.slice(0, 40);
}

module.exports = { getAllFootballNews, generateMatchNews };
