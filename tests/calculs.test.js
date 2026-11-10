import assert from 'node:assert/strict';
import { calcCompte, calcSimple, controleCompte, totaux, dividendes, activeRows, sortRows, cents, num, euros } from '../src/lib/calculs.js';

const eq = assert.equal;
let groupes = 0;
const groupe = (_nom, fn) => { fn(); groupes++; };

groupe('saisies : jamais négatives ; résultats : signe conservé', () => {
  eq(cents(-5), 0); eq(cents('abc'), 0); eq(num('12.345'), 12.35);
  eq(euros(-6000), -6000); eq(euros(NaN), 0); assert.ok(Object.is(euros(-0.001), 0));
});

groupe('compte bloqué récupérable et frais visa', () => {
  eq(calcCompte({ statut: 'visa', montant_bloque: 12131 }).reste_bloque, 12004);
  eq(calcCompte({ statut: 'visa', montant_bloque: 12131 }, { fraisBancairesCompteBloqueVisa: 0 }).reste_bloque, 12131);
  eq(calcCompte({ statut: 'refus', montant_bloque: 12131 }).reste_bloque, 12131);
  eq(calcCompte({ statut: 'en_cours', montant_bloque: 1000, retire: 1200 }).reste_bloque, 0);
  // Frais plafonnés à l'encours : jamais de reste négatif, et aucun frais si tout est retiré.
  const petit = calcCompte({ statut: 'visa', montant_bloque: 100 });
  eq(petit.reste_bloque, 0); eq(petit.frais_visa, 100);
  eq(calcCompte({ statut: 'visa', montant_bloque: 500, retire: 500 }).frais_visa, 0);
  // Paramètre vide ou absent -> 127 € par défaut.
  eq(calcCompte({ statut: 'visa', montant_bloque: 1000 }, { fraisBancairesCompteBloqueVisa: '' }).frais_visa, 127);
});

groupe('gain visa = montant client − commission − frais visa', () => {
  eq(calcCompte({ statut: 'visa', montant_client: 3000, commission: 200 }).gain, 2800); // pas d'encours : pas de frais
  eq(calcCompte({ statut: 'visa', montant_client: 3000, commission: 200, montant_bloque: 11904 }).gain, 2673);
  eq(calcCompte({ statut: 'visa', montant_client: 0, commission: 200 }).com_deduite, 0);
  eq(calcCompte({ statut: 'visa', montant_client: 100, commission: 200 }).gain, 0);
  eq(calcCompte({ statut: 'visa', montant_client: 100, commission: 200, montant_bloque: 11904 }).gain, -127); // perte réelle
  eq(calcCompte({ statut: 'visa', montant_client: -10, commission: NaN }).gain, 0);
});

groupe('refus : part gardée, remboursement, commission', () => {
  const p = { pct_refus: 100 / 3 };
  eq(calcCompte({ statut: 'refus', montant_client: 3000 }, p).garde_refus, 1000);
  eq(calcCompte({ statut: 'refus', montant_client: 3000 }, p).a_rembourser, 2000);
  eq(calcCompte({ statut: 'refus', montant_client: 3000, montant_rembourse: 500 }, p).reste_rembourser, 1500);
  eq(calcCompte({ statut: 'refus', montant_client: 3000, montant_rembourse: 9999 }, p).reste_rembourser, 0);
  eq(calcCompte({ statut: 'refus', montant_client: 3000, commission: 200 }, p).gain, 800);
  eq(calcCompte({ statut: 'refus', montant_client: 3000, commission: 5000 }, p).gain, 0); // plafonnée à la part gardée
  eq(calcCompte({ statut: 'refus', montant_client: 3000, commission: 200 }, { ...p, commissionSurRefus: false }).gain, 1000);
  eq(calcCompte({ statut: 'refus', montant_client: 3000 }, { pct_refus: '' }).garde_refus, 1000); // taux vide -> défaut
  eq(calcCompte({ statut: 'refus', montant_client: 3000 }, { pct_refus: 0 }).garde_refus, 0);
});

groupe('dossier en cours : acompte dû, aucun gain', () => {
  const c = calcCompte({ statut: 'en_cours', montant_client: 1500, commission: 200 });
  eq(c.gain, 0); eq(c.acompte_en_cours, 1500); eq(c.com_deduite, 0);
  eq(calcCompte({ statut: 'visa', montant_client: 1500 }).acompte_en_cours, 0);
});

groupe('prêts et dettes', () => {
  eq(calcSimple({ montant: 400, rembourse: 100 }).reste, 300);
  eq(calcSimple({ montant: 200, rembourse: 250 }).reste, 0);
});

groupe('lignes actives, tri, sommes en centimes', () => {
  eq(activeRows([{ id: 'a' }, { id: 'a' }, { id: 'b', deleted_at: 'x' }, null]).length, 1);
  eq(sortRows([{ id: '1', date_depot: '2024-01-01' }, { id: '2', date_depot: '2025-01-01' }])[0].id, '2');
  eq(totaux({ comptes: [{ id: 'a', statut: 'en_cours', montant_bloque: .1 }, { id: 'b', statut: 'en_cours', montant_bloque: .2 }] }).bloque, .3);
  eq(totaux({ parametres: { n26: .1, sparkasse: .2 } }).banques, .3);
  eq(totaux({ comptes: [{ id: 'a', statut: 'en_cours', montant_bloque: 1000, retire: 100 }, { id: 'a', statut: 'en_cours', montant_bloque: 999 }, { id: 'x', statut: 'en_cours', montant_bloque: 500, deleted_at: 'x' }] }).bloque, 900);
});

const base = {
  comptes: [
    { id: 'v', statut: 'visa', montant_client: 3000, montant_bloque: 11904, commission: 200 },
    { id: 'r', statut: 'refus', montant_client: 3000, montant_bloque: 11904, montant_rembourse: 500 },
    { id: 'e', statut: 'en_cours', montant_client: 1500, montant_bloque: 11904 }
  ],
  dettes: [{ id: 'd', montant: 5000, rembourse: 1000 }],
  perso: [{ id: 'p', montant: 800, rembourse: 300 }],
  candidats: [{ id: 'c1', statut: 'attente', montant_prevu: 1200 }, { id: 'c2', statut: 'prochain', montant_prevu: 300 }, { id: 'c3', statut: 'visa', montant_prevu: 999 }]
};
const banques = { n26: 1500.5, sparkasse: 4200, commerzbank: 320, wise: 200 };

groupe('exemple complet : actifs, passifs, capital, gain', () => {
  const t = totaux({ ...base, parametres: { ...banques, associe1Investissement: 20000, associe2Investissement: 15000, associe1Part: 50, associe2Part: 50 } });
  eq(t.banques, 6220.5); eq(t.disponible, 6220.5);
  eq(t.bloque, 35585);            // 11 777 + 11 904 + 11 904
  eq(t.perso, 500); eq(t.actifs, 42305.5);
  eq(t.dettes, 4000); eq(t.resteRemb, 1500); eq(t.acomptesEnCours, 1500); eq(t.candidatsEnCours, 1500);
  eq(t.passifs, 8500); eq(t.capital, 33805.5);
  eq(t.gainNet, 3673);            // visa 3000 − 200 − 127, refus 1000
  eq(t.fraisVisa, 127); eq(t.commissions, 200);
  eq(t.nbCours, 1); eq(t.nbVisa, 1); eq(t.nbRefus, 1); eq(t.nbCandidats, 3);
});

groupe('déficit : affiché négatif, aucun excédent, solvabilité négative', () => {
  const t = totaux({ ...base, parametres: { ...banques, associe1Investissement: 20000, associe2Investissement: 15000, associe1Part: 50, associe2Part: 50 } });
  eq(t.controle.resultat, -4867.5); // 33 805,50 − 35 000 − 3 673
  eq(t.excedentAttribue, 0);
  assert.deepEqual(t.associesCalcules.map(a => a.gain), [1836.5, 1836.5]);
  assert.deepEqual([t.nouveauSoldeMoi, t.nouveauSoldeAxel], [21836.5, 16836.5]);
  eq(t.soldesAssocies, 38673); eq(t.solvabilite, -4867.5);
});

groupe('excédent : attribué à l’associé 1 sans double comptage', () => {
  const t = totaux({ ...base, parametres: { ...banques, associe1Investissement: 10000, associe2Investissement: 5000, associe1Part: 50, associe2Part: 50 } });
  eq(t.controle.resultat, 15132.5); eq(t.excedentAttribue, 15132.5);
  assert.deepEqual([t.nouveauSoldeMoi, t.nouveauSoldeAxel], [26969, 6836.5]);
  eq(t.soldesAssocies, t.capital); // les soldes des associés n'excèdent jamais le capital
  eq(t.solvabilite, 0);
});

groupe('capital et contrôle négatifs ne sont plus ramenés à zéro', () => {
  const t = totaux({ dettes: [{ id: 'd', montant: 9000 }], parametres: { n26: 1000 } });
  eq(t.capital, -8000); eq(t.controle.resultat, -8000); eq(t.solvabilite, -8000);
  eq(controleCompte({ capital: 1000, totalAssocies: 5000, gainDistribue: 2000 }).resultat, -6000);
  eq(controleCompte({ capital: 1000, totalAssocies: 400, gainDistribue: 100 }).resultat, 500);
});

groupe('perte : gain net négatif, aucun dividende', () => {
  const t = totaux({ comptes: [{ id: 'v', statut: 'visa', montant_client: 100, commission: 200, montant_bloque: 11904 }], parametres: { n26: 100, associe1Investissement: 11904 } });
  eq(t.gainNet, -127); eq(t.gainDistribue, 0);
  assert.deepEqual(t.associesCalcules.map(a => a.gain), [0, 0]);
  eq(t.capital, 11877); eq(t.controle.resultat, -27);
});

groupe('dividendes : arrondis, parts, cas invalides', () => {
  const ds = dividendes({ gain: .1, associes: [{ id: '1', part: 1 }, { id: '2', part: 1 }, { id: '3', part: 1 }] });
  assert.deepEqual(ds.map(x => x.gain), [.04, .03, .03]);
  assert.deepEqual(dividendes({ gain: 100, associes: [{ id: '1', part: 70 }, { id: '2', part: 30 }] }).map(x => x.gain), [70, 30]);
  assert.deepEqual(dividendes({ gain: -10, associes: [{ id: '1', part: 50 }, { id: '2', part: 50 }] }).map(x => x.gain), [0, 0]);
  assert.deepEqual(dividendes({ gain: NaN, associes: [{ id: '1', part: 50 }] }).map(x => x.part), [0]);
  const ex = dividendes({ gain: 100, excedentControle: 25, associes: [{ id: '1', part: 50, investissement: 10 }, { id: '2', part: 50, investissement: 20 }] });
  assert.deepEqual(ex.map(x => x.excedentAttribue), [25, 0]); assert.deepEqual(ex.map(x => x.nouveauSolde), [85, 70]);
  assert.deepEqual(dividendes({ gain: 100, excedentControle: -25, associes: [{ id: '1', part: 100, investissement: 10 }] }).map(x => x.excedentAttribue), [0]);
  eq(dividendes({ gain: 100, associes: [] }).length, 0);
});

groupe('identité comptable sur données aléatoires', () => {
  let seed = 42; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.round(seed / 2147483648 * n * 100) / 100; };
  for (let k = 0; k < 300; k++) {
    const statuts = ['en_cours', 'visa', 'refus'];
    const t = totaux({
      comptes: Array.from({ length: 6 }, (_, i) => ({ id: 'c' + i, statut: statuts[Math.floor(rnd(2.99))], montant_client: rnd(4000), montant_bloque: rnd(12000), retire: rnd(6000), commission: rnd(400), montant_rembourse: rnd(1500) })),
      dettes: [{ id: 'd', montant: rnd(9000), rembourse: rnd(3000) }], perso: [{ id: 'p', montant: rnd(3000), rembourse: rnd(1000) }],
      candidats: [{ id: 'k', statut: 'attente', montant_prevu: rnd(2000) }],
      parametres: { n26: rnd(20000), wise: rnd(5000), pct_refus: rnd(100), associe1Investissement: rnd(30000), associe2Investissement: rnd(30000), associe1Part: rnd(100), associe2Part: rnd(100) }
    });
    const c = v => Math.round(v * 100);
    eq(c(t.capital), c(t.actifs) - c(t.passifs));
    eq(c(t.controle.resultat), c(t.capital) - c(t.totalAssocies) - c(t.gainDistribue));
    eq(c(t.associesCalcules[0].gain) + c(t.associesCalcules[1].gain), c(t.gainDistribue));
    eq(c(t.solvabilite), Math.min(0, c(t.controle.resultat))); // solvable si et seulement si pas de déficit
  }
});

console.log(`calculs.test.js: ${groupes} groupes OK`);
