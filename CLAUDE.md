# Jeux mobiles smob-fr : notes pour Claude Code

Ce dépôt réunit tous les jeux mobiles de smob-fr. Ils partagent la même technique, le même code de
monétisation et les mêmes conventions. Le propriétaire parle français : réponds, commente le code et
écris les textes des jeux en français.

**Avant de toucher à un jeu, lis aussi son `jeux/<nom>/CLAUDE.md`** : règles du jeu, architecture,
commandes, état d'avancement et points d'attention propres à ce jeu.

## Structure

```
CLAUDE.md                 ce fichier : stack, monétisation, conventions, publication
package.json              commandes globales (npm test, npm run verifier)
outils/                   outils du dépôt (tester tous les jeux, vérifier les conventions)
kit/                      code partagé par tous les jeux, extrait de Mélo Pop (voir kit/README.md)
jeux/<nom>/               un dossier par jeu, autonome
  CLAUDE.md               règles du jeu, état d'avancement, commandes (repris de son ancien NOTES.md)
  jeu.json                identité et monétisation : id, nom, AdMob, RevenueCat, catalogue
  capacitor.config.json   appId (fr.smob.<id>), nom, webDir
  package.json            ses propres commandes : construction, niveaux, tests
docs/                     monetisation.md, publication.md, idees.md
.github/workflows/        tests à chaque envoi, publication web depuis main
```

Jeux présents : voir le tableau de `README.md`.

## Stack commune

- **Web sans framework** : HTML, CSS et JavaScript « à la main », sans bibliothèque à l'exécution.
  Graphismes dessinés par le code (SVG, canvas), sons et musique synthétisés en Web Audio (aucun
  fichier audio). Pas de dépendance réseau au lancement, à part d'éventuelles polices.
- **Capacitor 8** emballe chaque jeu en appli Android et iOS. Le dossier web (`webDir`) de chaque jeu
  est indiqué dans son `capacitor.config.json`. Plugins utilisés :
  `@capacitor-community/admob` (pubs et consentement), `@revenuecat/purchases-capacitor` (achats),
  `@capacitor/local-notifications` (rappels), `@capacitor/haptics` (vibrations),
  `@capacitor/splash-screen`.
- **Dans un navigateur, tout est simulé** : pubs, achats, notifications. On peut tester tout le
  parcours sans téléphone ni compte, et chaque jeu reste jouable en version web (GitHub Pages).
- **Node 20 ou plus** pour les outils. **Python 3** pour le générateur de niveaux de Max.
  **Playwright** (Chromium) pour les tests de bout en bout.
- `appId` : `fr.smob.<id>`, définitif une fois publié.

### Le kit (`kit/`)

Code commun, extrait de Mélo Pop. Un jeu ne recopie jamais ce code : il l'installe au moment de la
construction avec `kit/outils/installer.mjs`, qui le copie dans le dossier web du jeu, soit en modules
ES (`import { Ads } from "../kit/ads.js"`), soit en un seul script classique qui définit `window.Kit`
(pour les jeux en fichier unique ou en scripts classiques). Les copies installées ne sont pas
versionnées. L'API complète est dans `kit/README.md`.

- `ads.js` : AdMob, consentement RGPD (UMP), ATT sur iOS, règles de fréquence, simulation web.
- `store.js` : RevenueCat, catalogue lu dans `jeu.json`, « Sans pub », restauration, simulation web.
- `notify.js` : notifications locales, heures calmes, annulation au retour.
- `sound.js` : moteur Web Audio (sons, musique, vibrations), chaque jeu y ajoute ses propres sons.
- `sauvegarde.js`, `vies.js`, `bonus.js`, `cadeau.js` : sauvegarde locale, vies, inventaire de
  bonus, cadeau du jour.
- `fenetres.js`, `boutique.js`, `reglages.js`, `tutoriel.js`, `icones.js`, `styles/base.css` :
  fenêtres, écrans, boutique, réglages, tutoriel guidé (main, projecteur, bulle), icônes, styles.

Une modification du kit touche tous les jeux : lance `npm test` à la racine avant de la proposer.
Les identifiants et les textes propres à un jeu ne vont jamais dans le kit : ils vont dans
`jeu.json` ou dans le code du jeu.

## Commandes

```bash
npm test                 # tests du kit, conventions, puis tests de chaque jeu (npm test du jeu)
npm run verifier         # conventions seules : jeu.json, appId, catalogue, prix
npm run site             # construit le site web de tous les jeux dans _site/ (comme GitHub Pages)
node outils/tester-tout.mjs melopop   # un seul jeu
```

Chaque jeu a son propre `npm test`, qui lance ses vérifications de niveaux et ses tests automatiques.
Ces outils doivent toujours fonctionner depuis le dossier du jeu, et les tests doivent passer avant
tout envoi. Les commandes détaillées sont dans le `CLAUDE.md` de chaque jeu.

## Monétisation

Détails, mise en place des comptes et catalogue de chaque jeu : `docs/monetisation.md`.

**AdMob**

| Format | Où | Règle |
|---|---|---|
| Bannière | menus, carte des niveaux, accueil | **jamais pendant le jeu** (plateau, niveau en cours) : évite les clics accidentels, interdits par AdMob |
| Interstitielle | entre deux parties, jamais au milieu | plafonnée : à partir du niveau 4, 1 partie terminée sur 3, au moins 2 minutes entre deux |
| Vidéo récompensée | à la demande du joueur | toujours volontaire, récompense annoncée avant (vie, bonus, coups, aide) |

- Consentement RGPD par le formulaire Google UMP au lancement, ATT sur iOS, bouton
  « Confidentialité et publicité » dans les réglages quand la loi l'exige.
- Pas d'interstitielle juste après une vidéo récompensée, ni pendant le tutoriel.
- Identifiants de test Google tant que `admob.test` vaut `true` dans `jeu.json`.

**RevenueCat**

- **« Sans pub »** (`<id>_noads`, non consommable, 3,99 €) : coupe bannières et interstitielles, les
  vidéos récompensées restent proposées. Droit RevenueCat `no_ads`. Restaurable.
- **Lots de bonus** consommables, aux trois prix **0,99 €, 1,99 € et 4,99 €**, plus une éventuelle
  recharge de vies à 0,99 €. Un lot « découverte » à 1,99 € peut n'être proposé qu'une fois.
- Bouton **« Restaurer mes achats »** dans les réglages (obligatoire pour Apple).
- Le prix affiché est celui du store, dans la devise du joueur ; celui de `jeu.json` n'est qu'un
  repli. Les lots consommables sont stockés sur l'appareil et ne sont pas restaurables.

`npm run verifier` contrôle le catalogue de chaque `jeu.json` : produit « Sans pub » présent,
identifiants préfixés par l'id du jeu, prix dans la grille.

## Conventions communes

Un jeu n'a pas à utiliser toutes ces mécaniques, mais s'il en utilise une, il suit la convention et le
module du kit correspondant.

- **Vies** : 5 au maximum, 1 qui revient toutes les 20 minutes, un niveau perdu ou abandonné en
  coûte une. Plus de vies : attendre, une vidéo (+1 vie) ou la recharge en boutique. Le cadeau du
  jour peut dépasser le maximum de 1.
- **Bonus** : inventaire dans la sauvegarde, quelques bonus offerts au départ. Un bonus ne coûte
  jamais de coup. Il est expliqué la première fois qu'on l'utilise. On en gagne en jouant (3 étoiles,
  coffre tous les 5 niveaux), avec le cadeau du jour, une vidéo ou en boutique. Bonus épuisé : fenêtre
  qui propose une vidéo (+1) et les lots.
- **Cadeau du jour** : un par jour (date locale), à ouvrir depuis l'accueil ou la carte, avec un
  indicateur quand il est prêt.
- **Tutoriel** : au premier lancement, guidé (une main montre le geste, la zone à jouer est en
  lumière, le joueur fait lui-même les premiers coups), suivi d'une fiche « Nouveau ! » à chaque
  nouvelle mécanique. On peut le revoir depuis les réglages. Pas de pub pendant le tutoriel.
- **Notifications** : proposées après une explication, au bon moment (après les premiers niveaux ou
  une première réussite), jamais au lancement. Locales, sans serveur : vies rechargées, cadeau du
  jour à 18 h, rappel après 3 jours d'absence, ou rappel propre au jeu (défi du jour). Jamais entre
  21 h et 9 h. Annulées dès que le joueur revient. Réglables dans les réglages.
- **Réglages** : effets sonores, musique, vibrations, rappels, comment jouer, revoir le tutoriel,
  restaurer mes achats, confidentialité et publicité (si exigé), effacer ma progression (avec
  confirmation), numéro de version.
- **Sauvegarde** : `localStorage`, une clé par jeu (`<id>.v1`…). Toujours compatible avec les
  anciennes sauvegardes : on ajoute des champs avec une valeur par défaut, on ne casse jamais la
  progression des joueurs. Une sauvegarde illisible repart des valeurs par défaut sans planter.
- **Accessibilité et confort** : respect de `prefers-reduced-motion`, grandes zones tactiles,
  son et musique coupés quand l'appli passe en arrière-plan.
- **Langue française** partout, joueur tutoyé. Typographie française : guillemets « », espace avant
  « : ; ! ? », prix avec virgule (`0,99 €`), nombres avec `toLocaleString("fr-FR")`. Pas de texte
  anglais visible par le joueur.
- **Outils de test** : chaque jeu expose un objet de débogage dans la console (`window.__<id>`)
  utilisé par ses tests automatiques.

## Publication web (GitHub Pages)

Tous les jeux sont publiés ensemble, en version web de test (pubs, achats et notifications simulés),
sur **https://smob-fr.github.io/jeux/** :

| Jeu | Adresse | Dossier publié (`webDir`) |
|---|---|---|
| Mélo Pop | https://smob-fr.github.io/jeux/melopop/ | `jeux/melopop/www` |
| Ça Roule | https://smob-fr.github.io/jeux/ca-roule/ | `jeux/ca-roule/site` |
| Max et l'Œil de Jade | https://smob-fr.github.io/jeux/max/ | `jeux/max/www` |
| Pingo Glisse (prototype) | https://smob-fr.github.io/jeux/pingo/ | `jeux/pingo/www` |

- **Quand** : à chaque envoi sur `main` (ou à la main : onglet *Actions* › « Publier les jeux » ›
  *Run workflow*). Les autres branches ne publient rien ; elles lancent seulement les tests (`tests.yml`).
- **Comment** (`.github/workflows/pages.yml`) : `npm install`, Playwright, **`npm test`** (si un test
  échoue, rien n'est publié et l'ancienne version reste en ligne), puis **`npm run site`**
  (`outils/construire-site.mjs`) : pour chaque dossier de `jeux/`, `npm run build`, puis copie de son
  `webDir` (lu dans `capacitor.config.json`) dans `_site/<dossier>/`, plus une page d'accueil qui liste
  les jeux (nom et `description` de `jeu.json`). Enfin `_site/` est envoyé à GitHub Pages.
- **Un nouveau jeu** est publié automatiquement dès qu'il a son dossier dans `jeux/`, avec `jeu.json`,
  `capacitor.config.json` (`webDir`) et des scripts `build` et `test`. L'adresse est le nom du dossier.
- **Réglages GitHub, une seule fois** : *Settings* › *Pages* › *Source* : **GitHub Actions** ; branche par
  défaut du dépôt : `main`. Sans la source « GitHub Actions », l'étape de publication échoue.
- **Vérifier en local** avant d'envoyer : `npm run site`, puis servir `_site/` (par exemple
  `npx --yes http-server _site -p 8080`) et ouvrir http://localhost:8080/<dossier>/.
- **Mises à jour chez les testeurs** : Ça Roule et Max ont un service worker (jeu hors ligne). Ça Roule
  change sa version de cache à chaque build ; pour Max, augmenter `VERSION` dans `sw.js` à chaque
  publication qui change le jeu.
- Les anciens sites (`smob-fr.github.io/melopop/`, `/ca-roule/`, `/max-oeil-de-jade/`) viennent des
  anciens dépôts : ils ne bougent plus. Les archiver quand les testeurs ont la nouvelle adresse.

## Checklist de publication

Version détaillée, avec les liens et les formulaires : `docs/publication.md`.

1. `npm test` à la racine : tout passe.
2. `jeu.json` : vrais identifiants AdMob (appli et 3 blocs par plateforme), `admob.test` à `false`,
   clés publiques RevenueCat.
3. Produits créés dans Google Play Console et App Store Connect avec les identifiants de `jeu.json`,
   droit `no_ads` relié à `<id>_noads` dans RevenueCat.
4. AdMob : message RGPD et message ATT activés ; `app-ads.txt` publié sur le site du développeur.
5. `appId` définitif dans `capacitor.config.json`, numéro de version augmenté.
6. Icône et écran de démarrage générés (`npm run assets` du jeu).
7. Politique de confidentialité publiée, adresse indiquée dans les deux stores.
8. Google Play : sécurité des données (identifiant publicitaire), « Contient des annonces »,
   classification, test fermé (12 testeurs pendant 14 jours pour un nouveau compte personnel).
9. App Store Connect : App Privacy, classification d'âge, capacité In-App Purchase dans Xcode.
10. Essai sur un vrai téléphone : pubs de test, achat avec un compte testeur, restauration,
    notifications, mode avion.

## Git

- Chaque étape de travail se fait sur une branche et passe par une demande de fusion.
  **Ne jamais fusionner dans `main` sans l'accord du propriétaire.**
- Les jeux ont été importés avec leur historique : `git log -- jeux/<nom>` remonte jusqu'à leur
  premier commit dans leur ancien dépôt.
