/* ===========================
   cacheService.js — Cache en memoria + auto-refresh
   =========================== */

const NodeCache = require('node-cache');
const espn   = require('./espnService');
const parser = require('./parser');

// TTL alto porque el refresh lo controlamos manualmente con el interval,
// no queremos que expire solo y deje al frontend sin datos.
const cache = new NodeCache({ stdTTL: 0, checkperiod: 0 });

const REFRESH_MS = 15 * 60 * 1000; // 15 minutos
let lastSync = null;
let isSyncing = false;

async function syncAll() {
  if (isSyncing) return;
  isSyncing = true;
  console.log('[Cache] Sincronizando con ESPN...');

  try {
    const [rawMatches, rawStandings, rawNews] = await Promise.allSettled([
      espn.getScoreboard(),
      espn.getStandings(),
      espn.getNews(),
    ]);

    if (rawMatches.status === 'fulfilled' && rawMatches.value) {
      const matches = parser.parseMatches(rawMatches.value);
      if (matches.length > 0) cache.set('matches', matches);
    }

    if (rawStandings.status === 'fulfilled' && rawStandings.value) {
      const standings = parser.parseStandings(rawStandings.value);
      if (standings.length > 0) cache.set('standings', standings);
    }

    if (rawNews.status === 'fulfilled' && rawNews.value) {
      const news = parser.parseNews(rawNews.value);
      if (news.length > 0) cache.set('news', news);
    }

    lastSync = new Date();
    console.log('[Cache] Sync completo:', lastSync.toISOString());
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
