# 🎵 Mélo Pop

Jeu de type « match-3 » sur le thème de la musique : échange deux notes voisines pour
aligner au moins 3 notes de la même couleur.

## Contenu du jeu

- **Écran de chargement, accueil animé, carte des niveaux** en 6 mondes (Prélude, Allegro, Andante, Scherzo, Nocturne, Grand Final), chacun avec son ambiance de couleur.
- **Tutoriel interactif** au premier lancement : une main montre le geste, la zone à jouer est mise en lumière, et le joueur réalise 3 coups guidés (alignement de 3, création d'une note rayée, déclenchement). Le tutoriel peut être revu depuis les réglages.
- **Fiches « Nouveau ! »** qui présentent chaque mécanique la première fois qu'elle apparaît (récolte, bombe, givre, étoile, combinaisons, givre épais), et une page **Comment jouer** illustrée.
- **60 niveaux** avec 3 types d'objectifs : score, récolte de notes, cases givrées (1 ou 2 couches).
- **Tuiles spéciales** : 4 alignées → note rayée (efface une rangée ou une colonne) ; L ou T → bombe (carré 3×3) ; 5 alignées → étoile (efface une couleur). Combinaisons entre spéciales.
- **5 bonus**, sans coût de coup : marteau (casse une note), bombe (à poser où l'on veut), étoile (efface toute une couleur), mélange, +3 coups. Un **tutoriel des bonus** au niveau 3 les présente un par un, avec un essai guidé.
- **Gagner des bonus** : cadeau du jour, 3 étoiles sur un niveau (+1 bonus), coffre tous les 5 niveaux (+2 bonus), vidéo récompensée, ou lots dans la boutique.
- Étoiles (1 à 3), **5 vies** qui se rechargent (1 toutes les 20 min), records.
- Graphismes : notes en relief, particules, rayons, explosions, secousses, confettis, décor animé (portée qui ondule, notes qui flottent).
- **Musique d'ambiance** et effets sonores générés en direct (aucun fichier audio), **vibrations**. Chaque réglage peut être coupé.
- Respect du réglage système « réduire les animations ».

## Monétisation

Pubs AdMob (bannière sur la carte seulement, interstitielle plafonnée, vidéos récompensées), achat
« Sans pub » et lots de bonus RevenueCat, avec le code commun du dépôt (`kit/`). Identifiants et
catalogue : `jeu.json`. Règles et mise en place : `docs/monetisation.md` à la racine du dépôt.

| Identifiant produit | Type | Prix conseillé | Contenu |
|---|---|---|---|
| `melopop_noads` | non consommable | 3,99 € | supprime bannières et interstitielles (les vidéos bonus restent) |
| `melopop_starter` | consommable, une fois | 1,99 € | 3 bonus de chaque sorte, vies pleines |
| `melopop_pack_s` | consommable | 0,99 € | 2 marteaux, 2 bombes, 1 étoile, 1 mélange |
| `melopop_pack_l` | consommable | 4,99 € | 10 bonus de chaque sorte (50), vies pleines |
| `melopop_lives` | consommable | 0,99 € | toutes les vies |

Dans un navigateur, pubs et achats sont **simulés**.

## Notifications

Après le niveau 2, le jeu propose des rappels, avec une explication avant la demande du système :
vies rechargées, cadeau du jour à 18 h, rappel après 3 jours d'absence. Jamais entre 21 h et 9 h,
annulés dès le retour dans le jeu, réglables dans *Réglages › Rappels*.

## Essayer et construire

```bash
cd jeux/melopop
npm run serve        # construit www/ avec le kit, puis http://localhost:8080
npm test             # tests de bout en bout
```

Applis Android et iOS, checklist avant publication : `docs/publication.md` à la racine du dépôt.
Version en ligne : https://smob-fr.github.io/jeux/melopop/ (publiée depuis `main`).

Notes de développement : `CLAUDE.md`.
