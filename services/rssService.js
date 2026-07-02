/* ===========================
   rssService.js — Noticias de fútbol vía RSS
   URLs verificadas y activas en 2026
   =========================== */

const fetch = require('node-fetch');

/* ---- Feeds verificados como activos en 2026 ----
   Fuentes con URL confirmada vía feedspot.com y logs reales de Render.
   Solo secciones específicas de fútbol para evitar mezcla de deportes. */
const FEEDS = [
  // --- MARCA (funciona, 403 por User-Agent básico → usar spoofing) ---
  { name: 'Marca',          url: 'https://e00-marca.uecdn.es/rss/portada.xml' },
  { name: 'Marca Fútbol',   url: 'https://e00-marca.uecdn.es/rss/futbol/mas-futbol.html' },
  { name: 'Marca Mundial',  url: 'https://e00-marca.uecdn.es/rss/futbol/futbol-internacional.html' },

  // --- AS ---
  { name: 'AS Fútbol',      url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/internacional/' },
  { name: 'AS Colombia',    url: 'https://feeds.as.com/mrss-s/pages/as/site/colombia.as.com/portada/' },

  // --- MUNDO DEPORTIVO (URLs verificadas feedspot) ---
  { name: 'Mundo Deportivo', url: 'https://www.mundodeportivo.com/feed/rss/futbol/internacional' },
  { name: 'Mundo Deportivo', url: 'https://www.mundodeportivo.com/feed/rss/futbol/champions' },

  // --- ESPN (funciona según logs) ---
  { name: 'ESPN Soccer',    url: 'https://www.espn.com/espn/rss/soccer/news' },

  // --- FUTBOLRED (funciona según logs) ---
  { name: 'Futbolred',      url: 'https://www.futbolred.com/rss' },

  // --- BOLAVIP (URL correcta encontrada en búsqueda) ---
  { name: 'Bolavip AR',     url: 'https://bolavip.com/ar/rss/feed' },
  { name: 'Bolavip MX',     url: 'https://bolavip.com/mx/rss/feed' },

  // --- INFOBAE (URL correcta) ---
  { name: 'Infobae Fútbol', url: 'https://www.infobae.com/feeds/rss/deportes/' },

  // --- DIARIO OLÉ (Argentina) ---
  { name: 'Olé',            url: 'https://www.ole.com.ar/rss/' },

  // --- EL UNIVERSO (Ecuador) ---
  { name: 'El Universo',    url: 'https://www.eluniverso.com/rss.xml' },

  // --- REUTERS SPORTS (en español, fútbol) ---
  { name: 'Reuters',        url: 'https://feeds.reuters.com/reuters/sportsNews' },

  // --- BBC SPORT (en inglés pero con mucho fútbol mundial) ---
  { name: 'BBC Sport',      url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },

  // --- SKY SPORTS FOOTBALL ---
  { name: 'Sky Sports',     url: 'https://www.skysports.com/rss/11095' },

  // --- GOAL.COM (feed alternativo) ---
  { name: 'Goal.com',       url: 'https://www.goal.com/feeds/en/news' },

  // --- FOOTBALL-ESPANA ---
  { name: 'Football España', url: 'https://football-espana.net/feed' },

  // --- LA NACIÓN ARGENTINA ---
  { name: 'La Nación',      url: 'https://feeds.lanacion.com.ar/rss/deportes' },
];

function stripCDATA(str = '') {
  return str.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function decodeEntities(str = '') {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function timeAgo(date) {
  const diff = (Date.now() - date) / 1000;
  if (diff < 60)    return 'Ahora';
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

const FOOTBALL_KEYWORDS = [
  'fútbol','futbol','soccer','football','mundial','world cup','copa del mundo',
  'gol','partido','selección','seleccion','equipo','torneo','copa','liga',
  'champions','eliminatoria','octavos','cuartos','semifinal','final',
  'portero','delantero','jugador','entrenador','técnico','tecnico',
  'marcador','resultado','penales','árbitro','arbitro','estadio',
  'messi','ronaldo','mbappé','mbappe','neymar','haaland','vinicius',
  'ecuador','argentina','brasil','brazil','colombia','uruguay','chile',
  'mexico','españa','espana','alemania','germany','france','england','portugal',
  'mls','ligapro','sudamericana','libertadores','conmebol','uefa','fifa',
  'premier','laliga','bundesliga','serie a','ligue 1',
];

function isFootballArticle(title = '', source = '') {
  // Feeds 100% de fútbol: no filtrar
  const footballOnlySources = ['ESPN Soccer','Futbolred','Bolavip AR','Bolavip MX',
    'Olé','AS Fútbol','AS Colombia','Marca Fútbol','Marca Mundial','BBC Sport',
    'Sky Sports','Goal.com','Football España'];
  if (footballOnlySources.includes(source)) return true;
  const text = title.toLowerCase();
  return FOOTBALL_KEYWORDS.some(k => text.includes(k));
}

function parseRSSItems(xml, sourceName, maxItems = 5) {
  const items = [];
  const itemBlocks = xml.split(/<item[\s>]/i).slice(1);

  for (const block of itemBlocks.slice(0, maxItems * 3)) {
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch  = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
                    || block.match(/<link[^>]+href="([^"]+)"/i);
    const pubMatch   = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
                    || block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
                    || block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);

    if (!titleMatch) continue;
    const title = decodeEntities(stripCDATA(titleMatch[1])).trim();
    if (!title || title.length < 10) continue;
    if (!isFootballArticle(title, sourceName)) continue;

    const link    = linkMatch ? decodeEntities(stripCDATA(linkMatch[1])).trim() : '#';
    const pubDate = pubMatch  ? new Date(pubMatch[1]) : new Date();

    items.push({
      title,
      link,
      source: sourceName,
      published: isNaN(pubDate.getTime()) ? new Date().toISOString() : pubDate.toISOString(),
      time: isNaN(pubDate.getTime()) ? 'Reciente' : timeAgo(pubDate),
    });

    if (items.length >= maxItems) break;
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: {
        // User-Agent de browser real para evitar 403
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      timeout: 8000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRSSItems(xml, feed.name);
    if (items.length > 0) console.log(`[RSS] ✓ ${feed.name}: ${items.length} artículos`);
    return items;
  } catch (e) {
    console.warn(`[RSS] ✗ ${feed.name}: ${e.message}`);
    return [];
  }
}

async function getAllFootballNews() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  let all = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') all = all.concat(r.value);
  });

  // Ordenar por más recientes primero
  all.sort((a, b) => new Date(b.published) - new Date(a.published));

  // Deduplicar por título (primeras 50 chars normalizadas)
  const seen = new Set();
  const unique = all.filter(item => {
    const key = item.title.toLowerCase()
      .replace(/[^a-záéíóúñü0-9\s]/g, '')
      .trim().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[RSS] Total: ${unique.length} noticias únicas de fútbol`);
  return unique.slice(0, 30);
}

module.exports = { getAllFootballNews };
