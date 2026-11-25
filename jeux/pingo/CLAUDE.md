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
npm run build      # installe le kit dans kit/, puis copie index.html, moteur.js, parcours.js et le kit dans www/
npm run serve      # build, puis http://localhost:8080
npm test           # build, parcours parfaits valides, vérification des niveaux, test de bout en bout (~1 min 30)
npm run niveaux    # tableau de chaque niveau : parcours parfait, joueur visé, robots simples
npm run parcours   # recalcule le parcours parfait et la marge de chaque niveau (parcours.js, ~1 min)
npm run parcours -- 2-4 3-1   # seulement ces niveaux
```

**Après tout changement de la physique, du relief, des poissons ou des niveaux : `npm run parcours`**,
puis `npm run niveaux`. `npm test` échoue si un parcours enregistré n'arrive plus au bout.

## Architecture

- `moteur.js` : le jeu sans affichage, utilisable dans le navigateur (`window.Pingo`) et sous Node
  (`require`). Collines, physique, poissons, banquise, mondes et niveaux, rejeu du parcours parfait.
  Événements envoyés à l'interface par `on(type, données)` : `poisson`, `turbo`, `decollage`, `salto`,
  `saltoReussi`, `atterrissage` (`parfait`, `dur`, `boum`, `tete`), `hautVol`, `plouf`, `gagne`.
- `parcours.js` (généré) : pour chaque niveau, la marge et les appuis du pingouin parfait.
- `index.html` : écrans (accueil, comment jouer, carte, fiche « Nouveau ! », pause, « Plouf ! »,
  « Bravo ! »), bandeau, dessin sur canvas, sons Web Audio, sauvegarde, statistiques. Aucune image,
  aucun son en fichier. Seule dépendance externe : la police Baloo 2 (Google Fonts), facultative.
- `outils/robots.cjs` : pingouins robots. À règles simples : `rien`, `debutant`, `bon` (ce que disent
  les bulles d'aide). Qui prévoient : `parfait` (recherche en faisceau) et `expert` (profils `moyen`,
  `joueur`, `expert`).
- `outils/parcours-parfaits.mjs` et `outils/verifier-niveaux.mjs` : voir plus bas.

### Moteur

- **Relief en motifs**, du creux au creux, interpolés en cosinus (`h`, `pente`, `courbure`) :
  - *bosse* : montée puis longue descente. **Les descentes font environ 1,8 fois les montées**, et les
    montées s'allongent avec la hauteur (pente d'au plus 30° environ) : sinon le pingouin décolle
    comme d'un tremplin, survole toute la descente et cogne la montée suivante (« Boum »).
  - *tremplin* : grand sommet (×1,5), puis 1 ou 2 petites bosses plus bas, puis une longue descente.
    Bien lancé, on survole les petites bosses ; un arc de poissons suit le vol idéal.
- **Physique** (`step`, sous-pas de 1/240 s) : au sol, la pente accélère ou freine (`G = 1150`,
  `DIVE = 2600` en plus quand on appuie, au sol comme en l'air). Frottement 0,06/s à plat ventre (on
  appuie), 0,25/s sinon. On décolle en haut d'une bosse si la vitesse est trop forte pour suivre la
  courbe et qu'on n'appuie pas.
- **Vitesse maximale souple** (`vmax` du niveau, 1 100 au 1-1 jusqu'à 2 200 ; sans fin : 1 100 puis +1
  par mètre) : les pentes n'accélèrent pas au-delà, mais les bonus la dépassent (jusqu'à +700,
  `SURVITESSE`) et l'excès s'estompe (60 %/s au sol, `ESTOMPE`). Bien enchaîner fait aller plus vite.
- **Atterrissage** : dans le sens de la descente → « Glisse parfaite » (+12 % +100) ; brutal → perte
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

### Niveaux (`MONDES`, `PREMIERS`, `niveau(monde, i)`)

- Monde 1 « La Banquise » (jour), 2 « Le Fjord du Couchant », 3 « La Nuit Polaire » (aurore boréale).
- 1-1, 1-2, 1-3 réglés à la main (`PREMIERS`) : bosses simples, `vmax` 1 100 à 1 250, marges 7, 6 et
  5,5 s ; aide « Appuie ! / Lâche ! » au 1-1 et au 1-2 (et « Appuie : redescends ! » en l'air) ;
  premiers tremplins, aide « Touche : salto ! » et poisson bleu au 1-3 ; poisson d'or au 1-4.
- Les autres : interpolés entre `de` et `a` de chaque monde : longueur, `vmax`, relief (`tremplins`,
  `double`), poissons, **marge** (monde 1 : 5 → 4 s ; monde 2 : 4 → 3 s ; monde 3 : 3 → 2 s).
- **Étoiles** : 1 à l'arrivée, 2 avec 30 % de la valeur des poissons, 3 avec 60 % (`SEUILS`).
- Déblocage : le niveau suivant quand le précédent est fini ; un monde quand le 10 du précédent est fini.

### Parcours parfaits (`outils/parcours-parfaits.mjs` → `parcours.js`)

- **Pingouin parfait** : recherche en faisceau. Toutes les 0,05 s, on garde les 150 meilleures
  situations (distance + 0,6 × vitesse), on essaie « appuyer » et « lâcher » pour chacune, et la première
  qui atteint l'igloo donne le parcours. Appuis enregistrés en hexadécimal (1 bit par 0,05 s).
- **Marge calculée** : la marge prévue dans `moteur.js`, ou plus si le joueur visé en a besoin : son plus
  grand retard sur le parcours parfait + 0,5 s. Joueur visé : profil `moyen` (voit 0,6 s devant, réagit
  en 0,2 s) dans le monde 1, `joueur` (0,8 s, 0,15 s) dans le monde 2, `expert` (1,2 s, 0,1 s) dans le
  monde 3.
- Attention : les robots qui prévoient simulent la physique parfaitement et jouent presque aussi bien
  que le pingouin parfait. Les robots à règles simples (`bon`, `debutant`) ressemblent plus à un humain :
  ils finissent presque tout le monde 1, de moins en moins le monde 2, presque rien du monde 3. Les
  marges sont **le** réglage de difficulté à ajuster avec les retours des joueurs.

### Vérification des niveaux (`outils/verifier-niveaux.mjs`, lancée par `npm test`)

Le parcours parfait arrive au bout en 12 à 75 s ; le joueur visé arrive au bout (avec la banquise) ; au
1-1, le robot `bon` arrive sans aucun « Boum » ; à partir du 1-3, ne rien faire ne suffit pas ; au moins
20 poissons ; en sans fin, aucun « Boum » du débutant sur les 300 premiers mètres.

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
