import { num } from './calculs';

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

/** Affichage monétaire. Passe par num() comme avant : aucune valeur calculée n'est modifiée. */
export const money = n => eur.format(num(n));

export function dateFr(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export const STATUTS = {
  en_cours: { label: 'En cours', tone: 'warn' },
  attente: { label: 'En attente', tone: 'warn' },
  prochain: { label: 'Prochain', tone: 'info' },
  visa: { label: 'Visa', tone: 'pos' },
  refus: { label: 'Refus', tone: 'neg' }
};

export const pct = n => `${Math.round(Number(n) * 100) / 100} %`;
