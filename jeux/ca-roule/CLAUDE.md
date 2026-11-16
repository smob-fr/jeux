# Ça Roule : notes pour Claude Code

Jeu mobile de casse-tête de parking, en français : une Course à sorties limitées, un Casse-tête et un
défi du jour. Lis d'abord le `CLAUDE.md` de la racine (stack, kit, monétisation, conventions).
Identité et monétisation : `jeu.json` (id `caroule`, appId `fr.smob.caroule`). Pistes : `docs/ROADMAP.md`.
Maquettes de conception : `docs/maquettes/`.

## Technique

- **HTML, CSS et JavaScript sans framework**, aucune dépendance à l'exécution à part les polices Google
  Fonts (Fredoka et Nunito) et le **kit commun** du dépôt, intégré au build en format global (`window.Kit`).
- `src/template.html` contient toute l'interface : styles, écrans, logique de jeu, sons, statistiques.
  `src/engine.js` est le moteur pur, sans DOM, utilisable aussi sous Node.
- Les niveaux sont des données JSON précalculées et vérifiées par des solveurs (`data/`), produites par
  les générateurs de `tools/`.
- `tools/build.js` assemble **un seul fichier HTML** (`dist/index.html`, versionné) et **une version web
  installable** (`site/`, non versionnée) : c'est le `webDir` de Capacitor et ce que publie le site du dépôt.
- Tous les graphismes sont dessinés par le code ; tous les sons sont synthétisés (`Snd`, propre au jeu :
  ses musiques « run » et « calm » n'utilisent pas `Sound` du kit).
- Statistiques anonymes PostHog (UE) par le kit (`Kit.Stats`), clé publique dans `jeu.json › statistiques`.

## Commandes

Depuis `jeux/ca-roule/` (Node 20 ou plus) :

- `npm test` : build, `verify:course`, `verify:daily`, `verify`, puis les 6 tests de bout en bout. Doit passer avant tout envoi.
- `npm run build` : assemble `dist/index.html` (template + kit + moteur + niveaux) et `site/`. Vérifie la syntaxe des scripts embarqués. **Toujours relancer après une modif de `src/`, `data/` ou du kit.**
- `npm run test:e2e` : tests de bout en bout (Playwright, sur `dist/index.html`) : `e2e-run-touch` (Course au doigt), `e2e-puzzle-touch`, `e2e-puzzle-mouse`, `e2e-levels-sheet`, `e2e-kit` (bannière hors jeu, boutique, vidéo récompensée), `e2e-stats` (statistiques envoyées, interceptées par le test). Chacun sort en erreur si une vérification échoue.
- `npm run verify:course` : re-résout les 75 niveaux de la Course (`data/course.json`) : solubles, objectif = vrai minimum, chaque voiture vise une porte possible, aucun bouton occupé au départ.
- `npm run verify:daily` : re-résout chaque défi du jour (`data/daily.json`) et vérifie qu'il demande exactement `opt` coups (30 et plus).
- `npm run verify` : vérifie les 1000 niveaux de l'ANCIENNE Course (`generate`), plus utilisée dans le jeu mais gardée pour l'historique.
- `npm run course:gen` : régénère les niveaux de la Course (`tools/gen_course.js`, puis `merge`). Attention : change tous les niveaux.
- `npm run daily:search` puis `npm run daily:select` : nouveaux défis experts. Attention : changer la liste change le défi de chaque jour.
- `npm run puzzles:search` puis `npm run puzzles:select` : nouvelles énigmes.
- `node tools/make_icons.js` : regénère `assets/icons/` (après `npm run build`). `npm run screenshot` : capture du Casse-tête.
- `npm run add:android | add:ios | sync | android | ios | assets | admob:config` : appli native (voir `docs/publication.md` à la racine).

Attention, régénérer des niveaux change la progression des joueurs et le défi de chaque jour.

## Architecture
- `src/engine.js` : moteur pur (UMD, sans DOM). Course « sorties limitées » : `crSlide`, `crApply` (marche arrière avec `back`), `crAnalyse` (exploration complète, coups minimum et impasses), `crBest` (meilleur coup). Casse-tête : `pzSolve` (parcours en largeur). `generate(n)` = ancienne Course, inutilisée.
- `data/course.json` : 75 niveaux `{city, hard?, boss?, W, H, opt, naive, gates:[[côté, ligne/colonne, couleur|'any']], bars:[[côté, n°]], buttons:[[x, y, barrière]], cars:[[horizontale, ligne/colonne, case, longueur, sens ±1, couleur]]}`. Marqueur `/*COURSE*/[]` dans le template.
- `src/template.html` : toute l'interface (CSS + HTML + script principal). Marqueurs remplacés au build : `/*KIT_CSS*/`, `/*KIT*/`, `/*ENGINE*/`, `/*PUZZLES*/[]`, `/*DAILY*/[]`, `/*COURSE*/[]`. Ne pas les supprimer.
- `data/puzzles.json` : 50 énigmes `{opt, ways, cars:[[horizontale, ligne/colonne, case, longueur]]}` ; la voiture 0 est la rouge (ligne 2, sort à droite). `ways===1` = solution optimale unique.
- `data/daily.json` : défis du jour `{opt, cars}`, tous à 30 coups ou plus (`tools/gen_daily.js`, recherches brutes dans `data/daily/`).
- `data/candidates/` : ~42 000 grilles candidates (`tools/gen_puzzles.js`) ; `tools/select_pz.js` en tire les 50 énigmes.
- `dist/index.html` : fichier généré, jamais édité à la main. Sa date de build change à chaque construction.
- Publication web : le workflow `pages.yml` de la racine du dépôt construit `site/` et le publie dans `https://smob-fr.github.io/jeux/ca-roule/` à chaque envoi sur `main`, après `npm test`. Le service worker charge la page depuis le réseau d'abord.
- Objet de débogage : `window.__caroule` (`S`, `Kit`, `save`, `start`, `pzStart`, `openShop`).
- `docs/` : feuille de route, maquettes, expériences de faisabilité.

## Règles du jeu
**Course** « sorties limitées » (75 niveaux, 3 villes de 25) : le parking est fermé par un mur avec quelques portes. Toucher une voiture la fait avancer jusqu'au premier obstacle ; elle sort seulement si elle arrive face à une porte de sa couleur ou rayée (« toutes couleurs ») non fermée par une barrière. Sinon elle s'arrête et reste garée. Une barrière se lève pour de bon quand une voiture s'arrête sur son bouton jaune. Les voitures n'avancent jamais en arrière (sauf aide « Marche arrière »). Objectif = coups minimum, réserve = objectif + 3 (+5 niveau géant), étoiles : 3 à l'objectif, 2 jusqu'à +2, 1 au-delà. Impasse (plus aucune solution) ou réserve insuffisante → fenêtre d'échec (Annuler gratuit / +3 coups contre une vidéo). Villes : 1 Centre-ville (portes rayées), 2 Le port (portes de couleur), 3 La gare (barrières) ; niveau géant 7 × 9 en fin de ville, badge Difficile tous les 5 niveaux. Ville suivante ouverte quand le niveau géant est battu.
**Casse-tête** (50 énigmes, grille 6x6) : voitures qui glissent dans les deux sens (glisser-déposer), sortir la rouge, sans chrono ni cœurs, compteur de coups, Annuler, Aide (coups de pouce ou vidéo, calculée par `pzSolve`). Étoiles : 3 si coups ≤ optimum, 2 si ≤ ceil(opt×1.4), 1 sinon.

## Points d'attention
- **Pubs (kit commun)** : `Kit.Ads` décide et affiche (AdMob dans l'appli). Dans le navigateur, l'écran `#ad` de Ça Roule sert de simulation (`Kit.Ads.simulateur.pub = simAd`). `runAd('reward', …, cb, place)` = vidéo récompensée (cb seulement si vue jusqu'au bout) ; `interstitial(niveau, go)` à « Suivant » après une victoire, selon les règles du kit (à partir du niveau 4, une partie sur 3, 2 min). Plus de pub interstitielle « toutes les 3 victoires dès le niveau 1 » comme avant.
- **Bannière** : seulement quand l'accueil ou la carte des villes est affiché (`banner()`, appelé par un `MutationObserver` sur `#home` et `#cmap`, et masquée dès `leaveHome`). L'ancienne bannière « PUB » sous le plateau a été supprimée (règle commune : jamais pendant le jeu). `body .home, body .cmap { bottom: var(--kit-banniere-h) }` leur laisse la place.
- **Boutique (kit commun)** : fenêtre `#shop` (accueil, pause, fenêtre « Coup de pouce »), cartes dessinées par `Kit.Boutique` d'après `jeu.json › produits` (« Sans pub », 10 👍 à 0,99 €, pack découverte unique à 1,99 €, 100 👍 à 4,99 €), illustrations `SHOP_ART`, « Restaurer mes achats » en bas de la boutique. `contenu` : `boost` (👍), `fuel` et `reverse` (aides en réserve dans `S.inv`).
- Sauvegarde : `localStorage` clé `caroule.v1` = `{crv,legacy,freeAid,inv,chest,mis,level,max,test,seen,mode,pz:{level,max,stars},sfx,music,skin,rs,ads,daily,notif,uid,stats,boost,noAds,bought}` (`noAds`, `bought` : achats, ajoutés avec le kit). `save()` écrit une liste explicite de champs : tout nouveau champ doit y être ajouté. `crv: 1` = nouvelle Course : `level`, `max`, `rs` (étoiles par niveau) la concernent. Une sauvegarde sans `crv` a sa progression d'ancienne Course déplacée dans `legacy {max, rs}` (comptée dans `totalStars` pour le garage) et repart au niveau 1. Garder la compatibilité ascendante.
- Un seul thème sombre voulu (nuit violette en Course, nuit bleue en Casse-tête) ; accent jaune panneau (`--sign`, `--sign-hi`, `--sign-deep`), bleu (`--psign…`) pour le Casse-tête.
- Style visuel « jeu mobile moderne » : dégradés doux, verre dépoli, relief léger, polices arrondies. Éviter les contours épais, les ombres dures décalées et les polices monospace (look rétro).
- Pas de dépendance externe à part les polices Google Fonts (Fredoka pour les titres et chiffres, Nunito pour le texte).
- Voitures dessinées en SVG (`carSVG`, `pcarSVG`, `tarpSVG`) : chaque SVG a ses propres id de dégradés (`gidSeq`), car une voiture sortie est retirée du DOM. Éclairage symétrique sur la largeur pour rester juste après rotation. Dégradés partagés des cœurs et étoiles dans le `<svg class="defs">` en haut de page (`#g-heart`, `#g-star`).
- Accueil (`#home`, `openHome`/`leaveHome`) : affiché au lancement, le niveau en cours est chargé derrière ; retour via le bouton maison de la fenêtre « Niveaux ». Vignettes animées des deux modes construites en JS (`buildHome`, `miniBoard`, `miniCar`). Les tests e2e touchent d'abord `#home-run` ou `#home-pz`.
- Tuto des barrières : au premier niveau à barrière (52), fiche `#intro` « Nouveau : les barrières » (`showBarIntro`, deux scènes animées `demoScene` : passer sur le bouton ne fait rien, s'y arrêter lève la barrière), une seule fois (`S.seen.barIntro`). Ensuite, sur ce niveau (`S.seen.barLevel`) et tant que la barrière est fermée, `barGuide` entoure le bouton (« Une voiture doit s'arrêter ici ») et la main tapote la voiture du meilleur coup.
- Tutoriel (`tutoRun`, `tutoPz`, `TUTO_LEVELS = 2`) : une main (`HAND`) montre le geste sur les niveaux 1-2 de chaque mode. Course : elle tapote la voiture choisie par `pickHint`. Casse-tête : elle fait glisser la voiture du prochain coup optimal (`pzSolve`) vers un cadre pointillé. Suivre la main donne toujours 3 étoiles.
- Son (`Snd`) : tout est synthétisé en Web Audio, aucun fichier audio. Bruitages (`click`, `vroom`, `bump`, `sputter`, `whoosh`, `slide`, `tick`, `clock`, `chime`, `win`, `lose`) et musique générée en direct : style `run` (groove 112 BPM, Course et accueil) et `calm` (84 BPM, Casse-tête). L'audio démarre au premier geste, se coupe quand l'onglet est caché et baisse pendant les pubs (`Snd.duck`). Boutons musique/bruitages sur l'accueil et dans « Niveaux » ; réglages `sfx` et `music` dans la sauvegarde.
- Skins (`SKINS`, `SKIN`, `equip`) : 7 styles de voitures (Classique 0, Sport 12, Bonbon 30, Flammes 50, Commando 80, Néon 120, Or massif 180 étoiles), débloqués par le total d'étoiles (`totalStars` : Course `S.rs` + Casse-tête `S.pz.stars`), sans les dépenser. Un skin = palette (`pal[0]` = voiture rouge du Casse-tête) + décor (`deco` : stripes, dots, flames, camo) ou style de carrosserie (`style` : neon, gold), appliqués par `carSVG`/`pcarSVG`. Garage accessible depuis l'accueil ; la fenêtre de victoire annonce un nouveau style ou les étoiles qui manquent. Anciennes sauvegardes : 1 étoile comptée par niveau de Course déjà passé.
- Skins exclusifs (`ad: N` dans `SKINS` : Taxi 2, Police 3, Galaxie 4 vidéos) : débloqués en regardant N vidéos récompensées depuis le garage (`watchFor`, progression dans `S.ads`), équipés automatiquement au déblocage.
- Menu pendant la partie : bouton pause `#btn-menu` dans le bandeau (Échap aussi) → fenêtre `#pause` (Reprendre, Accueil, changer de mode, Niveaux, Garage, son). Le chrono est figé tant qu'elle est ouverte.
- Défi du jour (`dailyPuzzle`, `dailyWin`, `dailyHud`) : un casse-tête expert par jour, choisi par le numéro du jour depuis le 1er janvier 2026 (date locale), identique pour tous. Lancé depuis la carte rouge de l'accueil, thème `body.daily`. Série (`S.daily` = `{last, streak, best, done}`) : +1 si le défi d'hier était réussi, sinon repart à 1 ; affichée à 0 si ni hier ni aujourd'hui ne sont réussis. Étoiles du défi comptées pour le garage. Pas de tutoriel, indices autorisés (vidéo).
- Rappels du défi (`Notif`, `setNotif`, fenêtre `#notif`, cloche sur l'accueil et dans la pause) : réglage `S.notif` = `{on, hour, minute, asked}` (18 h par défaut). Dans l'appli : plugin Capacitor `@capacitor/local-notifications` (`window.Capacitor.Plugins.LocalNotifications`), 7 jours de rappels programmés à l'avance (id 7100-7106) + « dernière chance » à 21 h 30 si une série est en danger (id 7200), reprogrammés à chaque ouverture, retour au premier plan et défi réussi ; toucher la notification ouvre le défi. Sur le web : API Notification, seulement tant que la page est ouverte. L'autorisation est demandée au bon moment : bouton « Me rappeler » après le premier défi réussi, ou dans la fenêtre de réglage.
- **Statistiques anonymes (kit commun)** : `Stats` est un adaptateur vers `Kit.Stats` (PostHog UE, clé dans `jeu.json › statistiques`, plus de `stats.config.json`). Mêmes événements et propriétés qu'avant le kit : `session_start`, `home_choice`, `level_start`, `level_win`, `level_fail`, `level_quit` (raison : home, restart, switch, closed), `hint_used`, `ad_shown`/`ad_closed` (emplacement), `skin_equip`, `reminder_set`, `setting_change` ; le kit ajoute `jeu`, `version`, et les événements `ad_reward`, `ad_interstitial`, `purchase`, `restore`. Identifiant aléatoire `S.uid`, réglage `S.stats` (interrupteur dans la pause), tentative en cours dans `caroule.att`. Rien n'est compté tant que l'accueil est affiché. Test : `tests/e2e-stats.js`. Détails : `docs/statistiques.md` à la racine.
- Coups de pouce 👍 (`S.boost` = `{n, row, got}`, 3 au départ) : gagnés au Casse-tête et au défi en finissant à l'objectif (énigme : 1, ou 2 « sans faute » = ni Annuler ni aide ; défi : 3, ou 4 sans faute), une seule fois par énigme et par palier (`got`), +3 toutes les 3 réussites parfaites d'affilée (`row`), +5 tous les 7 jours de série, +2 contre une vidéo dans le garage. Dépensés dans la fenêtre « Coup de pouce » (`#aid`, bouton « Aide » du Casse-tête) : Premier coup 1 (seulement avant le 1er coup), 3 coups d'avance 2, Pilote 5 (joue 5 coups optimaux, `P.auto` bloque les gestes) ; « 3 coups d'avance » gratuit contre une vidéo. Le plan (`P.plan`, `planShow`, `planDraw`, `planStep`) numérote les coups sur le plateau, la main les rejoue, il avance à chaque bon coup et s'efface si on s'en écarte. En Course, le bouton reste « Indice · vidéo ». Garde-fou : `anomaly_moves` envoyé aux statistiques si une victoire passe sous l'objectif (impossible en théorie).
- Course dans le template : `loadLevel`, `buildCars` (portes `.cgate`, flèches au sol `.cmark`, barrières `.cbar`, boutons `.cbtn`), `layout`, `crDraw` (glissade en transition, sortie en WAAPI qui franchit la porte), `tap`, `crUndo`, `win`, `lose`. En cas d'impasse, `crDoomed` (moteur) désigne les voitures qui ne sortiront plus jamais (et si c'est à cause d'une barrière qui ne peut plus se lever) : elles clignotent en rouge (`.doomed`) et `deadText` l'explique dans la fenêtre d'échec. La barre du haut (`#timer`) affiche la réserve. Couleurs : sur les niveaux à portes de couleur, couleurs fixes `COLMAP` (le style doré du garage est neutralisé) ; sinon palette du skin. Aides de Course dans la fenêtre « Coup de pouce » : +3 coups (1 👍), Marche arrière (2 👍, `setReverse`), meilleur coup (vidéo) ; chaque aide est offerte la première fois (`S.freeAid`) et les aides gagnées vont en réserve (`S.inv`) utilisée avant les 👍.
- Carte des villes (`#cmap`, `openMap`, `drawMap`) : canvas dessiné par le module `MapArt` (vue de trois quarts, décors par thème city/port/station, route par-dessus le décor avec halo, ligne dorée de progression) et niveaux en boutons `.cnode`. S'ouvre depuis la carte Course de l'accueil, la puce de niveau et « Niveaux » de la pause ; après un niveau géant, la carte de la ville suivante.
- Coffres et missions : un coffre toutes les 20 étoiles de Course (`S.chest`, `openChest`) → 3 à 5 👍 + une aide en réserve ; 3 missions par jour tirées par la date dans `MISSIONS` (`S.mis`, `mission(id)`), récompense versée tout de suite avec un bandeau (`toast`), bonus d'une aide quand les 3 sont finies. Raccourcis sur l'accueil et sous la carte.
- Effets : `puff` (poussière à la sortie), `spark` (choc), `celebrate` (confettis à la victoire) ; tous coupés si `prefers-reduced-motion`.
- Le fichier de vérification n'a jamais détecté de niveau insoluble : tout changement du générateur change les niveaux existants (déterministe par numéro) — le signaler avant de modifier `params`/`build`.
- Bug déjà rencontré : la fenêtre « Niveaux » (`.sheet-card`) sortait de l'écran à cause de la grille de 1000 boutons ; corrigé avec `max-height: min(82vh, 680px)` et `min-height: 0` sur `.level-grid`. Garder ça en tête en touchant au CSS.
- Mascotte (cône de chantier) : états idle/cheer/ouch/sad, pupilles qui suivent le doigt.

## Écarts avec les conventions communes (à décider avec le propriétaire)

- **Vouvoiement** : Ça Roule vouvoie le joueur (« Vous avez », « votre série »), les autres jeux le tutoient.
- **Rappels la nuit** : l'heure du rappel peut être 8 h ou 21 h (`HOURS`), et la « dernière chance » est
  programmée à 21 h 30, alors que la convention interdit 21 h à 9 h. Le joueur choisit lui-même son heure,
  mais la « dernière chance » est imposée.
- **Pas de vies, pas de cadeau du jour** : remplacés par les 👍, les coffres à étoiles et les missions.
  C'est permis (un jeu n'utilise que les mécaniques qui lui vont).
- **Réglages** : pas de fenêtre de réglages complète ; son, musique, rappels et statistiques sont dans la
  pause et sur l'accueil, « Restaurer mes achats » dans la boutique. Pas encore de « Confidentialité et
  publicité » (`Kit.Ads.privacyOptionsRequired`) ni d'« Effacer ma progression ».

## Fonctionnalités

**Modes de jeu**
- **Course « sorties limitées »**, 75 niveaux répartis en 3 villes de 25 :
  - on touche une voiture : elle avance jusqu'au premier obstacle, et ne sort que face à une porte de sa couleur ou à une porte rayée « toutes couleurs » ;
  - Centre-ville : portes simples ; Le port : portes de couleur ; La gare : barrières qui se lèvent quand une voiture s'arrête sur un bouton ;
  - chaque niveau a un objectif en coups (le minimum calculé), une réserve de coups, des étoiles, la détection d'impasse, Annuler, des niveaux Difficile et un niveau géant en fin de ville.
- **Casse-tête** : 50 énigmes de 6 × 6 où l'on fait glisser les voitures pour sortir la rouge, avec un objectif en coups optimal vérifié.
- **Défi du jour** : un casse-tête expert de 30 à 50 coups, identique pour tous, avec une série de jours consécutifs.

**Progression et récompenses**
- Carte illustrée des villes, avec la route des niveaux, la progression dorée et la ville suivante verrouillée.
- Étoiles, garage de 10 styles de voitures (7 gagnés avec les étoiles, 3 exclusifs avec des vidéos récompensées).
- Coups de pouce 👍 : monnaie d'aide gagnée en jouant bien.
- Aides :
  - Casse-tête : Premier coup, 3 coups d'avance, Pilote ;
  - Course : +3 coups, Marche arrière, Meilleur coup.
- Coffre toutes les 20 étoiles de Course, 3 missions par jour.

**Confort**
- Accueil illustré, menu Pause, tutoriel avec une main animée sur les premiers niveaux.
- Mascotte (un cône de chantier), musique et bruitages réglables.
- Rappels du défi du jour : notifications locales dans l'appli, API Notification sur le web.
- Statistiques anonymes que le joueur peut désactiver.
- Version web installable sur l'écran d'accueil, qui marche hors ligne.

**Publicités et achats** (kit commun) : bannière sur l'accueil et la carte, interstitielle plafonnée, vidéos récompensées, boutique (« Sans pub » et 👍). AdMob et RevenueCat dans l'appli (identifiants de test pour l'instant), simulés dans le navigateur.

## État d'avancement

- Prototype web complet et jouable, en test auprès d'utilisateurs via GitHub Pages (ancien dépôt `smob-fr/ca-roule`, puis `https://smob-fr.github.io/jeux/ca-roule/`).
- Novembre 2026 : import dans le dépôt commun, branché sur le kit (pubs, bannière hors jeu, boutique).
- Tous les niveaux sont vérifiés automatiquement : 75 niveaux de Course, 50 énigmes, 207 défis. La publication refuse de mettre en ligne un niveau insoluble.
- Les statistiques arrivent bien dans PostHog.
- La nouvelle Course vient d'être livrée (75 niveaux, carte, coffres, missions). Elle attend les retours des testeurs, surtout sur la difficulté.
- `docs/maquettes/` contient trois maquettes HTML autonomes : les quatre pistes étudiées pour la Course, le niveau test jouable et les écrans de progression. `docs/exp_sorties_*.js` contient le premier prototype de la règle, remplacé depuis par `src/engine.js` et `tools/gen_course.js`.

## Ce qui reste à faire

0. Régler les écarts avec les conventions communes (ci-dessus).

1. **Emballer en vraie appli** avec Capacitor (`capacitor.config.json` et commandes prêts : `npm run add:android`), Android d'abord, puis iOS. Il faut un compte Google Play (25 $) et, pour iOS, un compte Apple Developer (99 $ par an) et un Mac.
2. **Vraies notifications** dans l'appli (plugin `@capacitor/local-notifications`), à vérifier sur un vrai téléphone.
3. **Monétisation réelle** : AdMob, consentement RGPD et « Sans pub » sont branchés par le kit ; restent les vrais identifiants dans `jeu.json`, les produits dans les stores et une politique de confidentialité (checklist de `docs/publication.md`).
4. **Contenu de la Course** :
   - villes 4 à 6 : aéroport et plaques tournantes, montagne et voitures bâchées, plage et feux ;
   - aides Peinture et Dépanneuse ;
   - collections de plaques d'immatriculation et « permis » de ville ;
   - calendrier de la semaine, rallye du week-end.
5. **Défis du jour** : passer de 207 à au moins 365, avant la sortie, car changer la liste change le défi de chaque jour.
6. **Équilibrage** grâce aux statistiques : 15 niveaux de Course ont une manœuvre de moins que prévu, la place de l'énigme 38 est à revoir.
7. **Musique** : remplacer éventuellement la musique synthétisée par un morceau dont on a les droits.
8. **Fiche des stores** : textes, captures d'écran, classification d'âge.
