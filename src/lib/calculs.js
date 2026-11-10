/* Calculs financiers de Gestion Agence v4.8 — source unique des formules (voir FORMULES.md).
 *
 * Règles générales :
 *  - toute somme est faite en centimes entiers, puis reconvertie en euros ;
 *  - une SAISIE n'est jamais négative (une valeur invalide ou négative vaut 0) ;
 *  - un RÉSULTAT peut être négatif (déficit, perte) et n'est jamais ramené à 0.
 */
export const CENTS = 100;
export const FRAIS_VISA_DEFAUT = 127;
export const PCT_REFUS_DEFAUT = 100 / 3;

/** Montant saisi -> centimes entiers ; invalide ou négatif = 0. */
export function cents(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * CENTS) : 0;
}
/** Montant saisi -> euros arrondis au centime (jamais négatif). */
export function num(value) { return cents(value) / CENTS; }
export function round2(value) { return num(value); }
/** Résultat calculé -> euros arrondis au centime ; le signe est conservé. */
export function euros(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * CENTS) / CENTS + 0 : 0;
}
const fromCents = c => c / CENTS + 0;

const isDeleted = r => Boolean(r?.deleted_at || r?.deleted || r?.is_deleted || r?.soft_deleted);
function keyFor(r) {
  return r?.id ? `id:${r.id}` : `fallback:${JSON.stringify([r?.nom, r?.prenom, r?.date_depot, r?.date_op, r?.montant, r?.montant_client])}`;
}
/** Lignes actives : ni supprimées, ni en double. */
export function activeRows(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter(r => {
    if (!r || isDeleted(r)) return false;
    const k = keyFor(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
const sumC = (rows, fn) => activeRows(rows).reduce((s, r) => s + fn(r), 0);

export function reste(montant, rembourse) { return Math.max(0, cents(montant) - cents(rembourse)) / CENTS; }
export function calcSimple(r = {}) { return { reste: reste(r.montant, r.rembourse) }; }

function pctRefus(p) {
  const v = p?.pct_refus;
  const n = v === null || v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : PCT_REFUS_DEFAUT;
}
function fraisVisaParam(p) {
  const v = p?.fraisBancairesCompteBloqueVisa ?? p?.frais_bancaires_compte_bloque_visa;
  return v === null || v === undefined || v === '' ? cents(FRAIS_VISA_DEFAUT) : cents(v);
}

/** Détail d'un dossier « compte bloqué », en centimes. */
function compteCents(c = {}, p = {}) {
  const client = cents(c.montant_client), bloque = cents(c.montant_bloque), retire = cents(c.retire);
  const commissionSaisie = cents(c.commission), rembourse = cents(c.montant_rembourse);
  const visa = c.statut === 'visa', refus = c.statut === 'refus', enCours = !visa && !refus;

  // Compte bloqué : les frais ne s'appliquent qu'au statut visa, dans la limite de l'encours.
  const resteAvantFrais = Math.max(0, bloque - retire);
  const frais = visa ? Math.min(fraisVisaParam(p), resteAvantFrais) : 0;
  const resteBloque = resteAvantFrais - frais;

  let commission = 0, garde = 0, aRembourser = 0, gain = 0;
  if (visa) {
    commission = Math.min(client, commissionSaisie);
    gain = client - commission - frais; // peut être négatif : le dossier coûte plus qu'il ne rapporte
  } else if (refus) {
    garde = Math.round(client * pctRefus(p) / 100);
    aRembourser = client - garde;
    commission = p?.commissionSurRefus === false ? 0 : Math.min(garde, commissionSaisie);
    gain = garde - commission;
  }
  return {
    resteBloque, frais, commission, garde, aRembourser, gain,
    gainVisa: visa ? gain : 0,
    resteRembourser: Math.max(0, aRembourser - rembourse),
    acompte: enCours ? client : 0 // versement d'un client dont le dossier n'est pas encore tranché
  };
}

export function calcCompte(c = {}, p = {}) {
  const d = compteCents(c, p);
  return {
    reste_bloque: fromCents(d.resteBloque),
    frais_visa: fromCents(d.frais),
    com_deduite: fromCents(d.commission),
    garde_refus: fromCents(d.garde),
    gain_visa: fromCents(d.gainVisa),
    gain: fromCents(d.gain),
    a_rembourser: fromCents(d.aRembourser),
    reste_rembourser: fromCents(d.resteRembourser),
    acompte_en_cours: fromCents(d.acompte)
  };
}

/**
 * Solde de contrôle : ce qui reste du capital une fois retirés les investissements des associés
 * et le gain à distribuer. Zéro = tout l'argent est expliqué ; positif = excédent ; négatif = déficit.
 */
export function controleCompte({ capital = 0, totalAssocies = 0, gainDistribue = 0 } = {}) {
  const termes = { capital: euros(capital), totalAssocies: num(totalAssocies), gainDistribue: num(gainDistribue) };
  const resultat = fromCents(Math.round(termes.capital * CENTS) - cents(termes.totalAssocies) - cents(termes.gainDistribue));
  return { termes, resultat, formule: 'capital global − investissements des associés − gain à distribuer' };
}

/** Répartit le gain en centimes ; le reste d'arrondi va aux plus grandes fractions. Jamais de dividende négatif. */
export function dividendes({ gain = 0, associes = [], excedentControle = 0 } = {}) {
  const list = activeRows(associes);
  if (!list.length) return [];
  const gainNumber = Number(gain);
  const valide = Number.isFinite(gainNumber) && gainNumber >= 0;
  const total = valide ? cents(gainNumber) : 0;
  const excedent = Math.max(0, cents(excedentControle)) / CENTS;
  if (!valide) {
    return list.map((a, i) => ({ ...a, part: 0, gain: 0, excedentAttribue: i === 0 ? excedent : 0, nouveauSolde: euros(num(a.investissement) + (i === 0 ? excedent : 0)) }));
  }
  const weights = list.map(a => Math.max(0, Number(a.part) || 0));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => (wsum ? total * w / wsum : total / list.length));
  const base = raw.map(Math.floor);
  const rest = total - base.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, f: v - base[i] })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let i = 0; i < rest; i++) base[order[i % order.length].i]++;
  return list.map((a, i) => {
    const gainAssocie = base[i] / CENTS, extra = i === 0 ? excedent : 0;
    return { ...a, part: wsum ? weights[i] / wsum * 100 : 100 / list.length, gain: gainAssocie, excedentAttribue: extra, nouveauSolde: euros(num(a.investissement) + gainAssocie + extra) };
  });
}

export function sortRows(rows = [], field = 'date_depot', direction = 'desc') {
  return activeRows(rows).slice().sort((a, b) => {
    const av = a?.[field] ?? '', bv = b?.[field] ?? '';
    return String(av).localeCompare(String(bv), 'fr', { numeric: true }) * (direction === 'asc' ? 1 : -1);
  });
}

const CANDIDATS_EN_COURS = ['attente', 'prochain'];

export function totaux({ comptes = [], dettes = [], perso = [], candidats = [], parametres = {} } = {}) {
  const C = activeRows(comptes).map(c => ({ statut: c.statut, ...compteCents(c, parametres) }));
  const somme = key => C.reduce((s, c) => s + c[key], 0);

  // Actifs
  const banqueC = { n26: cents(parametres.n26), sparkasse: cents(parametres.sparkasse), commerzbank: cents(parametres.commerzbank), wise: cents(parametres.wise) };
  const banquesC = Object.values(banqueC).reduce((s, v) => s + v, 0);
  const bloqueC = somme('resteBloque');
  const persoC = sumC(perso, r => cents(calcSimple(r).reste));
  const actifsC = banquesC + bloqueC + persoC;

  // Passifs : tout ce qui est dû à des tiers
  const dettesC = sumC(dettes, r => cents(calcSimple(r).reste));
  const resteRembC = somme('resteRembourser');
  const acomptesC = somme('acompte');
  const candidatsC = sumC(candidats, r => (CANDIDATS_EN_COURS.includes(r.statut) ? cents(r.montant_prevu) : 0));
  const passifsC = dettesC + resteRembC + acomptesC + candidatsC;

  const capitalC = actifsC - passifsC;
  const gainC = somme('gain');
  const gainDistribueC = Math.max(0, gainC);

  const associes = [1, 2].map(i => ({
    nom: parametres[`associe${i}Nom`] || `Associé ${i}`,
    part: parametres[`associe${i}Part`],
    investissement: parametres[`associe${i}Investissement`]
  }));
  const totalAssociesC = associes.reduce((s, a) => s + cents(a.investissement), 0);

  const controle = controleCompte({ capital: fromCents(capitalC), totalAssocies: fromCents(totalAssociesC), gainDistribue: fromCents(gainDistribueC) });
  const excedentAttribue = Math.max(0, controle.resultat);
  const associesCalcules = dividendes({ gain: fromCents(gainDistribueC), associes, excedentControle: excedentAttribue });
  const soldesAssociesC = associesCalcules.reduce((s, a) => s + Math.round(a.nouveauSolde * CENTS), 0);

  return {
    banques: fromCents(banquesC),
    banqueDetails: Object.fromEntries(Object.entries(banqueC).map(([k, v]) => [k, fromCents(v)])),
    disponible: fromCents(banquesC),
    bloque: fromCents(bloqueC),
    encoursComptesBloques: fromCents(bloqueC),
    perso: fromCents(persoC),
    actifs: fromCents(actifsC),
    dettes: fromCents(dettesC),
    resteRemb: fromCents(resteRembC),
    acomptesEnCours: fromCents(acomptesC),
    candidatsEnCours: fromCents(candidatsC),
    passifs: fromCents(passifsC),
    capital: fromCents(capitalC),
    gainNet: fromCents(gainC),
    gainDistribue: fromCents(gainDistribueC),
    fraisVisa: fromCents(somme('frais')),
    commissions: fromCents(somme('commission')),
    totalAssocies: fromCents(totalAssociesC),
    controle,
    excedentControle: excedentAttribue,
    excedentAttribue,
    associesCalcules,
    nouveauSoldeMoi: associesCalcules[0]?.nouveauSolde || 0,
    nouveauSoldeAxel: associesCalcules[1]?.nouveauSolde || 0,
    soldesAssocies: fromCents(soldesAssociesC),
    solvabilite: fromCents(capitalC - soldesAssociesC),
    nbCours: C.filter(c => c.statut === 'en_cours').length,
    nbVisa: C.filter(c => c.statut === 'visa').length,
    nbRefus: C.filter(c => c.statut === 'refus').length,
    nbCandidats: activeRows(candidats).length
  };
}
