# Mélo Pop : notes pour Claude Code

Jeu de type « match-3 » sur le thème de la musique : on échange deux notes voisines pour aligner au
moins 3 notes de la même couleur. Lis d'abord le `CLAUDE.md` de la racine (stack, kit, monétisation,
conventions). Mélo Pop est le jeu d'où le kit a été extrait : c'est la référence des conventions.

- Identité et monétisation : `jeu.json` (id `melopop`, appId `fr.smob.melopop`).
- Présentation pour les joueurs et les stores : `README.md`.

## Commandes

Depuis `jeux/melopop/` :

```bash
npm run build      # installe le kit dans www/kit/ (copie générée, non versionnée) : à relancer après toute modification du kit
npm run serve      # build, puis http://localhost:8080
npm test           # build, puis les tests de bout en bout (tests/e2e.mjs, ~1 min)
node tests/e2e.mjs boutique   # seulement les tests dont le nom contient « boutique »
npm run add:android | add:ios | android | ios | sync | assets   # appli native (voir docs/publication.md)
```

`www/` ne marche pas sans `npm run build` : `www/kit/` n'est pas versionné.

## Architecture

```
jeu.json                 id, nom, version, identifiants AdMob, RevenueCat, catalogue de la boutique
capacitor.config.json    appId, webDir = www
www/index.html           écrans (kit-ecran) : loading, home, map, game, help, shop
www/style.css            styles propres au jeu (notes, plateau, carte, HUD) ; thème du kit dans :root
www/privacy.html         politique de confidentialité (modèle, à compléter avant publication)
www/js/game.js           moteur match-3, tutoriel, écrans, et branchement du kit
www/js/levels.js         60 niveaux en 6 mondes
www/js/fx.js             décor animé et particules (canvas)
www/js/sons.js           sons propres au jeu (swap, match, special, boom), ajoutés au Sound du kit
www/kit/                 GÉNÉRÉ par npm run build (kit/ de la racine + jeu.js) : ne jamais modifier
tests/e2e.mjs            10 tests de bout en bout (Playwright)
assets/                  sources de l'icône et de l'écran de démarrage
```

Ce qui vient du kit (`game.js`, en haut) : sauvegarde (`creerSauvegarde`), vies (`creerVies`), bonus
(`creerInventaire`), cadeau du jour (`creerCadeau`), fenêtres (`modal = fenetre`), écrans
(`Ecrans`, bannière permise seulement sur `map`), boutique (`Boutique`, illustrations `SHOP_ART`),
réglages (`ouvrirReglages`), rappels (`proposerRappels`, `rappelsStandard`), tutoriel (`Tutoriel` :
projecteur, main, bulle), pubs (`Ads`), achats (`Store`), icônes (`ICONS`).

## Règles du jeu

- Plateau 8 × 8, 4 à 6 couleurs selon le niveau. Échanger deux notes voisines (glisser, ou toucher
  l'une puis l'autre) ; un échange qui n'aligne rien est annulé.
- **Tuiles spéciales** : 4 alignées → note rayée (efface une rangée ou une colonne selon le sens) ;
  L ou T → bombe (carré 3 × 3) ; 5 alignées → étoile (efface une couleur). Combinaisons entre spéciales.
- **60 niveaux** en 6 mondes (Prélude, Allegro, Andante, Scherzo, Nocturne, Grand Final), 3 types
  d'objectifs : score, récolte de notes, cases givrées (1 ou 2 couches). Coups limités, pas de chrono.
- Étoiles : 1 à l'objectif, 2 à ×1,5, 3 à ×2,2. Les coups restants deviennent des points (finale).
- Fin des coups : +3 coups (bonus), +5 coups contre une vidéo (une fois par partie), ou abandon (−1 vie).
- **5 bonus**, sans coût de coup : marteau, bombe, étoile, mélange, +3 coups. Tutoriel des bonus au
  niveau 3, avec une bombe offerte.
- Fiches « Nouveau ! » à la première apparition de chaque mécanique (`INTROS`), page « Comment jouer ».
- Tutoriel du niveau 1 : plateau imposé (`TUT_FIXED`), vérifié par simulation (`simulateTutorial`)
  pour que les 3 coups guidés se passent toujours comme prévu.
- Rappels proposés après le niveau 2 ; interstitielles à partir du niveau 4 (règles du kit).

## État d'avancement

- Version 2.1 : jeu complet et jouable dans le navigateur (60 niveaux, tutoriels, boutique, rappels).
- Pubs et achats branchés sur les vrais SDK (AdMob, RevenueCat) mais encore en mode test : identifiants
  de test Google et clés RevenueCat vides dans `jeu.json`.
- Appli native jamais publiée : suivre la checklist de `docs/publication.md`.
- Novembre 2026 : passage au kit commun. Corrigé au passage : la bannière restait visible ~350 ms au
  début de chaque partie.

## Points d'attention

- Sauvegarde `localStorage` `melopop.v1` : `{unlocked, stars, best, lives, livesTs, sound, music,
  haptics, boosters, boosterTutoDone, boosterSeen, lastGift, tutorialDone, intros, noAds, bought, notif}`.
  Ne jamais renommer ces champs.
- `lastGift` est désormais la date **locale** (avant : date UTC). Effet unique : un joueur peut
  rouvrir un cadeau le jour du changement. Sans conséquence.
- Objet de débogage : `window.__melopop` (`state`, `startLevel`, `save`, `levelCard`), utilisé par les tests.
- Les boutons des fenêtres utilisent les classes du kit (`kit-btn big`, `ghost`, `reward`,
  `danger-fill`, `petit`), les titres `kit-surtitre`, les rangées `kit-rang`.
- Le bouton « Jouer » et plusieurs éléments sont animés en continu : dans les tests Playwright,
  cliquer avec `force: true` après avoir attendu l'élément (helper `clic`).

## Idées

- Plus de types d'obstacles : cadenas, cases vides.
- Musique et sons enregistrés par un musicien.
