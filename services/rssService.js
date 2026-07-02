/* ===========================
   rssService.js — Noticias de fútbol
   Google News RSS como fuente principal (sin bloqueos, sin auth)
   + feeds directos verificados como respaldo
   =========================== */

const fetch = require('node-fetch');

/* ---- Google News RSS por búsqueda (siempre funciona, sin auth) ---- */
const GOOGLE_NEWS_FEEDS = [
  { name: 'Google News', query: 'Mundial+2026+fútbol' },
  { name: 'Google News', query: 'World+Cup+2026+soccer' },
  { name: 'Google News', query: 'Copa+del+Mundo+2026' },
  { name: 'Google News', query: 'Ecuador+selección+fútbol+2026' },
  { name: 'Google News', query: 'Argentina+fútbol+2026+Mundial' },
  { name: 'Google News', query: 'Brasil+fútbol+Mundial+2026' },
  { name: 'Google News', query: 'Colombia+fútbol+2026' },
  { name: 'Google News', query: 'ronda+32+octavos+Mundial+2026' },
  { name: 'Google News', query: 'Mbappé+Messi+Haaland+Mundial' },
];

/* ---- Feeds RSS directos verificados por logs de Render ---- */
const DIRECT_FEEDS = [
  { name: 'AS Fútbol',       url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/internacional/' },
  { name: 'AS Colombia',     url: 'https://feeds.as.com/mrss-s/pages/as/site/colombia.as.com/portada/' },
  { name: 'Mundo Deportivo', url: 'https://www.mundodeportivo.com/feed/rss/futbol/internacional' },
  { name: 'Mundo Deportivo', url: 'https://www.mundodeportivo.com/feed/rss/futbol/champions' },
  { name: 'ESPN Soccer',     url: 'https://www.espn.com/espn/rss/soccer/news' },
  { name: 'Futbolred',       url: 'https://www.futbolred.com/rss' },
  { name: 'Bolavip AR',      url: 'https://bolavip.com/ar/rss/feed' },
  { name: 'Bolavip MX',      url: 'https://bolavip.com/mx/rss/feed' },
  { name: 'Olé',             url: 'https://www.ole.com.ar/rss/' },
  { name: 'Sky Sports',      url: 'https://www.skysports.com/rss/11095' },
  { name: 'BBC Sport',       url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { name: 'Football España', url: 'https://football-espana.net/feed' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

function stripCDATA(str = '') {
  return str.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function decodeEntities(str = '') {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
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
  'messi','ronaldo','mbappé','mbappe','neymar','haaland','vinicius','benzema',
  'ecuador','argentina','brasil','brazil','colombia','uruguay','chile',
  'mexico','españa','espana','alemania','germany','france','england','portugal',
  'mls','ligapro','sudamericana','libertadores','conmebol','uefa','fifa',
  'premier','laliga','bundesliga','serie a','ligue 1','ronda','16avos',
];

function isFootball(title = '', source = '') {
  const footballOnlySources = ['ESPN Soccer','Futbolred','Bolavip AR','Bolavip MX',
    'Olé','AS Fútbol','AS Colombia','BBC Sport','Sky Sports','Football España',
    'Google News'];
  if (footballOnlySources.includes(source)) return true;
  return FOOTBALL_KEYWORDS.some(k => title.toLowerCase().includes(k));
}

function parseXML(xml, sourceName, maxItems = 6) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);

  for (const block of blocks.slice(0, maxItems * 2)) {
    const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkM  = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
                 || block.match(/<link[^>]+href="([^"]+)"/i);
    const pubM   = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
                 || block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
                 || block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);

    if (!titleM) continue;
    const title = decodeEntities(stripCDATA(titleM[1])).replace(/<[^>]+>/g, '').trim();
    if (!title || title.length < 10) continue;
    if (!isFootball(title, sourceName)) continue;

    // Para Google News: el link viene en <link> pero el texto real está en el href
    let link = linkM ? decodeEntities(stripCDATA(linkM[1])).trim() : '#';
    // Google News wraps URLs — desenvuelve si es necesario
    const gnMatch = link.match(/url=([^&]+)/);
    if (gnMatch) link = decodeURIComponent(gnMatch[1]);

    const pubDate = pubM ? new Date(pubM[1]) : new Date();
    const validDate = !isNaN(pubDate.getTime());

    items.push({
      title,
      link,
      source: sourceName,
      published: validDate ? pubDate.toISOString() : new Date().toISOString(),
      time: validDate ? timeAgo(pubDate) : 'Reciente',
    });

    if (items.length >= maxItems) break;
  }
  return items;
}

async function fetchGoogleNews(queryObj) {
  const url = `https://news.google.com/rss/search?q=${queryObj.query}&hl=es-419&gl=US&ceid=US:es-419`;
  try {
    const res = await fetch(url, { headers: HEADERS, timeout: 8000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseXML(xml, queryObj.name, 5);
    if (items.length > 0) console.log(`[RSS] ✓ Google News "${queryObj.query}": ${items.length}`);
    return items;
  } catch (e) {
    console.warn(`[RSS] ✗ Google News "${queryObj.query}": ${e.message}`);
    return [];
  }
}

async function fetchDirect(feed) {
  try {
    const res = await fetch(feed.url, { headers: HEADERS, timeout: 8000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseXML(xml, feed.name, 5);
    if (items.length > 0) console.log(`[RSS] ✓ ${feed.name}: ${items.length}`);
    return items;
  } catch (e) {
    console.warn(`[RSS] ✗ ${feed.name}: ${e.message}`);
    return [];
  }
}

async function getAllFootballNews() {
  // Lanza todas las peticiones en paralelo
  const [gnResults, directResults] = await Promise.all([
    Promise.allSettled(GOOGLE_NEWS_FEEDS.map(fetchGoogleNews)),
    Promise.allSettled(DIRECT_FEEDS.map(fetchDirect)),
  ]);

  let all = [];
  [...gnResults, ...directResults].forEach(r => {
    if (r.status === 'fulfilled') all = all.concat(r.value);
  });

  // Ordenar por más recientes
  all.sort((a, b) => new Date(b.published) - new Date(a.published));

  // Deduplicar
  const seen = new Set();
  const unique = all.filter(item => {
    const key = item.title.toLowerCase()
      .replace(/[^a-záéíóúñü0-9]/g, '')
      .slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[RSS] Total: ${unique.length} noticias únicas de fútbol`);
  return unique.slice(0, 40);
}

module.exports = { getAllFootballNews };
