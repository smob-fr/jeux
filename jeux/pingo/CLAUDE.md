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
npm run build      # installe le kit dans kit/, puis copie index.html, moteur.js et le kit dans www/ (générés)
npm run serve      # build, puis http://localhost:8080
npm test           # build, calibrage à jour ?, vérification des niveaux, test de bout en bout (~1 min)
npm run niveaux    # tableau de chaque niveau joué par les robots (bon, débutant, sans rien faire)
npm run calibrer   # recalcule la vitesse de la fonte de chaque niveau (table CALIBRAGE de moteur.js)
```

**Après tout changement de la physique, du relief, des poissons ou des niveaux : `npm run calibrer`**,
puis `npm run niveaux` pour voir le résultat. `npm test` échoue si la table n'est plus à jour.

## Architecture

- `moteur.js` : le jeu sans affichage, utilisable dans le navigateur (`window.Pingo`) et sous Node
  (`require`). Collines, physique, poissons, banquise, mondes et niveaux. Événements envoyés à
  l'interface par `on(type, données)` : `poisson`, `turbo`, `decollage`, `salto`, `saltoReussi`,
  `atterrissage` (`parfait`, `dur`, `boum`, `tete`), `hautVol`, `plouf`, `gagne`.
- `index.html` : écrans (accueil, comment jouer, carte, fiche « Nouveau ! », pause, « Plouf ! »,
  « Bravo ! »), bandeau, dessin sur canvas, sons Web Audio, sauvegarde, statistiques. Aucune image,
  aucun son en fichier. Seule dépendance externe : la police Baloo 2 (Google Fonts), facultative.
- `outils/robots.cjs` : pingouins robots (`rien`, `debutant`, `bon`) qui jouent avec le moteur.
- `outils/verifier-niveaux.mjs` et `outils/calibrer-niveaux.mjs` : voir plus bas.

### Moteur

- **Collines** : sommets et creux alternés, interpolés en cosinus (`h`, `pente`, `courbure`). Chaque
  bosse a sa hauteur, sa profondeur, sa **descente** et sa **montée**. Une longue descente par rapport à
  la vitesse laisse le pingouin retomber dans la pente suivante : c'est ce qui rend les premiers niveaux
  faciles. Une « grosse bosse » (plus haute, plus longue) permet de s'envoler vers les gros poissons.
- **Physique** (`step`, 4 sous-pas par image) : au sol, la pente accélère ou freine (`G = 1150`,
  `DIVE = 2600` en plus quand on appuie). **Frottement** : 0,06/s à plat ventre (on appuie), 0,25/s
  sinon : plonger fait vraiment gagner du temps, ne rien faire fait perdre. Vitesse entre 230 et une
  **vitesse maximale par niveau** (`vmax` : 1 000 au 1-1, jusqu'à 2 300) ; en sans fin, 1 050 jusqu'à
  300 m puis +1 par mètre jusqu'à 2 300. On décolle en haut d'une bosse si la vitesse est trop forte
  pour suivre la courbe et qu'on n'appuie pas.
- **Atterrissage** : dans le sens de la descente → « Glisse parfaite » (+8 % +60) ; brutal → perte de
  vitesse (« Boum ! ») ; au milieu d'un salto → « Aïe, sur la tête ! » (×0,35) ; chaque salto réussi
  → +160. Grand saut (plus de 420 au-dessus du sol) → « Haut vol ! » : +2 au turbo.
- **Poissons** : jaunes ×1 (rangées au sol dans les descentes et au début des montées, petits arcs
  après les sommets), **bleus ×3** (210 à 300 au-dessus d'un sommet), **dorés ×5** (400 à 520 au-dessus).
  La valeur remplit le turbo (8 → turbo 2,6 s, fonte repoussée de 450) et repousse la fonte (30, 120,
  220). En aventure, elle compte pour les étoiles.
- **Banquise** : `meltX` avance à `min(max, v0 + acc × temps)`, jamais à plus de `ecart` derrière.
  Sans fin : `v0 400, acc 10, max 1 500, ecart 2 500`. Niveaux : `v0 300, acc 150, ecart 3 000`, et `max`
  calibré (voir plus bas). Elle rattrape le pingouin → « Plouf ! ».
- **Arrivée** (aventure) : drapeau à damier à la longueur du niveau, puis du plat et l'igloo 650 plus
  loin ; le pingouin y entre en glissant.

### Niveaux (`MONDES`, `PREMIERS`, `niveau(monde, i)`)

- Monde 1 « La Banquise » (jour), 2 « Le Fjord du Couchant », 3 « La Nuit Polaire » (aurore boréale).
- 1-1, 1-2, 1-3 réglés à la main (`PREMIERS`) : bosses basses, très longues descentes, `vmax` 1 000 à
  1 200 ; aide « Appuie ! / Lâche ! » au 1-1 et au 1-2 ; aide « Touche : salto ! » et poisson bleu au
  1-3 ; poisson d'or au 1-4 (fiches « Nouveau ! »).
- Les autres : interpolés entre `de` (premier niveau du monde) et `a` (dernier) : longueur, `vmax`,
  relief, poissons, `difficulte`. Graine fixe par niveau : un niveau est toujours le même.
- **Étoiles** : 1 à l'arrivée, 2 avec 30 % de la valeur des poissons, 3 avec 60 % (`SEUILS`).
- Déblocage : le niveau suivant quand le précédent est fini ; un monde quand le 10 du précédent est fini.

### Calibrage de la fonte (`outils/calibrer-niveaux.mjs`)

Pour chaque niveau à partir du 1-3, par dichotomie : `Mi` = vitesse de fonte à partir de laquelle un
pingouin qui ne fait rien est rattrapé, `Md` = la plus rapide où le débutant et le bon robot arrivent au
bout. Fonte = `Mi + difficulte × (Md − Mi)`. Difficulté : 0,15 au 1-3, 0,25 → 0,5 (monde 1),
0,4 → 0,65 (monde 2), 0,55 → 0,8 (monde 3). Résultat écrit dans la table `CALIBRAGE` de `moteur.js`.

### Vérification des niveaux (`outils/verifier-niveaux.mjs`, lancée par `npm test`)

Le bon robot finit tous les niveaux ; le débutant finit tout le monde 1 ; au 1-1 et au 1-2, le débutant
ne fait aucun « Boum » ; à partir du 1-3, ne rien faire ne suffit pas ; durée entre 12 et 75 s ;
au moins 20 poissons ; en sans fin, aucun « Boum » du débutant sur les 300 premiers mètres.
Repères (robots) : sans fin, ~780 m sans rien faire, ~3 100 m débutant, ~4 300 m bon.

### Interface (`index.html`)

- `ecran` : `accueil`, `carte` (démonstration sans fonte en arrière-plan), `jeu`, `pause`, `fin`.
- Caméra : le pingouin à 30 % de l'écran ; quand la banquise approche, il avance jusqu'à 60 % et la
  caméra dézoome un peu (pas en dessous de 0,5) pour qu'on voie le bord.
- **Banquise dessinée** : mer à niveau lissé (vagues, reflets, écume, glaçons qui flottent), falaise
  de glace au bord déchiqueté (toujours le même pour une hauteur donnée), tranche bleutée avec strates
  et fissures, corniche de neige et stalactites, fissures sur la neige devant le bord, blocs qui se
  détachent et tombent à l'eau. À la fin, le pingouin tombe dans l'eau.
- Pause : bouton en haut à droite, Échap ou P, et automatiquement quand l'appli passe en arrière-plan
  (le son est coupé aussi).
- Objet de test : `window.__pingo` (`p`, `g` la partie du moteur, `state` : `menu`, `play`, `pause`,
  `over`, `win` ; `ecran`, `fish`, `save`).

### Sauvegarde (`pingo.v1`, `Kit.creerSauvegarde`)

`uid`, `stats` (statistiques), `best` (record sans fin, repris de l'ancienne clé `pingo.best`, qui est
encore écrite), `son`, `niveaux` (`{ "1-1": 3 }`, meilleures étoiles), `vus` (aides et fiches déjà
montrées). Sans le kit (`index.html` ouvert directement), une version minimale fait la même chose.

## Règles du jeu

- **Appui long** : plonger dans les descentes pour prendre de la vitesse.
- **Relâcher** : se laisser décoller en haut des bosses.
- **Toucher en l'air** (appui bref) : salto, bonus de vitesse si on retombe sur le ventre.
- **Poissons** : jaunes ×1, bleus ×3, dorés ×5 (tout là-haut) ; 8 → turbo, et la fonte recule.
- Sans fin : jusqu'à ce que la banquise rattrape le pingouin ; record.
- Aventure : arriver à l'igloo ; étoiles selon les poissons.

## État d'avancement

- Accueil (Aventure, Sans fin, comment jouer, son, statistiques), carte des 3 mondes, 30 niveaux
  vérifiés et calibrés, étoiles, fiches « Nouveau ! », aides de rythme, pause, écrans de fin.
- Kit : sauvegarde et statistiques (`session_start`, `run_*` en sans fin, `level_*` en aventure).
- Pas encore de pubs, de boutique, de vibrations, de musique, ni de réglages complets (seulement le son).
- Les seuils d'étoiles (30 % / 60 %) sont à confirmer avec de vrais joueurs : les robots ne visent pas
  les poissons et font souvent une seule étoile.

## Pour en faire un jeu (pistes)

1. Faire tester l'aventure sur téléphone : difficulté de la fonte (régler `difficulte`, puis
   `npm run calibrer`), seuils d'étoiles, aides du 1-1.
2. Kit : `Sound` pour les réglages son et vibrations, `Ecrans`, réglages complets, tutoriel guidé
   (main animée) à la place de la bulle « Appuie ! ».
3. Monétisation proposée, à valider : bannière sur l'accueil, la carte et les écrans de fin seulement ;
   interstitielle après une partie sur 3 (règles du kit) ; vidéo récompensée « repartir d'où je suis
   tombé » une fois par partie ; boutique : « Sans pub », écharpes et bonnets (cosmétiques), lots de
   « poissons d'or » pour un turbo au départ.
4. Nouveaux mondes avec une mécanique chacun (tremplins de glace, crevasses, vent, phoques à éviter) ;
   missions (« fais 3 saltos »), cadeau du jour, pingouins à débloquer.
5. Retirer la police externe (ou l'embarquer) pour jouer hors ligne ; manifeste et icônes.
