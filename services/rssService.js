/* ===========================
   rssService.js — Noticias de fútbol
   
   Estrategia anti-403 definitiva:
   1. The Guardian API (gratis, funciona desde cloud, key pública de dev)
   2. ESPN API (ya funciona en Render para otras rutas)
   3. Noticias generadas desde datos de partidos reales (fallback 0 dependencias)
   =========================== */

const fetch = require('node-fetch');

/* ---- The Guardian API ---- 
   API key gratuita de desarrollo: "test" funciona con rate limit generoso.
   Sección football cubre Mundial, Premier, La Liga, Champions, etc.
   Permite acceso desde servidores cloud sin restricción de IP. */
const GUARDIAN_KEY = 'test'; // Reemplazar con key real de open-platform.theguardian.com
const GUARDIAN_QUERIES = [
  { q: 'world cup 2026',        tag: 'football/world-cup-2026' },
  { q: 'fifa world cup soccer', tag: 'football/fifaworldcup'   },
  { q: 'soccer football 2026',  tag: 'football'                },
];

async function fetchGuardianNews() {
  const articles = [];
  for (const query of GUARDIAN_QUERIES) {
    const url = `https://content.guardianapis.com/search?q=${encodeURIComponent(query.q)}&section=football&show-fields=headline,thumbnail,shortUrl,webPublicationDate&page-size=10&api-key=${GUARDIAN_KEY}`;
    try {
      const res = await fetch(url, { timeout: 8000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.response?.results?.length > 0) {
        const items = data.response.results.map(a => ({
          title:     a.webTitle || a.fields?.headline || '',
          link:      a.webUrl || a.fields?.shortUrl || '#',
          source:    'The Guardian',
          published: a.webPublicationDate || new Date().toISOString(),
          time:      timeAgo(new Date(a.webPublicationDate)),
        }));
        articles.push(...items);
        console.log(`[News] ✓ Guardian "${query.q}": ${items.length}`);
        break; // Con una query exitosa es suficiente
      }
    } catch(e) {
      console.warn(`[News] ✗ Guardian: ${e.message}`);
    }
  }
  return articles;
}

/* ---- ESPN API (noticias del Mundial vía site.api.espn.com) ---- */
async function fetchESPNNews() {
  const urls = [
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=15&lang=es',
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=15',
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0',
          'Referer': 'https://www.espn.com/',
        },
        timeout: 8000,
      });
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
        console.log(`[News] ✓ ESPN: ${items.length}`);
        return items;
      }
    } catch(e) {
      console.warn(`[News] ✗ ESPN: ${e.message}`);
    }
  }
  return [];
}

/* ---- Noticias generadas desde datos de partidos reales ----
   Fallback de cero dependencias: siempre da algo útil aunque
   todo lo demás falle. Generamos titulares desde los resultados. */
function generateMatchNews(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return [];

  const now = new Date();
  const news = [];

  // Partidos recientes con resultado
  const recent = matches
    .filter(m => m.status === 'post' && m.home.score !== null)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12);

  for (const m of recent) {
    const homeScore = m.home.score;
    const awayScore = m.away.score;
    const winner    = homeScore > awayScore ? m.home.name
                    : awayScore > homeScore ? m.away.name
                    : null;

    let title;
    if (winner) {
      title = `${winner} avanza en el Mundial: ${m.home.name} ${homeScore}–${awayScore} ${m.away.name}`;
    } else {
      title = `Empate dramático: ${m.home.name} ${homeScore}–${awayScore} ${m.away.name} en ${m.group || 'el Mundial 2026'}`;
    }

    // Agregar goleadores si los hay
    const scorers = [...(m.home.goals || []), ...(m.away.goals || [])];
    if (scorers.length > 0) {
      const scorerNames = scorers.map(g => `${g.scorer} (${g.minute})`).join(', ');
      title += ` — Goles: ${scorerNames}`;
    }

    news.push({
      title,
      link:      '#',
      source:    'Goool Live',
      published: m.date || now.toISOString(),
      time:      timeAgo(new Date(m.date || now)),
    });
  }

  // Partidos próximos
  const upcoming = matches
    .filter(m => m.status === 'pre')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  for (const m of upcoming) {
    news.push({
      title:     `Próximo: ${m.home.name} vs ${m.away.name} — ${m.group || 'Mundial 2026'} en ${m.venue || 'USA/CAN/MEX'}`,
      link:      '#',
      source:    'Goool Live',
      published: m.date || now.toISOString(),
      time:      timeAgo(new Date(m.date || now)),
    });
  }

  console.log(`[News] ✓ Generadas desde partidos: ${news.length}`);
  return news;
}

function timeAgo(date) {
  if (!date || isNaN(date.getTime())) return 'Reciente';
  const diff = (Date.now() - date) / 1000;
  if (diff < 60)    return 'Ahora';
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

/* ---- Función principal: combina las 3 fuentes ---- */
async function getAllFootballNews(matches = []) {
  // Lanza Guardian y ESPN en paralelo
  const [guardianItems, espnItems] = await Promise.all([
    fetchGuardianNews().catch(() => []),
    fetchESPNNews().catch(() => []),
  ]);

  // Noticias generadas desde partidos (siempre disponibles)
  const generatedItems = generateMatchNews(matches);

  // Combina: Guardian + ESPN primero, luego generadas como relleno
  let all = [...guardianItems, ...espnItems];

  // Deduplicar por título
  const seen = new Set();
  all = all.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Si hay pocas noticias de APIs externas, rellenar con generadas
  if (all.length < 10) {
    const genFiltered = generatedItems.filter(item => {
      const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    all = [...all, ...genFiltered];
  }

  // Ordenar por más recientes
  all.sort((a, b) => new Date(b.published) - new Date(a.published));

  console.log(`[News] Total final: ${all.length} noticias`);
  return all.slice(0, 40);
}

module.exports = { getAllFootballNews, generateMatchNews };
