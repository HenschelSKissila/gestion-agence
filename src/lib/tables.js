import { Landmark, Users, ReceiptText, HandCoins } from 'lucide-react';
import { calcCompte, calcSimple } from './calculs';

/* Champs saisis : [clé, libellé, type, options]. Colonnes calculées : lecture seule, issues de calculs.js. */
export const TABLES = {
  comptes: {
    label: 'Comptes bloqués', short: 'Comptes', icon: Landmark, dateField: 'date_depot',
    title: r => [r.nom, r.prenom].filter(Boolean).join(' '),
    fields: [
      ['nom', 'Nom'], ['prenom', 'Prénom'], ['date_depot', 'Date de dépôt', 'date'],
      ['statut', 'Statut', 'select', ['en_cours', 'visa', 'refus']],
      ['montant_client', 'Montant client', 'number'], ['montant_bloque', 'Montant bloqué', 'number'],
      ['retire', 'Déjà retiré', 'number'], ['demarcheur', 'Démarcheur'], ['commission', 'Commission', 'number'],
      ['montant_rembourse', 'Remboursé', 'number'], ['notes', 'Notes']
    ],
    columns: [
      ['date_depot', 'Dépôt', 'date'], ['statut', 'Statut', 'statut'],
      ['montant_client', 'Montant client', 'money'], ['montant_bloque', 'Bloqué', 'money'],
      ['reste_bloque', 'Reste bloqué', 'money'], ['com_deduite', 'Commission', 'money'], ['gain', 'Gain', 'money'], ['reste_rembourser', 'À rembourser', 'money']
    ],
    compute: (r, settings) => calcCompte(r, settings)
  },
  candidats: {
    label: 'Candidats', short: 'Candidats', icon: Users, dateField: 'date_prevue',
    title: r => [r.nom, r.prenom].filter(Boolean).join(' '),
    fields: [
      ['nom', 'Nom'], ['prenom', 'Prénom'], ['telephone', 'Téléphone', 'tel'], ['date_prevue', 'Date prévue', 'date'],
      ['montant_prevu', 'Montant prévu', 'number'], ['statut', 'Statut', 'select', ['attente', 'prochain', 'visa', 'refus']], ['notes', 'Notes']
    ],
    columns: [['date_prevue', 'Date prévue', 'date'], ['statut', 'Statut', 'statut'], ['telephone', 'Téléphone'], ['montant_prevu', 'Montant prévu', 'money']],
    compute: () => ({})
  },
  dettes: {
    label: 'Dettes — je dois', short: 'Dettes', icon: ReceiptText, dateField: 'date_op',
    title: r => r.nom,
    fields: [['nom', 'Créancier'], ['date_op', 'Date', 'date'], ['montant', 'Montant emprunté', 'number'], ['rembourse', 'Déjà payé', 'number'], ['notes', 'Notes']],
    columns: [['date_op', 'Date', 'date'], ['montant', 'Montant', 'money'], ['rembourse', 'Déjà payé', 'money'], ['reste', 'Reste dû', 'money']],
    compute: r => calcSimple(r)
  },
  perso: {
    label: 'Perso — prêté (on me doit)', short: 'Prêts', icon: HandCoins, dateField: 'date_op',
    title: r => r.nom,
    fields: [['nom', 'Débiteur / affaire'], ['date_op', 'Date', 'date'], ['montant', 'Montant prêté', 'number'], ['rembourse', 'Déjà remboursé', 'number'], ['notes', 'Notes']],
    columns: [['date_op', 'Date', 'date'], ['montant', 'Montant', 'money'], ['rembourse', 'Remboursé', 'money'], ['reste', 'Reste dû', 'money']],
    compute: r => calcSimple(r)
  }
};

export const EMPTY_DATA = { comptes: [], candidats: [], dettes: [], perso: [] };

/** Prépare une ligne pour la base : nombres valides, dates vides -> null, statut par défaut. */
export function cleanRow(table, row) {
  const out = { ...row };
  for (const [k, , type, opts] of TABLES[table].fields) {
    const v = out[k];
    if (type === 'number') {
      const n = Number(String(v ?? '').replace(',', '.'));
      out[k] = Number.isFinite(n) && n >= 0 ? n : 0;
    } else if (type === 'date') out[k] = v || null;
    else if (type === 'select') out[k] = v || opts[0];
    else out[k] = v ?? '';
  }
  return out;
}
