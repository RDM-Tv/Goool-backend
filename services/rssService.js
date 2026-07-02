/* ===========================
   rssService.js — Noticias de fútbol vía RSS
   18 fuentes exclusivas de fútbol en español
   =========================== */

const fetch = require('node-fetch');

const FEEDS = [
  // España
  { name: 'Marca',          url: 'https://e00-marca.uecdn.es/rss/futbol/seleccion.html' },
  { name: 'Marca',          url: 'https://e00-marca.uecdn.es/rss/futbol/mas-futbol.html' },
  { name: 'AS',             url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/internacional/' },
  { name: 'Mundo Deportivo',url: 'https://www.mundodeportivo.com/feed/rss/futbol/internacional' },
  { name: 'Sport',          url: 'https://www.sport.es/es/rss/futbol.xml' },

  // Latinoamérica
  { name: 'Infobae',        url: 'https://www.infobae.com/feeds/rss/deportes/futbol/' },
  { name: 'Olé',            url: 'https://www.ole.com.ar/rss/futbol.xml' },
  { name: 'TyC Sports',     url: 'https://www.tycsports.com/rss.xml' },
  { name: 'Futbolred',      url: 'https://www.futbolred.com/rss' },
  { name: 'Bolavip',        url: 'https://bolavip.com/rss.xml' },
  { name: 'El Universo',    url: 'https://www.eluniverso.com/deportes/futbol/rss.xml' },
  { name: 'Extra Ecuador',  url: 'https://www.extra.ec/deportes/rss.xml' },
  { name: 'La Red',         url: 'https://www.larepublica.co/deportes/rss' },

  // Global en español
  { name: 'ESPN Deportes',  url: 'https://www.espndeportes.espn.com/espndeportes/rss/noticias' },
  { name: 'ESPN',           url: 'https://www.espn.com/espn/rss/soccer/news' },
  { name: 'Goal',           url: 'https://www.goal.com/feeds/es/news' },
  { name: 'Diario AS Col',  url: 'https://feeds.as.com/mrss-s/pages/as/site/colombia.as.com/portada/' },
  { name: 'Gol Caracol',    url: 'https://golcaracol.com/rss' },
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

/* ---- Filtra solo artículos relacionados con fútbol ---- */
const FOOTBALL_KEYWORDS = [
  'fútbol', 'futbol', 'mundial', 'world cup', 'gol', 'partido', 'selección',
  'seleccion', 'equipo', 'torneo', 'copa', 'liga', 'champions', 'eliminatoria',
  'octavos', 'cuartos', 'semifinal', 'final', 'clasificación', 'clasificacion',
  'portero', 'delantero', 'jugador', 'entrenador', 'técnico', 'tecnico',
  'marcador', 'resultado', 'penales', 'árbitro', 'arbitro', 'estadio',
  'messi', 'ronaldo', 'mbappé', 'mbappe', 'neymar', 'haaland', 'benzema',
  'ecuador', 'argentina', 'brasil', 'brazil', 'colombia', 'uruguay', 'chile',
  'mexico', 'españa', 'espana', 'alemania', 'france', 'england', 'portugal',
  'mls', 'liga pro', 'ligapro', 'sudamericana', 'libertadores', 'conmebol', 'uefa', 'fifa'
];

function isFootballArticle(title = '', sources = '') {
  const text = (title + ' ' + sources).toLowerCase();
  return FOOTBALL_KEYWORDS.some(k => text.includes(k));
}

function parseRSSItems(xml, sourceName, maxItems = 6) {
  const items = [];
  const itemBlocks = xml.split(/<item[\s>]/i).slice(1);

  for (const block of itemBlocks.slice(0, maxItems * 2)) { // fetch extra to filter
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch  = block.match(/<link>([\s\S]*?)<\/link>/i)
                    || block.match(/<link[^>]*href="([^"]+)"/i);
    const pubMatch   = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)
                    || block.match(/<published>([\s\S]*?)<\/published>/i);

    if (!titleMatch) continue;
    const title = decodeEntities(stripCDATA(titleMatch[1])).trim();
    if (!title || title.length < 10) continue;

    const link    = linkMatch ? decodeEntities(stripCDATA(linkMatch[1])).trim() : '#';
    const pubDate = pubMatch  ? new Date(pubMatch[1]) : new Date();

    // Para feeds genéricos de deporte filtrar solo fútbol
    if (!isFootballArticle(title, sourceName)) continue;

    items.push({
      title,
      link,
      source: sourceName,
      published: isNaN(pubDate) ? new Date().toISOString() : pubDate.toISOString(),
      time: isNaN(pubDate) ? 'Reciente' : timeAgo(pubDate),
    });

    if (items.length >= maxItems) break;
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Goool Backend RSS/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 8000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRSSItems(xml, feed.name);
  } catch (e) {
    console.warn(`[RSS] ${feed.name} (${feed.url.slice(0,40)}): ${e.message}`);
    return [];
  }
}

async function getAllFootballNews() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  let all = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') all = all.concat(r.value);
  });

  // Ordenar por fecha más reciente
  all.sort((a, b) => new Date(b.published) - new Date(a.published));

  // Dedupe por título similar (primeras 50 chars)
  const seen = new Set();
  const unique = all.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[RSS] Noticias recopiladas: ${unique.length} de ${all.length} totales`);
  return unique.slice(0, 30); // máximo 30 noticias
}

module.exports = { getAllFootballNews };
