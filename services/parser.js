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
  'cameroon': '🇨🇲', 'ghana': '🇬🇭', 'ivory coast': '🇨🇮', "côte d'ivoire": '🇨🇮',
  'cote d ivoire': '🇨🇮', 'saudi arabia': '🇸🇦', 'iran': '🇮🇷', 'australia': '🇦🇺',
  'poland': '🇵🇱', 'sweden': '🇸🇪', 'denmark': '🇩🇰', 'switzerland': '🇨🇭',
  'austria': '🇦🇹', 'serbia': '🇷🇸', 'turkey': '🇹🇷', 'czechia': '🇨🇿',
  'ukraine': '🇺🇦', 'hungary': '🇭🇺', 'scotland': '🏴', 'wales': '🏴',
  'slovakia': '🇸🇰', 'albania': '🇦🇱', 'slovenia': '🇸🇮', 'georgia': '🇬🇪',
  'romania': '🇷🇴', 'south africa': '🇿🇦', 'norway': '🇳🇴', 'vietnam': '🇻🇳',
  'cuba': '🇨🇺', 'jamaica': '🇯🇲', 'algeria': '🇩🇿', 'egypt': '🇪🇬',
  'cape verde': '🇨🇻', 'dr congo': '🇨🇩', 'congo dr': '🇨🇩', 'bosnia': '🇧🇦',
  'bosnia and herzegovina': '🇧🇦', 'tunisia': '🇹🇳', 'new zealand': '🇳🇿',
  'panama': '🇵🇦', 'haiti': '🇭🇹', 'costa rica': '🇨🇷', 'curacao': '🇨🇼',
  'curaçao': '🇨🇼', 'qatar': '🇶🇦', 'uzbekistan': '🇺🇿', 'jordan': '🇯🇴',
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

/* ---- Normaliza el status de ESPN (STATUS_SCHEDULED, STATUS_IN_PROGRESS,
   STATUS_FINAL, etc.) al formato simple que usa el frontend: pre/in/post ---- */
function normalizeStatus(rawName = '') {
  const n = rawName.toUpperCase();
  if (n.includes('IN_PROGRESS') || n.includes('HALFTIME') || n === 'STATUS_IN') return 'in';
  if (n.includes('FINAL') || n.includes('POSTPONED') || n.includes('CANCELED')) return 'post';
  return 'pre'; // SCHEDULED y cualquier otro caso futuro
}

/* ---- Traduce el slug de fase/grupo de ESPN a español ---- */
const ROUND_NAMES = {
  'round-of-32': 'Ronda de 32',
  'round-of-16': 'Octavos de Final',
  'quarterfinal': 'Cuartos de Final',
  'semifinal':    'Semifinal',
  'final':        'Final',
  'third-place':  'Tercer Puesto',
};

function translateGroup(slug = '') {
  if (ROUND_NAMES[slug]) return ROUND_NAMES[slug];
  if (/^group-([a-l])$/i.test(slug)) {
    const letter = slug.split('-')[1].toUpperCase();
    return `Grupo ${letter}`;
  }
  return slug || '';
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
      status:      normalizeStatus(status?.name),
      statusShort: status?.shortDetail || '',
      clock:       ev.status?.displayClock || '',
      period:      ev.status?.period || 0,
      venue:       comp?.venue?.fullName || '',
      city:        comp?.venue?.address?.city || '',
      group:       translateGroup(ev.season?.slug || ''),
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
