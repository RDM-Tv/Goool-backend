/* ===========================
   espnService.js — Cliente ESPN
   Corre en el servidor, sin problema de CORS
   =========================== */

const fetch = require('node-fetch');

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const WC   = 'fifa.world';

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://www.espn.com/',
    },
    timeout: 10000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

/* ---- Scoreboard: intenta hoy primero, luego rango completo del Mundial ---- */
async function getScoreboard() {
  const today = todayStr();
  const urls = [
    `${BASE}/${WC}/scoreboard?dates=${today}&limit=50`,
    `${BASE}/${WC}/scoreboard?limit=200&dates=20260611-20260719`,
  ];

  for (const url of urls) {
    try {
      const data = await fetchJSON(url);
      if (data?.events?.length > 0) return data;
    } catch (e) {
      console.warn('[ESPN] scoreboard fallo:', e.message);
    }
  }
  return null;
}

/* ---- Standings ---- */
async function getStandings() {
  const url = `${BASE}/${WC}/standings`;
  try {
    return await fetchJSON(url);
  } catch (e) {
    console.warn('[ESPN] standings fallo:', e.message);
    return null;
  }
}

/* ---- Noticias: español primero, inglés como fallback ---- */
async function getNews() {
  const urls = [
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${WC}/news?limit=10&lang=es&region=ec`,
    `${BASE}/${WC}/news?limit=10`,
  ];
  for (const url of urls) {
    try {
      const data = await fetchJSON(url);
      if (data?.articles?.length > 0) return data;
    } catch (e) {
      console.warn('[ESPN] news fallo:', e.message);
    }
  }
  return null;
}

module.exports = { getScoreboard, getStandings, getNews };
