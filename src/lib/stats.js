import { activeRows, calcCompte, euros } from './calculs.js';

/**
 * Gain net par mois de dépôt, pour les dossiers tranchés (visa ou refus).
 * Lecture seule : chaque gain vient de calcCompte, aucune formule n'est refaite ici.
 * Retourne les `max` derniers mois ayant des données, du plus ancien au plus récent.
 */
export function gainsParMois(comptes = [], parametres = {}, max = 12) {
  const byMonth = new Map();
  let sansDate = 0;
  for (const c of activeRows(comptes)) {
    if (c.statut !== 'visa' && c.statut !== 'refus') continue;
    const mois = /^\d{4}-\d{2}/.test(c.date_depot || '') ? c.date_depot.slice(0, 7) : null;
    if (!mois) { sansDate++; continue; }
    const m = byMonth.get(mois) || { mois, gain: 0, visas: 0, refus: 0 };
    m.gain += Math.round(calcCompte(c, parametres).gain * 100);
    m[c.statut === 'visa' ? 'visas' : 'refus']++;
    byMonth.set(mois, m);
  }
  const mois = [...byMonth.values()].sort((a, b) => a.mois.localeCompare(b.mois)).slice(-max).map(m => ({ ...m, gain: euros(m.gain / 100) }));
  return { mois, sansDate };
}

/** Paliers « ronds » d'un axe couvrant [min, max], zéro inclus. */
export function axisTicks(min, max, count = 4) {
  const lo = Math.min(0, min), hi = Math.max(0, max);
  if (hi === lo) return [0, 1];
  const raw = (hi - lo) / count, pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(k => k * pow).find(s => s >= raw);
  const ticks = [];
  for (let v = Math.floor(lo / step) * step; v < hi + step - 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}
