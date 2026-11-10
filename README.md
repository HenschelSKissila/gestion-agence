# Gestion Agence · v4.7

Application React + Vite, PWA et Supabase pour le suivi des comptes bloqués, candidats, prêts personnels et dettes.

## Démarrage
```bash
npm install
npm run dev
npm test
npm run build
```

## Mise à jour v4.7 — à faire une fois
1. Dans Supabase → SQL Editor, exécuter `schema.sql` en entier (idempotent). Il crée la table `parametres_utilisateur` (une ligne JSON par compte, protégée par RLS).
2. Ouvrir l’application sur l’appareil qui contient les bons montants → Paramètres → **Enregistrer**. Les autres appareils du même compte les reçoivent au chargement ou au retour au premier plan.

## Synchronisation
- Tous les paramètres (banques, associés, taux, frais, nom, logo) sont stockés par compte dans Supabase ; `localStorage` ne sert plus que de cache hors ligne.
- Dernier enregistrement gagnant ; une modification faite hors ligne est renvoyée automatiquement au retour du réseau.
- La file hors ligne des dossiers est rejouée au chargement ; une opération n’est retirée qu’une fois acceptée ou refusée par la base.

## Structure
- `src/lib/calculs.js` : formules (inchangées en v4.7) · `src/lib/settings.js` : paramètres et synchronisation · `src/lib/storage.js` : file hors ligne · `src/lib/tables.js` : définition des registres.
- `src/components/` : écrans · `src/styles.css` : thèmes clair/sombre par variables CSS.

## Calculs métier
- Disponible = banques uniquement : N26 + Sparkasse + Commerzbank + Wise.
- Capital global = banques + comptes bloqués récupérables après frais visa de 127 € + perso restant dû (argent prêté) − dettes restantes (argent que je dois).
- Solde de contrôle = banques + comptes bloqués − associés − dettes − refus non remboursés − candidats en attente ; l’état excédent/déficit/équilibré est explicite.
- Solde de contrôle excédentaire : si K > 0, l’excédent est attribué uniquement à l’affichage du solde après investissement de l’associé 1 (ligne séparée « dont excédent attribué »). Un déficit ou zéro n’ajoute rien.
- Solvabilité = capital global − soldes associés calculés − candidats en cours ; l’excédent de contrôle est inclus uniquement dans le solde calculé de l’associé 1.
- Libellés : **Perso — prêté (on me doit)** et **Dettes — je dois**.
- Capital global et contrôle restent inchangés par l’attribution d’affichage ; aucun double comptage. Les soldes des quatre banques restent saisissables dans les paramètres.
- Commission démarcheur soustraite du montant client, zéro si aucun versement client. Dividendes jamais négatifs.

Voir `FORMULES.md` pour les définitions exactes.
