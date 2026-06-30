/* ===========================
   cacheService.js — Cache en memoria + auto-refresh
   Combina múltiples fuentes: ESPN (primaria), openfootball (respaldo),
   RSS de medios deportivos de fútbol (noticias).
   =========================== */

const NodeCache = require('node-cache');
const espn         = require('./espnService');
const openFootball  = require('./openFootballService');
const rss           = require('./rssService');
const parser        = require('./parser');

// TTL alto porque el refresh lo controlamos manualmente con el interval,
// no queremos que expire solo y deje al frontend sin datos.
const cache = new NodeCache({ stdTTL: 0, checkperiod: 0 });

const REFRESH_MS = 15 * 60 * 1000; // 15 minutos
let lastSync = null;
let isSyncing = false;

async function syncAll() {
  if (isSyncing) return;
  isSyncing = true;
  console.log('[Cache] Sincronizando fuentes...');

  try {
    const [rawMatches, rawStandings, rawEspnNews, openFootballMatches, footballRssNews] =
      await Promise.allSettled([
        espn.getScoreboard(),
        espn.getStandings(),
        espn.getNews(),
        openFootball.getMatches(),
        rss.getAllFootballNews(),
      ]);

    /* ---- Partidos: ESPN primero, openfootball como respaldo si ESPN no trae nada ---- */
    let matches = [];
    if (rawMatches.status === 'fulfilled' && rawMatches.value) {
      matches = parser.parseMatches(rawMatches.value);
    }
    if (matches.length === 0 && openFootballMatches.status === 'fulfilled') {
      console.log('[Cache] ESPN sin datos, usando openfootball como respaldo');
      matches = parser.parseOpenFootballMatches(openFootballMatches.value);
    }
    if (matches.length > 0) cache.set('matches', matches);

    /* ---- Standings: solo ESPN (no hay respaldo equivalente; en fase eliminatoria
       puede venir vacío legítimamente, eso no es un error) ---- */
    if (rawStandings.status === 'fulfilled' && rawStandings.value) {
      const standings = parser.parseStandings(rawStandings.value);
      if (standings.length > 0) cache.set('standings', standings);
    }

    /* ---- Noticias: combina ESPN + RSS de medios de fútbol, ESPN primero ---- */
    let news = [];
    if (rawEspnNews.status === 'fulfilled' && rawEspnNews.value) {
      news = parser.parseNews(rawEspnNews.value);
    }
    if (footballRssNews.status === 'fulfilled' && footballRssNews.value?.length > 0) {
      // Combina y quita duplicados por título similar
      const seen = new Set(news.map(n => n.title.toLowerCase().slice(0, 40)));
      const extra = footballRssNews.value.filter(n => {
        const key = n.title.toLowerCase().slice(0, 40);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      news = news.concat(extra);
    }
    if (news.length > 0) cache.set('news', news.slice(0, 20));

    lastSync = new Date();
    console.log('[Cache] Sync completo:', lastSync.toISOString(),
      `| matches:${matches.length} news:${news.length}`);
  } catch (e) {
    console.error('[Cache] Error en sync:', e.message);
  } finally {
    isSyncing = false;
  }
}

function startAutoRefresh() {
  // Sync inmediato al arrancar
  syncAll();
  // Luego cada 15 minutos
  setInterval(syncAll, REFRESH_MS);
}

function getMatches()   { return cache.get('matches')   || []; }
function getStandings() { return cache.get('standings') || []; }
function getNews()      { return cache.get('news')      || []; }
function getLastSync()  { return lastSync; }
function getStatus()    {
  return {
    lastSync: lastSync ? lastSync.toISOString() : null,
    hasMatches:   cache.has('matches'),
    hasStandings: cache.has('standings'),
    hasNews:      cache.has('news'),
    isSyncing,
  };
}

module.exports = {
  startAutoRefresh,
  syncAll,
  getMatches,
  getStandings,
  getNews,
  getLastSync,
  getStatus,
};
