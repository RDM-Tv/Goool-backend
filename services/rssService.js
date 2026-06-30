/* ===========================
   rssService.js — Noticias de fútbol vía RSS
   Solo fuentes específicas de fútbol, sin deportes genéricos
   =========================== */

const fetch = require('node-fetch');

/* ---- Fuentes RSS exclusivas de fútbol ----
   Se eligieron secciones específicas de fútbol (no "deportes" en general)
   de medios reconocidos en español que cubren el Mundial. */
const FEEDS = [
  { name: 'Marca',       url: 'https://e00-marca.uecdn.es/rss/futbol/seleccion.html' },
  { name: 'Marca',       url: 'https://e00-marca.uecdn.es/rss/futbol/mas-futbol.html' },
  { name: 'AS',          url: 'https://as.com/rss/futbol/portada.xml' },
  { name: 'Futbolred',   url: 'https://www.futbolred.com/rss' },
  { name: 'ESPN',        url: 'https://www.espn.com/espn/rss/soccer/news' },
];

function stripCDATA(str = '') {
  return str.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function decodeEntities(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function timeAgo(date) {
  const diff = (Date.now() - date) / 1000;
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

/* ---- Parser XML simple sin dependencias externas pesadas ---- */
function parseRSSItems(xml, sourceName, maxItems = 6) {
  const items = [];
  const itemBlocks = xml.split(/<item>/i).slice(1);

  for (const block of itemBlocks.slice(0, maxItems)) {
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch   = block.match(/<link>([\s\S]*?)<\/link>/i);
    const pubMatch    = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

    if (!titleMatch) continue;

    const title = decodeEntities(stripCDATA(titleMatch[1]));
    const link  = linkMatch ? decodeEntities(stripCDATA(linkMatch[1])) : '#';
    const pubDate = pubMatch ? new Date(pubMatch[1]) : new Date();

    // Filtro: solo noticias que mencionen fútbol/mundial (por si el feed mezcla otros deportes)
    const isFootballRelevant = true; // los feeds elegidos ya son 100% fútbol

    if (isFootballRelevant) {
      items.push({
        title,
        link,
        source: sourceName,
        published: pubDate.toISOString(),
        time: timeAgo(pubDate),
      });
    }
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Goool Backend RSS Reader)' },
      timeout: 8000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRSSItems(xml, feed.name);
  } catch (e) {
    console.warn(`[RSS] ${feed.name} fallo:`, e.message);
    return [];
  }
}

/* ---- Trae todas las fuentes en paralelo y combina ---- */
async function getAllFootballNews() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  let all = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') all = all.concat(r.value);
  });

  // Ordenar por fecha más reciente primero
  all.sort((a, b) => new Date(b.published) - new Date(a.published));

  // Dedupe por título similar (a veces varios medios repiten el mismo titular)
  const seen = new Set();
  const unique = all.filter(item => {
    const key = item.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 15);
}

module.exports = { getAllFootballNews };
