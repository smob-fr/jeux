# Pingo Glisse : notes pour Claude Code

**Prototype.** Un pingouin glisse sur des collines enneigées ; la banquise fond derrière lui et finit
par le rattraper. Deux modes : **Sans fin** (aller le plus loin possible) et **Aventure** (3 mondes de
10 niveaux, arriver à l'igloo avant la fonte, 1 à 3 étoiles selon les poissons). Lis d'abord le
`CLAUDE.md` de la racine (stack, kit, monétisation, conventions).

- Origine : artefact claude.ai `EkNfEF2iAKN1aCmSrsXfkF` (novembre 2026), puis accueil, aventure,
  poissons bleus et dorés, nouvelle banquise.
- `jeu.json` : id `pingo`, `"statut": "prototype"` (le contrôle des conventions ne fait que des
  avertissements sur la monétisation). appId `fr.smob.pingo`.

## Commandes

Depuis `jeux/pingo/` :

```bash
npm run build      # installe le kit dans kit/, puis copie index.html, moteur.js, niveaux-construits.js et le kit dans www/
npm run serve      # build, puis http://localhost:8080
npm test           # build, niveaux construits à jour, vérification des niveaux, test de bout en bout (~1 min 30)
npm run niveaux    # tableau des 30 niveaux : parcours parfait, sauts, crevasses, pente max, robots simples
npm run construire # reconstruit les 30 niveaux et le niveau test (niveaux-construits.js, ~2 min)
npm run construire -- 1-3 2-5   # seulement ces niveaux (DEBUG=1 pour le détail)
```

**Les niveaux se règlent dans `outils/plans-niveaux.mjs`**, puis `npm run construire` et `npm run niveaux`.
**Après tout changement de la physique : `npm run construire`** (tous les niveaux). `npm test` échoue si
un plan a changé sans reconstruction, ou si un parcours parfait enregistré n'arrive plus au bout.

## Architecture

- `moteur.js` : le jeu sans affichage, utilisable dans le navigateur (`window.Pingo`) et sous Node
  (`require`). Collines, physique, poissons, banquise, crevasses, mondes, rejeu du parcours parfait.
  Événements envoyés à l'interface par `on(type, données)` : `poisson`, `turbo`, `decollage`, `salto`,
  `saltoReussi`, `atterrissage` (`parfait`, `dur`, `boum`, `tete`), `hautVol`, `plouf`, `gagne`.
- `niveaux-construits.js` (généré) : pour chaque niveau, relief, poissons, crevasses, appuis du pingouin
  parfait, marge, plan utilisé.
- `index.html` : écrans (accueil, comment jouer, carte, fiche « Nouveau ! », pause, « Plouf ! »,
  « Bravo ! »), bandeau, dessin sur canvas, sons Web Audio, sauvegarde, statistiques. Aucune image,
  aucun son en fichier. Seule dépendance externe : la police Baloo 2 (Google Fonts), facultative.
- `outils/robots.cjs` : pingouins robots. À règles simples : `rien`, `debutant`, `bon` (ce que disent
  les bulles d'aide). Qui prévoient : `parfait` (recherche en faisceau) et `expert` (profils `moyen`,
  `joueur`, `expert`).
- `outils/plans-niveaux.mjs`, `outils/construire-niveaux.mjs`, `outils/verifier-niveaux.mjs` : voir plus bas.

### Moteur

- **Relief du mode sans fin et du terrain d'essai** : motifs du creux au creux, interpolés en cosinus
  (`h`, `pente`, `courbure`). Les niveaux de l'aventure, eux, sont construits (plus bas).
  - *bosse* : montée puis longue descente. **Les descentes font environ 1,8 fois les montées**, et les
    montées s'allongent avec la hauteur (pente d'au plus 30° environ) : sinon le pingouin décolle
    comme d'un tremplin, survole toute la descente et cogne la montée suivante (« Boum »).
  - *tremplin* : grand sommet (×1,5), puis 1 ou 2 petites bosses plus bas, puis une longue descente.
    Bien lancé, on survole les petites bosses ; un arc de poissons suit le vol idéal.
- **Physique** (`step`, sous-pas de 1/240 s) : au sol, la pente accélère ou freine (`G = 1150`,
  `DIVE = 2600` en plus quand on appuie, au sol comme en l'air). Frottement 0,06/s à plat ventre (on
  appuie), 0,25/s sinon. On décolle en haut d'une bosse si la vitesse est trop forte pour suivre la
  courbe et qu'on n'appuie pas.
- **Vitesse maximale souple** (`vmax` du niveau, 1 400 au 1-1 jusqu'à 2 300 ; sans fin : 1 100 puis +1
  par mètre) : les pentes n'accélèrent pas au-delà, mais les bonus la dépassent (jusqu'à +700,
  `SURVITESSE`) et l'excès s'estompe (60 %/s au sol, `ESTOMPE`). Bien enchaîner fait aller plus vite.
- **Atterrissage** : dans le sens de la descente → « Glisse parfaite » (+12 % +100, jusqu'à +20 % après
  un vol de 1,5 s ou plus) ; brutal → perte
  de vitesse (« Boum ! » si très mal aligné) ; au milieu d'un salto → « Aïe, sur la tête ! » (×0,35) ;
  chaque salto réussi → +200. Grand saut (plus de 420 au-dessus du sol) → « Haut vol ! » : +2 au turbo.
- **Poissons** : jaunes ×1 (rangées au sol, arcs), **bleus ×3** et **dorés ×5** (haut au-dessus des
  sommets, au bout des arcs des tremplins). La valeur remplit le turbo (8 → turbo 2,6 s, vitesse
  maximale +300, fonte repoussée de 450), repousse la fonte (30, 120, 220) et compte pour les étoiles.
- **Banquise d'un niveau : elle suit le pingouin parfait** (ses appuis sont rejoués au départ,
  `rejouer`) avec `marge` secondes de retard, 300 px derrière, moins ce que les poissons l'ont fait
  reculer. Pour arriver au bout, il faut rester à moins de `marge` secondes du parcours parfait.
  `g.avance` donne l'avance (ou le retard) sur lui. Sans fin : `v0 400, acc 10, max 1 500, ecart 2 500`.
- **Arrivée** (aventure) : drapeau à damier à la longueur du niveau, puis du plat et l'igloo.
- `creerPartie({ fantome })` : partie de calcul sans poissons ni banquise ; `{ rejeu }` : sans banquise ;
  `sauver()` / `restaurer()` : état complet (poissons compris) pour les robots.

### Niveaux de l'aventure : construits par le vol (`outils/construire-niveaux.mjs`)

Le relief n'est pas tiré au hasard : il est **construit en faisant jouer le pingouin parfait** (recherche
en faisceau, `robots.cjs › etape`, sans plongée en l'air) au fur et à mesure.
- Départ : le pingouin part du **plateau d'une petite bosse** (en x = 0), puis bosses d'**élan**.
- Relief `[hauteur, montée, descente, plateau]` : le plateau élargit les sommets (deux points à la même hauteur).
- Ensuite, selon la vitesse du pingouin parfait au dernier creux : lent → une **bosse de glisse** ;
  rapide (plus de `saut.vitesse` × `vmax`) → un **saut calculé**, suivi de `saut.recup` bosses d'élan
  (pour se rattraper après un saut raté).
- Saut : une bosse de décollage ; on simule le vol (à `saut.tolerance` × la vitesse parfaite) et on pose
  la **bosse cible** là où il retombe, sa descente inclinée comme la trajectoire, son sommet au moins
  90 px sous le vol (jamais plus de 350 px sous le décollage). Entre les deux : un creux, ou une
  **crevasse remplie d'eau** (probabilité `saut.eau`). Chaque saut est vérifié (le pingouin parfait
  retombe proprement sur la cible), sinon recalculé.
- Rater un saut : un peu court → « Boum » contre la bosse cible ; bien trop court → l'eau, si crevasse
  (vitesse limitée à 380, pas de décollage). Plus vite que prévu → plonger en l'air pour redescendre.
- **Pentes ≤ 1 (45°)** partout (`PENTE_MAX`) : montées et parois élargies, pied des bosses cibles ≥ -300.
- Points arrondis dès la construction (le terrain enregistré est exactement celui joué).
- Dans ces niveaux, le turbo ne donne pas de vitesse (les cibles sont calculées pour la vitesse du
  parcours parfait) ; il repousse la banquise.
- **Banquise** : elle suit le parcours parfait avec `marge` secondes de retard.

### Plans (`outils/plans-niveaux.mjs`)

| | Bosses | Sauts | Crevasses | Banquise |
|---|---|---|---|---|
| 1-1 → 1-3 | 70-100, rapprochées (montée ~430, descente ~500), sommets en plateau (~200), vitesse 1 000 → 1 150 | dès le 1-1, très tolérants (84-86 %) | non | 9-8,5 s |
| monde 1 | 110 → 150 | tolérance 88 → 90 % | non | 9 → 7 s |
| monde 2 | 140 → 170 | 90 → 92 % | 50 → 80 % des sauts | 6,5 → 5 s |
| monde 3 | 170 → 200 | 92 → 94 % | 85 → 100 % | 5 → 4 s |

Aides et fiches (`EXTRAS` du moteur) : rythme au 1-1 et au 1-2, salto et poisson bleu au 1-3, poisson
d'or au 1-4, crevasse au 2-1. **Étoiles** : 1 à l'arrivée, 2 avec 30 % de la valeur des poissons, 3
avec 60 % (`SEUILS`). Déblocage : le niveau suivant quand le précédent est fini ; un monde quand le 10
du précédent est fini.

### Vérification des niveaux (`outils/verifier-niveaux.mjs`, lancée par `npm test`)

Parcours parfait au bout en 12 à 75 s (sans « Boum » au 1-1) ; aucune pente au-dessus de 1,1 ; le robot
`bon` (règles simples, ce que disent les bulles) finit les 5 premiers niveaux, sans « Boum » au 1-1 ; à
partir du 1-2, ne rien faire ne suffit pas ; au moins 20 poissons ; sans fin : aucun « Boum » du
débutant sur les 300 premiers mètres. Repère : le robot `bon` finit presque tout le monde 1, le début
du monde 2, rien du monde 3 (les sauts au-dessus des crevasses demandent d'anticiper).

### Interface (`index.html`)

- `ecran` : `accueil`, `carte` (démonstration sans fonte en arrière-plan), `jeu`, `pause`, `fin`.
- **Caméra dézoomée** : environ 1 150 px du monde en largeur sur téléphone (`baseScale`), pingouin à
  25 % de la largeur, sol vers 70 % de la hauteur ; pingouin et poissons dessinés un peu plus gros
  (`grossir`). Quand le bord de la banquise est à moins d'une demi-largeur d'écran, le pingouin avance
  jusqu'à 50 % pour qu'on le voie.
- Jauge « Banquise » : en aventure, le retard sur le parcours parfait rapporté à la marge.
- « Bravo ! » : poissons, temps du joueur et temps du parcours parfait.
- **Banquise dessinée** : mer à niveau lissé, falaise de glace au bord déchiqueté, strates, corniche et
  stalactites, fissures sur la neige devant le bord, blocs qui tombent à l'eau ; le pingouin y tombe.
- Pause : bouton en haut à droite, Échap ou P, et automatiquement quand l'appli passe en arrière-plan.
- Objet de test : `window.__pingo` (`p`, `g` la partie du moteur, `state` : `menu`, `play`, `pause`,
  `over`, `win` ; `ecran`, `fish`, `save`).

### Terrain d'essai (lien sur l'accueil)

Pour régler le relief en jouant, sans refaire tous les niveaux : curseurs hauteur des bosses, longueur
des montées, longueur des descentes, vitesse maximale, part de tremplins (± 10 % d'une bosse à l'autre),
préréglages `ESSAIS` (actuel, rapproché, montagnes russes). Sans fin et sans banquise ; le bandeau
compte les glisses parfaites (✨) et les « Boum » (💥) ; la pause rouvre les réglages avec un bilan.
Réglages gardés dans `save.essai`. La fiche affiche une ligne « Valeurs : … » que le propriétaire
recopie : on reprend ensuite ces valeurs dans `outils/plans-niveaux.mjs`, puis `npm run construire`.
Moteur : `Pingo.essai(réglages)` donne l'option `essai` de `creerPartie`.

### Constructeur de bosses (terrain d'essai)

Le propriétaire dessine les premières bosses au doigt : profil (hauteurs dessinées ×4 environ) avec des
poignées (départ : hauteur ; sommets : position = montée, hauteur ; creux : position = descente,
profondeur), plateau du sommet choisi, vitesse maximale, + / − bosse. « Jouer ces bosses » : le tracé
répété 3 fois, sans banquise (`niveau.sansBanquise`), le pingouin part du plateau de la bosse de départ ;
la pause ramène à l'éditeur avec le bilan. Tracé gardé dans `save.editeur` ; la ligne « Valeurs : … »
(vitesse ; départ h p d c ; puis pour chaque bosse m h p d c) est à reprendre dans
`outils/plans-niveaux.mjs`. Moteur : `EDITEUR` (tracé par défaut), `pointsEditeur`, `niveauEditeur`.

### Niveau test (terrain d'essai)

Le plan `test` d'`outils/plans-niveaux.mjs` (bosses 170 / 850 / 1 050, vitesse 2 100, crevasses à
chaque saut), jouable depuis le terrain d'essai avec un curseur « Retard de la banquise » ; il ne compte
pas dans l'aventure.

### Sauvegarde (`pingo.v1`, `Kit.creerSauvegarde`)

`uid`, `stats` (statistiques), `essai` (réglages du terrain d'essai), `editeur` (bosses dessinées), `margeTest` (retard de la banquise du niveau test), `best` (record sans fin, repris de l'ancienne clé `pingo.best`, qui est
encore écrite), `son`, `niveaux` (`{ "1-1": 3 }`, meilleures étoiles), `vus` (aides et fiches déjà
montrées). Sans le kit (`index.html` ouvert directement), une version minimale fait la même chose.

## Règles du jeu

- **Appui long** : plonger dans les descentes pour prendre de la vitesse.
- **Relâcher** : se laisser décoller en haut des bosses.
- **Toucher en l'air** (appui bref) : salto, bonus de vitesse si on retombe sur le ventre.
- **Poissons** : jaunes ×1, bleus ×3, dorés ×5 (tout là-haut) ; 8 → turbo, et la fonte recule.
- Sans fin : jusqu'à ce que la banquise rattrape le pingouin ; record.
- Aventure : arriver à l'igloo avant que la banquise (qui suit le parcours parfait) ne rattrape le
  pingouin ; étoiles selon les poissons.

## État d'avancement

- Accueil (Aventure, Sans fin, comment jouer, son, statistiques), carte des 3 mondes, 30 niveaux avec
  leur parcours parfait, tremplins, étoiles, fiches « Nouveau ! », aides de rythme, pause, écrans de fin.
- Kit : sauvegarde et statistiques (`session_start`, `run_*` en sans fin, `level_*` en aventure).
- Pas encore de pubs, de boutique, de vibrations, de musique, ni de réglages complets (seulement le son).
- Les seuils d'étoiles (30 % / 60 %) sont à confirmer avec de vrais joueurs : les robots ne visent pas
  les poissons et font souvent une seule étoile.

## Pour en faire un jeu (pistes)

1. Faire tester l'aventure sur téléphone : marges (difficulté), seuils d'étoiles, aides du 1-1, zoom.
   Peut-être un pingouin « fantôme » transparent qui montre le parcours parfait, et le jeu en paysage
   (on verrait bien plus loin devant).
2. Kit : `Sound` pour les réglages son et vibrations, `Ecrans`, réglages complets, tutoriel guidé
   (main animée) à la place de la bulle « Appuie ! ».
3. Monétisation proposée, à valider : bannière sur l'accueil, la carte et les écrans de fin seulement ;
   interstitielle après une partie sur 3 (règles du kit) ; vidéo récompensée « repartir d'où je suis
   tombé » une fois par partie ; boutique : « Sans pub », écharpes et bonnets (cosmétiques), lots de
   « poissons d'or » pour un turbo au départ.
4. Nouveaux mondes avec une mécanique chacun (tremplins de glace, crevasses, vent, phoques à éviter) ;
   missions (« fais 3 saltos »), cadeau du jour, pingouins à débloquer.
5. Retirer la police externe (ou l'embarquer) pour jouer hors ligne ; manifeste et icônes.
