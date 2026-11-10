# Formules financières — v4.8

Source unique : `src/lib/calculs.js`, vérifiée par `tests/calculs.test.js` (`npm test`).

Règles générales :
- toutes les sommes sont faites en centimes entiers, puis reconverties en euros ;
- une **saisie** n'est jamais négative (valeur invalide ou négative = 0) ;
- un **résultat** peut être négatif (déficit, perte) et est affiché tel quel ;
- les lignes supprimées et les doublons sont ignorés.

## Par dossier « compte bloqué »
| Élément | Formule |
|---|---|
| Encours avant frais | `max(0, montant_bloqué − déjà_retiré)` |
| Frais visa | statut visa uniquement : `min(frais_paramètre, encours avant frais)` — 127 € par défaut |
| Compte bloqué récupérable | `encours avant frais − frais visa` |
| Commission (visa) | `min(montant_client, commission_saisie)` |
| **Gain visa** | `montant_client − commission − frais visa` (peut être négatif) |
| Part gardée (refus) | `montant_client × taux_gardé / 100` |
| À rembourser (refus) | `montant_client − part gardée` ; reste = `max(0, à rembourser − déjà remboursé)` |
| Commission (refus) | `min(part gardée, commission_saisie)` si l'option « commission due aussi en cas de refus » est cochée, sinon 0 |
| **Gain refus** | `part gardée − commission` |
| Acompte (en cours) | `montant_client` : dû au client tant que le dossier n'est pas tranché ; gain = 0 |

## Agence
- **Banques** `B = N26 + Sparkasse + Commerzbank + Wise` ; **Disponible** `= B`.
- **Actifs** `A = B + comptes bloqués récupérables + prêts perso restant dus`.
- **Passifs** `P = dettes restantes + refus non remboursés + acomptes des dossiers en cours + argent des candidats en cours`.
  Candidats en cours = statuts « attente » et « prochain ».
- **Capital global** `C = A − P`.
- **Gain net** `G = Σ gains des dossiers` ; **gain à distribuer** `= max(0, G)`.
- **Dividendes** : gain à distribuer réparti selon les parts, au centime près (le reste d'arrondi va aux plus grandes fractions). Aucun dividende si `G ≤ 0`.
- **Solde de contrôle** `K = C − investissements des associés − gain à distribuer`.
  `K = 0` : tout l'argent est expliqué. `K > 0` : excédent. `K < 0` : déficit (argent manquant ou saisie à corriger).
- **Excédent attribué à l'associé 1** `E = max(0, K)`.
- **Solde d'un associé** `= investissement de départ + dividende (+ E pour l'associé 1)`.
- **Solvabilité** `S = C − somme des soldes des associés`, soit `S = min(0, K)` : cohérent si et seulement s'il n'y a pas de déficit.

## Ce qui a changé par rapport à la v4.6
1. Les résultats négatifs ne sont plus ramenés à 0 : « Déficit » et « Insuffisant » peuvent enfin s'afficher.
2. Le gain n'est plus compté deux fois : le solde de contrôle retire le gain à distribuer avant d'attribuer l'excédent à l'associé 1.
3. Les frais visa (127 €) sont déduits du gain du dossier, plus seulement du compte bloqué.
4. La commission est déduite aussi sur un refus (option désactivable dans Paramètres).
5. L'argent versé par un client « en cours » est compté comme dû.
6. Le capital global soustrait les refus non remboursés, les acomptes en cours et l'argent des candidats ; le contrôle inclut les prêts perso.
7. « Candidats en cours » = attente + prochain, partout.

Conséquence : avec les mêmes données, le capital global et le gain net affichés sont plus bas qu'en v4.6, parce qu'ils ne comptent plus l'argent dû à des tiers ni les frais.
