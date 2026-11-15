# Pingo Glisse : notes pour Claude Code

**Prototype.** Un pingouin glisse sur des collines enneigées ; la banquise fond derrière lui et finit
par le rattraper. Le but : aller le plus loin possible. Lis d'abord le `CLAUDE.md` de la racine
(stack, kit, monétisation, conventions).

- Origine : artefact claude.ai `EkNfEF2iAKN1aCmSrsXfkF`, repris tel quel dans `index.html` (novembre 2026).
- `jeu.json` : id `pingo`, `"statut": "prototype"` (le contrôle des conventions ne fait que des
  avertissements sur la monétisation). appId `fr.smob.pingo`.

## Commandes

Depuis `jeux/pingo/` :

```bash
npm run build   # installe le kit dans kit/, puis copie index.html et le kit dans www/ (webDir, générés)
npm run serve   # build, puis http://localhost:8080
npm test        # build, puis le test de fumée (tests/e2e.mjs, ~40 s)
```

## Architecture

Un seul fichier, `index.html` : styles, interface (bandeau, panneaux « départ » et « Plouf ! ») et un
script : collines, physique, caméra, dessin sur canvas, sons Web Audio. Aucune image, aucun son en
fichier. Seule dépendance externe : la police Baloo 2 (Google Fonts), facultative.

- **Collines** : sommets et creux alternés (`pts`), interpolés en cosinus (`hAt`, pente `slopeAt`,
  courbure `curvAt`). Elles s'agrandissent et se creusent avec la distance (`extendHills`).
- **Physique** (`step`, 4 sous-pas par image) : au sol, la pente accélère ou freine
  (`G = 1150`, `DIVE = 2600` en plus quand on appuie), vitesse entre `MIN_SPEED` 230 et `MAX_SPEED`
  2300. On décolle en haut d'une bosse si la vitesse est trop forte pour suivre la courbe et qu'on
  n'appuie pas. En l'air : gravité, salto (`flipping`).
- **Atterrissage** (`land`) : dans le sens de la descente → « Glisse parfaite » (+8 % +60) ; brutal →
  perte de vitesse ; au milieu d'un salto → « Aïe, sur la tête ! » (vitesse ×0,35) ; chaque salto
  réussi → +160.
- **Banquise** : `meltX` avance à `190 + 14 × temps` (max 1500), jamais à plus de 1500 px derrière.
  Elle rattrape le pingouin → fin de partie.
- **Poissons** : 1 ou 3 en l'air ; chacun repousse la fonte de 50 ; 8 poissons → turbo 2,6 s
  (+ fonte repoussée de 450).
- **Ambiances** : jour → couchant → nuit avec aurore boréale, tous les 2 400 m (`skyAt`).
- **Menu** : démonstration en arrière-plan, le pingouin plonge tout seul dans les descentes.
- Objet de test : `window.__pingo` (`p`, `state`, `fish`).
- Sauvegarde : seulement le record, `localStorage` `pingo.best`. À garder lisible en passant au kit
  (`pingo.v1` avec un champ `best`, initialisé depuis `pingo.best`).

## Règles du jeu

- **Appui long** : plonger dans les descentes pour prendre de la vitesse.
- **Relâcher** : se laisser décoller en haut des bosses.
- **Toucher en l'air** (appui bref) : salto, bonus de vitesse si on retombe sur le ventre.
- **8 poissons** : turbo, et la fonte recule.
- Fin : la banquise rattrape le pingouin (« Plouf ! ») ; écran avec mètres, poissons, saltos, record.

## État d'avancement

- Prototype jouable dans le navigateur, une seule partie infinie, record local.
- Kit commun installé au build (`kit/`, format global, comme Max) **pour les statistiques seulement** :
  `session_start`, `run_start`, `run_end` (mètres, poissons, saltos, turbos, record, durée), identifiant et
  réglage dans `pingo.v1`, lien « Statistiques anonymes » sous « Glisser ! ». Sans le kit (`index.html`
  ouvert directement), le jeu marche pareil, sans statistiques.
- Pas encore de pubs, de boutique ni de réglages.
- Pas de tutoriel guidé (seulement le panneau « comment jouer » au départ), pas de vibrations, pas de
  musique, pas de réglage du son.

## Pour en faire un jeu (pistes)

1. Valider le plaisir de glisse sur téléphone (sensations de vitesse, difficulté de la fonte).
2. Brancher le kit (format global, comme Max) : sauvegarde, `Sound` pour les réglages son et
   vibrations, `Ecrans`, réglages, tutoriel guidé sur la première descente.
3. Monétisation proposée, à valider : bannière sur l'écran de départ et l'écran « Plouf ! » seulement ;
   interstitielle après une partie sur 3 (règles du kit) ; vidéo récompensée « repartir d'où je suis
   tombé » une fois par partie ; boutique : « Sans pub », écharpes et bonnets (cosmétiques), lots de
   « poissons d'or » pour un turbo au départ.
4. Objectifs et progression : missions (« fais 3 saltos », « 1 000 m sans boum »), cadeau du jour,
   pingouins à débloquer.
5. Retirer la police externe (ou l'embarquer) pour jouer hors ligne ; manifeste et icônes.
