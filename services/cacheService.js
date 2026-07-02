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

const REFRESH_NORMAL_MS = 15 * 60 * 1000; // 15 min cuando no hay actividad
const REFRESH_LIVE_MS   = 2  * 60 * 1000; // 2 min cuando hay partidos en vivo
let lastSync = null;
let isSyncing = false;
let refreshIntervalHandle = null;

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

    /* ---- Standings: calculados desde resultados confirmados de openfootball
       (confiable). ESPN para fútbol históricamente devuelve datos incorrectos
       o de otro torneo, así que ya no se usa como fuente principal. ---- */
    let standings = [];
    if (openFootballMatches.status === 'fulfilled' && openFootballMatches.value?.length > 0) {
      standings = parser.calculateStandingsFromMatches(openFootballMatches.value);
    }
    if (standings.length === 0 && rawStandings.status === 'fulfilled' && rawStandings.value) {
      console.log('[Cache] openfootball sin datos de grupos, probando ESPN standings');
      standings = parser.parseStandings(rawStandings.value);
    }
    if (standings.length > 0) cache.set('standings', standings);

    /* ---- Estadísticas por equipo: calculadas desde los mismos partidos
       confiables de openfootball (incluye goleadores reales). ---- */
    if (openFootballMatches.status === 'fulfilled' && openFootballMatches.value?.length > 0) {
      const teamStats = parser.calculateTeamStats(openFootballMatches.value);
      if (teamStats.length > 0) cache.set('teamStats', teamStats);
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
    const liveCount = matches.filter(m => m.status === 'in').length;
    console.log('[Cache] Sync completo:', lastSync.toISOString(),
      `| matches:${matches.length} news:${news.length} enVivo:${liveCount}`);

    // Reprograma el siguiente sync: más frecuente si hay partidos en vivo
    scheduleNextSync(liveCount > 0);
  } catch (e) {
    console.error('[Cache] Error en sync:', e.message);
  } finally {
    isSyncing = false;
  }
}

function scheduleNextSync(hasLiveMatches) {
  if (refreshIntervalHandle) clearTimeout(refreshIntervalHandle);
  const delay = hasLiveMatches ? REFRESH_LIVE_MS : REFRESH_NORMAL_MS;
  refreshIntervalHandle = setTimeout(syncAll, delay);
}

function startAutoRefresh() {
  // Sync inmediato al arrancar; luego se autoreprograma según haya o no partidos en vivo
  syncAll();
}

function getMatches()   { return cache.get('matches')   || []; }
function getStandings() { return cache.get('standings') || []; }
function getNews()      { return cache.get('news')      || []; }
function getTeamStats() { return cache.get('teamStats') || []; }
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
  getTeamStats,
  getLastSync,
  getStatus,
};
