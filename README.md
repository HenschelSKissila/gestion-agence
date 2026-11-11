# Gestion Agence · v4.9

Application React + Vite, PWA et Supabase pour le suivi des comptes bloqués, candidats, prêts personnels et dettes.

## Démarrage
```bash
npm install
npm run dev
npm test
npm run build
```

## Mise en ligne
1. Fusionner la pull request dans `main` : Netlify reconstruit et publie le site automatiquement.
2. Sur l’appareil qui contient les bons montants : Paramètres → **Enregistrer**. Tous les appareils connectés au même compte les reçoivent.
3. Facultatif mais recommandé : dans Supabase → SQL Editor, exécuter `schema.sql` en entier (idempotent). C’est nécessaire uniquement pour **partager l’agence avec l’associé** ; sans cela les paramètres sont enregistrés dans le profil du compte et se synchronisent quand même.

Sécurité du partage : l’accès est accordé à l’email du compte connecté. Dans Supabase → Authentication, gardez la confirmation d’email activée (ou les inscriptions publiques désactivées).

## Identité
Le nom (« Gestion Agence ») et le logo sont livrés avec l’application : `src/lib/app.js` et `public/logo.svg`. Pour changer de logo, remplacer ce fichier.

## Anti-pause Supabase
Un projet Supabase gratuit est mis en pause après environ 7 jours sans activité. Deux mécanismes indépendants font une petite lecture dans la base :
- `netlify/functions/keepalive.mjs` — fonction planifiée Netlify, tous les jours ;
- `.github/workflows/keepalive.yml` — GitHub Actions, deux fois par semaine (GitHub désactive les tâches planifiées d’un dépôt resté 60 jours sans activité : la fonction Netlify reste alors seule).

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
