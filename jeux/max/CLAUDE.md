# Max et l'Œil de Jade : notes pour Claude Code

Jeu de plateforme pour téléphone, à jouer en paysage. Il mélange l'exploration d'un *Rick Dangerous* (munitions limitées, dynamite, momies) et les pièges farceurs d'un *Level Devil* (le décor change sous les pieds).
L'explorateur Max fait la course contre le professeur Archibald jusqu'à l'Œil de Jade, à travers 5 mondes de 20 niveaux.

Lis d'abord le `CLAUDE.md` de la racine du dépôt (stack, kit, monétisation, conventions).

- Identité et monétisation : `jeu.json` (id `maxjade`, appId `fr.smob.maxjade`).
- Version en ligne : https://smob-fr.github.io/jeux/max/ (publiée depuis `main` du dépôt `smob-fr/jeux`).
  L'ancienne adresse https://smob-fr.github.io/max-oeil-de-jade/ reste en ligne tant que l'ancien dépôt n'est pas archivé.
- **Ce dossier (`smob-fr/jeux`, `jeux/max/`) est désormais la source de référence.** L'ancien dépôt
  `smob-fr/max-oeil-de-jade` et ses copies (`smob-fr/suivi-piano`, dossier `jeu/` ; branche
  `import/max-et-loeil-de-jade` de `smob-fr/jeux`) ne sont plus à jour.
- Cadrage complet (mondes, niveaux, ennemis, histoire) : `CADRAGE.md`
- Retours des testeurs et réponses : `RETOURS.md`
- Présentation pour les joueurs : `README.md`

## Technique

- **JavaScript pur, sans bibliothèque.** Seule « construction » : `npm run build` installe le **kit commun**
  (format global, `window.Kit`) dans `kit/` et copie le jeu dans `www/` (dossier web de l'appli et du site).
  Les deux dossiers sont générés et ignorés par git. Le jeu est un `<canvas>` 2D dessiné à la main, sans image de sprite. Max, les ennemis et les décors sont tracés en code.
  - `index.html` : la page, le style, les menus et les commandes tactiles. Charge `kit/kit.css` et `kit/kit.js` avant le jeu.
  - `game.js` (≈ 5 200 lignes) : le moteur. Il gère la physique, les collisions, les ennemis, les pièges, les 5 boss, le rendu, le son (synthétisé avec Web Audio) et la sauvegarde (`localStorage`).
  - `mondes.js` : la carte des 5 mondes, en SVG.
- **Les niveaux sont générés par un script Python**, `outils/niveaux.py` (≈ 4 400 lignes). Il produit `levels.js`, qu'il ne faut jamais modifier à la main. Le script fait trois choses :
  - il assemble chaque niveau à partir de « motifs » (passages typiques de chaque monde) jusqu'à la longueur visée, avec un tirage aléatoire à graine fixe ;
  - il ajoute les **pièges surprises** à la Level Devil, le drapeau du milieu et les pièces ;
  - il **vérifie que chaque niveau est faisable**. Un vérificateur de chemin simule les sauts, la nage avec la réserve d'air, le froid et les plateformes mobiles. Il teste le niveau avec 0, 1, 2 et 3 morts, car certains pièges changent de place après une mort. Un piège qui rend le niveau infaisable est refusé.
- **Grille de cases de 16 pixels, 60 images par seconde à pas fixe.** Chaque niveau est une liste de lignes de caractères : `#` pierre, `^` pics, `~` nuage, `R` lave, `P` départ, `D` porte… La légende complète figure dans les commentaires de `game.js` et `niveaux.py`.
- **Application installable (PWA).**
  - `manifest.webmanifest` et `sw.js` (service worker) permettent de jouer hors ligne. Il faut changer la constante `VERSION` de `sw.js` à chaque publication.
  - Le jeu est publié sur GitHub Pages ; `.nojekyll` sert à cette publication.
- **Performances sur téléphone.**
  - Les cases immobiles et le décor fixe sont dessinés une fois, par morceaux de 16 colonnes mis en cache.
  - Le fond est dessiné en basse définition.
  - La résolution baisse toute seule si le téléphone rame.
- **Commandes tactiles.**
  - Les flèches forment une seule zone : on glisse le doigt de ◀ à ▶.
  - SAUT, COUP et TNT suivent chaque doigt (`touchstart`/`touchend`).
  - Un appui bref donne toujours un vrai saut.
  - Au clavier :
    - se déplacer : ◀ ▶ ou Q/D ;
    - sauter : espace, ▲ ou Z ;
    - frapper : X ;
    - dynamite : C ou ▼ ;
    - pause : P ou Échap ;
    - recommencer : R.

## Compiler et tester

Il n'y a rien à compiler pour le moteur. Seuls les niveaux sont générés, et il faut Python 3 (testé avec 3.13), sans dépendance.

```sh
npm run build                      # kit/ et www/ (à relancer après une modification du kit)
python3 outils/niveaux.py          # réécrit levels.js et vérifie les 100 niveaux
python3 -m http.server 8765        # puis ouvrir http://localhost:8765/ (ou : npm run serve)
npm test                           # build, régénère les niveaux (levels.js doit rester identique), puis les tests de bout en bout
```

- Le script affiche « 100 niveaux écrits, … 0 erreur(s) ». Il se termine avec le code 1 si un niveau n'est pas faisable.
- Il affiche aussi les pièges surprises posés dans chaque niveau, et ceux que le vérificateur a refusés.
- La génération est déterministe : relancer le script redonne exactement le même `levels.js`.
- Mode testeur : case « testeur » dans les options, pour ouvrir tous les niveaux.
- Outils de test dans la console : l'objet `window.__temple`.
  - `playFrom(i)` lance le niveau `i`.
  - `mesurePerf(n)` fait avancer `n` images et en donne le temps moyen.
  - `room` donne l'état du niveau en cours.
  - `apercuNiveau(i)` donne une image du niveau entier.
- **Tests automatiques** (`outils/tests/`, 26 tests, environ 4 minutes) : les robots qui battent les 5 boss, chaque mécanique des 5 mondes, les 100 niveaux, les plateformes mobiles, le saut tactile, et le branchement sur le kit (`kit.test.js` : bannière, boutique, vidéo, interstitielle). Playwright vient de la racine du dépôt (`npm install` et `npx playwright install chromium` une seule fois, à la racine). Après `npm run build` : `node outils/tests/lancer.js` (ou `node outils/tests/lancer.js boss saut` pour n'en lancer qu'une partie ; code de sortie 1 en cas d'échec). `npm test` fait tout.

## Fonctionnalités

- **5 mondes de 20 niveaux** sur une grande carte. Chaque monde compte 19 niveaux longs (160 à 240 cases, un drapeau de sauvegarde au milieu), puis un boss.
  - Les niveaux 5, 10 et 15 sont des niveaux d'histoire.
  - Il y a un Défi tous les 3 niveaux.
  - Le niveau 19 est la grande épreuve du monde.
- **Monde 1, l'Empire inca**
  - Mécaniques : lianes, singes voleurs, bébés jaguars, têtes de jaguar qui crachent du feu, rayon du dieu Soleil, salles secrètes, ressorts fragiles, radeaux qui coulent, sabliers, torches, rocher qui roule.
  - Boss : le Jaguar de pierre.
- **Monde 2, l'Himalaya**
  - Mécaniques : neige profonde, glace vive, ponts de corde, avalanche, crevasses cachées, lac gelé, geysers, jauge de froid et braseros, ski, blizzard ; loups, aigles, yétis, chèvres, bonshommes de neige.
  - Boss : le Yéti grognon.
- **Monde 3, les abysses** : on plonge sous un plafond de roche et on va de bulle en bulle (10 s d'air, sources d'air tous les 20 à 32 colonnes) ; seuls le départ, l'île refuge du milieu (drapeau) et l'arrivée sont à l'air libre.
  - Mécaniques : méduses, crabes, anguilles, poissons-globes, requin, mines à pousser, sas, tourbillons, coffres qui mordent, torpilles, algues, abysses noirs avec un poisson-lanterne.
  - Boss : la pieuvre géante, qu'on assomme en lui renvoyant ses mines d'un coup de massue.
- **Monde 4, le royaume des nuages** : il n'y a pas de sol.
  - Mécaniques : nuages qui fondent, faux nuages, trampolines, nuages voyageurs, arcs-en-ciel, orage annoncé par une ombre, ballons, moulins, cerfs-volants, pluie, grêle, nuages souffleurs, oiseaux, petits éclairs vivants.
  - Boss : l'Oiseau-tonnerre, qu'on assomme en sonnant les cloches au bon moment.
- **Monde 5, la cité d'or**
  - Mécaniques : lave, tapis roulants, jets de feu, wagonnet, pluie de magma, dalles qui fondent, engrenages, pistons, vapeur, effondrement, compte à rebours ; golems (deux coups), salamandres, gardiens d'or, robots d'alarme.
  - Combat final en 3 manches : le Fouisseur d'Archibald (TNT dans les cheminées quand le couvercle s'ouvre), la poursuite dans la lave, puis le duel contre la cabine d'Archibald. À la fin, le dernier fragment roule aux pieds de Max et l'Œil de Jade se reconstitue.
- **Pas d'armes.** On saute sur les ennemis ou on les assomme d'un coup de massue, et la dynamite ouvre les murs fissurés. Les boss sont assommés, jamais tués.
- **Pièges surprises à la Level Devil** dans chaque ligne droite : sol qui s'ouvre, pics qui jaillissent, bloc qui tombe, piège qui change de place après une mort, requin qui surgit, nuage qui fond…
- **Histoire racontée en fin de niveau** par Archibald, avec de l'humour.
- **Aide automatique** : tous les 3 échecs dans un niveau, les pièges ralentissent.
- **Économie**
  - Des pièces d'or permettent d'obtenir des amulettes de jade (protection contre 2 coups).
  - Après une mort, le jeu propose « Repartir d'ici ? ».
  - Après beaucoup d'échecs, on peut passer le niveau.
  - Pubs et achats passent par le **kit commun** : AdMob et RevenueCat dans l'appli, écrans de démonstration de Max sur le web (voir « Monétisation » plus bas).
- **Sauvegarde** de la progression. Chaque niveau a un identifiant stable (`inca-3`, `aby-12`…), et la sauvegarde suit les niveaux même si leur ordre change.

## Monétisation (kit commun)

- **Vidéo récompensée** : `PUB.regarder()` = `Kit.Ads.rewarded()`. Sur le web, `Kit.Ads.simulateur.pub` affiche l'écran `#ecran-pub` de Max (`demoPub`). Récompenses : passer le niveau (après 10 chutes), +1 amulette.
- **Interstitielle** : au bouton « Suite » du récit de fin de niveau, `Kit.Ads.maybeInterstitial(numéro)` (règles du kit : à partir du niveau 4, une partie sur 3, 2 minutes). Simulée sur le web par `demoInterstitielle` (même écran, compte à rebours).
- **Bannière** : seulement sur les menus hors partie (`MENUS_AVEC_BANNIERE` dans `showOverlay` : carte des mondes, options, boutique, statistiques, avis, quitter), jamais en jeu ni en pause. **Pas sur l'accueil** : en paysage, elle cacherait les boutons dessinés sur l'illustration. Les panneaux lui laissent la place (`bottom: var(--kit-banniere-h)`).
- **Boutique** : échange de pièces et vidéo (gratuits), puis les offres payantes de `jeu.json` (`#offres-payantes`, construit par `majBoutique` avec les prix du store) : « Sans pub » 3,99 €, 10 amulettes 0,99 €, pack aventurier (25 amulettes + chapeau doré, une fois) 1,99 €, 60 amulettes 4,99 €. Achat : `Kit.Store.buy`, puis `Kit.Boutique.accorder` ; sur le web, l'écran `#ecran-achat` sert de paiement simulé. « Restaurer mes achats » dans la boutique et les options, « Confidentialité et publicité » dans les options si la loi l'exige.
- **Statistiques anonymes** (`Kit.Stats`, PostHog) : `debut` dans `startLevel`, `death` (position de la chute
  en cases) et compteur `morts` à chaque chute, `gagne` dans `montrerRecit`, `quitter` dans `goHome`,
  `quitterVersMonde` et `passerNiveau` (`level_skip`), compteurs `relances`, `amulettes`, `restarts`.
  Identifiant et réglage dans la sauvegarde à part `maxjade.stats` (`progress.stats` contient déjà les
  statistiques locales par niveau). Bouton « Statistiques anonymes » dans les options. Liste : `docs/statistiques.md`.
- Les fenêtres du kit ne sont pas utilisées : elles ne pivoteraient pas avec le jeu quand le téléphone est tenu droit (`body.rot`).
- Sauvegarde `temple-progres` : `progress` reçoit aussi `noAds` et `bought` (kit). La clé ne suit pas la convention `<id>.v1` : ne pas la renommer, les joueurs perdraient leur progression.
- Appli : le jeu se joue en paysage ; dans les projets natifs, verrouiller l'orientation (`android:screenOrientation="sensorLandscape"` dans `AndroidManifest.xml`, orientations paysage seulement dans Xcode) ou utiliser `@capacitor/screen-orientation`.

## Écarts avec les conventions communes (à décider avec le propriétaire)

- **Prix** : l'ancien « Pack aventurier » coûtait 2,99 € (40 amulettes + chapeau), hors de la grille 0,99/1,99/4,99 €. Il passe à 1,99 € (25 amulettes + chapeau, une seule fois), et un coffre de 60 amulettes à 4,99 € est ajouté.
- **Pas de vies, de bonus ni de cadeau du jour** : remplacés par les amulettes, les pièces, « Repartir d'ici ? » et l'aide automatique. C'est permis.
- **Pas de rappels (notifications)** ni de tutoriel guidé avec main animée ; à la place, des fiches « Nouveauté » animées (monde 3 pour l'instant).
- **Réglages** : l'écran Options n'a ni interrupteur de musique (il n'y a que des bruitages) ni « Effacer ma progression ».

## État d'avancement

- **Les 5 mondes sont jouables de bout en bout**, avec 100 niveaux et 5 boss.
- Le vérificateur confirme que les 100 niveaux sont faisables, avec 0 à 3 morts.
- Des robots de test battent les 5 boss.
- Les mondes 1 à 3 ont été joués et validés par le testeur principal : longueur, difficulté et pièges surprises.
- Les mondes 4 et 5 ont été finis le 9 et le 10 novembre 2026. Ils sont en cours de test réel. Premiers retours traités :
  - salamandre impossible à sauter, corrigé ;
  - fin du Fouisseur avec l'Œil de Jade, ajoutée.
  - 1-9 : des pièges surprises qui se suivaient ne laissaient qu'une case pour atterrir entre des pics et un trou, corrigé. Le générateur refuse désormais tout piège qui crée un tel îlot, et le vérificateur le signale comme une erreur.
  - 1-9 (suite) : les 3 cases de pics qui jaillissaient sur la partie haute ne se sautaient pas (robot : mort à tous les coups). Les pics surprises font maintenant 2 cases au plus ; le vérificateur refuse des pics de 3 cases ou plus qui jaillissent à 4 cases ou moins devant Max. Niveaux modifiés : 1-2, 1-9, 1-13.
  - Textes d'aide et bulles d'Archibald : 2 s de plus à l'écran (`AIDE_EN_PLUS`).
  - 2-20 (yéti) : le texte d'aide était coupé sur téléphone ; une aide trop large passe maintenant à la ligne.
  - Abysses (monde 3) : en restant à la surface, il suffisait d'avancer. Un plafond de roche couvre maintenant l'eau ; on ne respire qu'aux bulles et dans quelques poches d'air (`Ocean.plongee`, `ECART_AIR`), réserve d'air 10 s. Le vérificateur ne compte plus d'air sous la roche.
  - Abysses trop calmes (« on avance sans problème, on s'ennuie ») : nouveaux passages (`mur_mines` rideaux de mines en slalom, `chicanes` rochers à oursins et coraux, `eboulement` blocs qui tombent de la roche), plus de requins, moins d'eau vide, et 4 nouvelles surprises (oursins qui jaillissent de la roche, éboulement, rideau de mines, requin de face). Pièges surprises : 9 à 20 par niveau (avant : 3 à 10). Une colonne de bulles est ajoutée là où 16 colonnes passent sans air (`bulles_manquantes`).
  - 3-8 (mines flottantes) : une mine perdue (touchée, ou poussée du mauvais côté) laissait un mur fissuré impossible à casser. Une mine de la carte revient à sa place 2,5 s après son explosion tant qu'un mur fissuré reste à ouvrir devant elle (`murFissureDevant`, action `remine`).
  - Abysses, retours du 21 novembre :
    - **Fiches « Nouveauté »** : à l'arrivée du premier niveau qui apporte une mécanique importante, une petite scène animée et deux phrases ; le jeu attend « OK, c'est parti ! » (bouton ou toucher, pas avant 2/3 s). Une seule fois par mécanique (`progress.nouveautes`). Liste `nouveau` du niveau, scènes dans `NOUVEAUTES` (`game.js`). Monde 3 : air sous la roche et méduse (3-1), mine (3-2), requin (3-3), coffre (3-5), sas (3-7), abysses noirs (3-10), tourbillon (3-13). Elles remplacent presque toutes les aides en texte du début des niveaux.
    - Mines : le 3-2 commence par une mine devant un mur fissuré (on ne passe qu'en la poussant). Pas de mine ni de requin surprise avant leur fiche (`SANS_PIEGES_MER`).
    - Moins de messages : plus de bulles d'Archibald « je ralentis… » (l'aide automatique ralentit en silence). Message de mort du requin cohérent (« Un COUP de massue l'assomme un moment ! »).
    - 3-10 : un éboulement laissait un trou d'une case dans le plafond ; au-dessus de bulles, Max y restait coincé à la surface. Le bloc se détache maintenant sous la roche, qui reste intacte.
- **Histoire des fragments** (retours du 24 novembre) :
  - L'Œil de Jade est brisé en 5 fragments, un par monde (Soleil, Glace, Corail, Orage, Feu). Chaque boss assommé lâche son fragment (`lacherFragment`), qui vient flotter près de Max ; une fois ramassé, la porte s'ouvre. Après le Fouisseur, les cinq fragments s'assemblent au-dessus de Max. Sauvegarde : `progress.fragments` (masque), complété par les boss déjà battus (`fragmentsTrouves`).
  - Dessin : `drawOeilDeJade(x, y, k, masque, fantome)` découpe l'Œil en 5 parts de 72° ; `lesSprites().oeil(masque)` en fait une image (carte des mondes, récit d'ouverture, écran de fin).
  - Récit d'ouverture : avant le premier niveau de chaque monde, l'histoire s'affiche une fois (`#ecran-intro`, `montrerIntro`, textes `INTROS_MONDES` dans `niveaux.py`, champ `intro` du niveau ; `progress.intros`). Les récits de fin des niveaux 5, 10 et 20 parlent des fragments au lieu des morceaux de carte.
  - Carte des mondes : l'Œil et ses fragments trouvés remplacent la rose des vents. Écran de fin : l'Œil entier entre Max et Archibald, et l'épilogue.
  - 1-19 (le sablier) : le sable était trop loin. Crue « collante » : elle ne reste jamais à plus de 5 cases sous les pieds de Max (+2 cases à chaque palier de l'aide automatique) ; paramètre `colle` de l'action `flood`.
- **Boss plus clairs** (retours du 24 novembre) :
  - Chaque boss a sa fiche animée au début du combat (`boss_jaguar`, `boss_yeti`, `boss_pieuvre`, `boss_oiseau`, `boss_fouisseur` dans `NOUVEAUTES`), revue après 3 chutes (`restartRoom`). Elles remplacent les aides en texte du début des combats.
  - Repères pendant le combat (`drawReperesBoss`, `drawRepere`) : « SAUTE ! » sur le Jaguar sonné et « LIANE ! » quand il gratte, « SAUTE ! » quand le Yéti retombe, « COUP ! » sur la mine qui approche et sur la cloche quand l'oiseau passe, « TNT » sur la cheminée à viser. Messages de coup raccourcis (« Encore 2. »).
  - **Nouvelle pieuvre** : elle lance des mines qui dérivent vers Max ; un COUP de massue la renvoie droit sur sa tête (si Max la regarde). 3 mines dans la tête et elle s'endort. Elle frappe toujours avec une tentacule annoncée par son ombre, et crache de l'encre après le premier coup. Les coquillages ont disparu.
- **Combat final en 3 manches** (5-20, retours du 24 novembre). Le niveau a une liste `manches` (`niveaux.py` : `boss_fouisseur`, `manche_poursuite`, `manche_duel`) ; `buildRoom` fusionne la manche `game.manche` avec le niveau, `mancheSuivante` passe à la suivante (carte de titre, puis la fiche de la manche). Une chute fait recommencer la manche en cours.
  1. **Le Fouisseur**, plus dur : chaque cheminée a un couvercle qui ne se soulève (en vert) qu'un moment, juste avant la fumée ; une TNT lâchée sur un couvercle fermé rebondit. 3 cheminées : la machine explose, la cabine d'Archibald s'enfuit.
  2. **La poursuite** : montée verticale (40 cases de haut), la lave monte avec la foreuse (crue collante, 5 cases), pierres en fusion annoncées par leur ombre (`updatePoursuite`, `drawForeuse`).
  3. **Le duel** (`updateArchibald`, `drawCabine`) : la cabine pendue à un bras attaque avec les pièges des mondes (rochers qui roulent, puis glaçons et éclairs, puis mines qu'on peut lui renvoyer). Après chaque attaque, elle surchauffe et se pose : Max saute dessus (ou un COUP). 3 coups : Archibald sort, le dernier fragment roule et l'Œil se reconstitue. Pendant le duel, la caméra garde la cabine à l'écran.
- Commandes tactiles retravaillées le 10 novembre : saut fiable même sur un appui bref, grand bouton SAUT rectangulaire. À confirmer sur téléphone.

## Ce qui reste à faire

- **Valider en jeu les mondes 4 et 5**, en particulier :
  - la difficulté des sauts entre nuages ;
  - les moulins, les cerfs-volants et le wagonnet ;
  - le combat contre l'Oiseau-tonnerre ;
  - le Fouisseur.
- **Confirmer sur un vrai téléphone** que le bouton SAUT ne rate plus aucun appui, et que le jeu reste fluide dans les mondes 4 et 5.
- **Combat final** : à valider en jeu (difficulté de la poursuite et du duel).
- **Musique** : il n'y a que des bruitages synthétisés. Le cadrage prévoit une musique par monde.
- **Version des stores** (appli) : pubs et achats sont branchés par le kit, avec des identifiants de test (`jeu.json`). Restent les vrais identifiants, les produits dans les stores, le verrouillage en paysage et l'essai sur téléphone (checklist de `docs/publication.md`).
- ~~Tests automatiques en intégration continue~~ : fait, par le workflow `tests.yml` du dépôt commun.
- **Nettoyage**
  - `niveaux.py` contient encore les fonctions des anciens niveaux provisoires (`acte1` à `acte10`). Elles servent seulement à reprendre les anciennes sauvegardes.
  - `game.js` mériterait d'être découpé par monde.
- **Mondes futurs** envisagés dans `CADRAGE.md` : pyramides, île aux pirates, forêt hantée, train fou, banquise, laboratoire d'Archibald.
