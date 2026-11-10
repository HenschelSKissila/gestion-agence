# Gestion Agence · v4.8

Application React + Vite, PWA et Supabase pour le suivi des comptes bloqués, candidats, prêts personnels et dettes.

## Démarrage
```bash
npm install
npm run dev
npm test
npm run build
```

## Mise à jour v4.8 — à faire une fois
1. Dans Supabase → SQL Editor, exécuter `schema.sql` en entier (idempotent, peut être relancé sans risque).
2. Ouvrir l’application sur l’appareil qui contient les bons montants → Paramètres → **Enregistrer**.
3. Pour l’associé : Paramètres → **Accès de l’associé** → saisir l’email de son compte. Il se connecte ensuite avec ses propres identifiants.

Sécurité du partage : l’accès est accordé à l’email du compte connecté. Dans Supabase → Authentication, gardez la confirmation d’email activée (ou les inscriptions publiques désactivées) pour que personne ne puisse créer un compte avec l’email de l’associé à sa place.

## Synchronisation et hors ligne
- Paramètres et dossiers sont stockés par agence dans Supabase et partagés entre les appareils et avec l’associé invité (lecture seule ou modification).
- Une copie locale permet d’ouvrir l’application sans réseau ; les modifications hors ligne sont renvoyées au retour de la connexion.
- La déconnexion efface toutes les données de l’appareil.

## Structure
- `src/lib/calculs.js` : formules · `settings.js` : paramètres · `workspace.js` : partage et copie locale · `storage.js` : file hors ligne · `tables.js` : registres.
- `src/components/` : écrans · `src/styles.css` : thèmes clair/sombre par variables CSS.
- `tests/` : `npm test` (formules, synchronisation, choix de l’agence).

## Calculs métier
Toutes les formules sont définies dans `FORMULES.md` et implémentées dans `src/lib/calculs.js`.
