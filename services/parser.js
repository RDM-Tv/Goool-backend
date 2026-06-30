/* ===========================
   parser.js — Normaliza datos ESPN
   =========================== */

const FLAG_MAP = {
  'ecuador': '🇪🇨', 'argentina': '🇦🇷', 'brazil': '🇧🇷', 'brasil': '🇧🇷',
  'france': '🇫🇷', 'germany': '🇩🇪', 'spain': '🇪🇸', 'england': '🏴',
  'portugal': '🇵🇹', 'netherlands': '🇳🇱', 'belgium': '🇧🇪', 'croatia': '🇭🇷',
  'morocco': '🇲🇦', 'japan': '🇯🇵', 'south korea': '🇰🇷', 'usa': '🇺🇸',
  'united states': '🇺🇸', 'canada': '🇨🇦', 'mexico': '🇲🇽', 'colombia': '🇨🇴',
  'uruguay': '🇺🇾', 'chile': '🇨🇱', 'peru': '🇵🇪', 'paraguay': '🇵🇾',
  'venezuela': '🇻🇪', 'bolivia': '🇧🇴', 'senegal': '🇸🇳', 'nigeria': '🇳🇬',
  'cameroon': '🇨🇲', 'ghana': '🇬🇭', 'ivory coast': '🇨🇮', 'saudi arabia': '🇸🇦',
  'iran': '🇮🇷', 'australia': '🇦🇺', 'poland': '🇵🇱', 'sweden': '🇸🇪',
  'denmark': '🇩🇰', 'switzerland': '🇨🇭', 'austria': '🇦🇹', 'serbia': '🇷🇸',
  'turkey': '🇹🇷', 'czechia': '🇨🇿', 'ukraine': '🇺🇦', 'hungary': '🇭🇺',
  'scotland': '🏴', 'wales': '🏴', 'slovakia': '🇸🇰', 'albania': '🇦🇱',
  'slovenia': '🇸🇮', 'georgia': '🇬🇪', 'romania': '🇷🇴', 'south africa': '🇿🇦',
  'norway': '🇳🇴', 'vietnam': '🇻🇳', 'cuba': '🇨🇺', 'jamaica': '🇯🇲',
};

function countryFlag(name = '') {
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(FLAG_MAP)) {
    if (n.includes(k)) return v;
  }
  return '🏳️';
}

function timeAgo(date) {
  const diff = (Date.now() - date) / 1000;
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

function statValue(entry, abbr) {
  const s = entry.stats?.find(x => x.abbreviation === abbr || x.name === abbr);
  return parseInt(s?.value ?? 0);
}

/* ---- Partidos ---- */
function parseMatches(data) {
  if (!data?.events) return [];
  return data.events.map(ev => {
    const comp   = ev.competitions?.[0];
    const home   = comp?.competitors?.find(c => c.homeAway === 'home');
    const away   = comp?.competitors?.find(c => c.homeAway === 'away');
    const status = ev.status?.type;

    return {
      id:          ev.id,
      name:        ev.name,
      date:        ev.date,
      status:      status?.name || 'pre',
      statusShort: status?.shortDetail || '',
      clock:       ev.status?.displayClock || '',
      period:      ev.status?.period || 0,
      venue:       comp?.venue?.fullName || '',
      city:        comp?.venue?.address?.city || '',
      group:       ev.season?.slug || '',
      home: {
        id:     home?.id,
        name:   home?.team?.shortDisplayName || home?.team?.displayName || '',
        flag:   countryFlag(home?.team?.displayName),
        score:  home?.score ?? null,
        winner: home?.winner || false,
      },
      away: {
        id:     away?.id,
        name:   away?.team?.shortDisplayName || away?.team?.displayName || '',
        flag:   countryFlag(away?.team?.displayName),
        score:  away?.score ?? null,
        winner: away?.winner || false,
      },
    };
  });
}

/* ---- Tabla de posiciones ---- */
function parseStandings(data) {
  if (!data?.standings) return [];
  return data.standings.map(g => ({
    name: g.name || g.displayName || 'Grupo',
    teams: (g.entries || []).map((e, idx) => ({
      pos:  idx + 1,
      name: e.team?.shortDisplayName || e.team?.displayName || '',
      flag: countryFlag(e.team?.displayName),
      pj:   statValue(e, 'GP'),
      g:    statValue(e, 'W'),
      em:   statValue(e, 'T'),
      p:    statValue(e, 'L'),
      gf:   statValue(e, 'GF'),
      gc:   statValue(e, 'GA'),
      gd:   statValue(e, 'GD'),
      pts:  statValue(e, 'PTS'),
    })),
  }));
}

/* ---- Noticias ---- */
function parseNews(data) {
  if (!data?.articles) return [];
  return data.articles.slice(0, 10).map(a => ({
    id:     a.id,
    title:  a.headline || a.title || '',
    source: a.source || 'ESPN',
    link:   a.links?.web?.href || '#',
    time:   a.published ? timeAgo(new Date(a.published)) : '',
    published: a.published || null,
  }));
}

module.exports = { parseMatches, parseStandings, parseNews, countryFlag };
