# Monétisation

Tous les jeux gagnent de l'argent de la même façon : des publicités AdMob, un achat « Sans pub » et
quelques lots de bonus vendus par RevenueCat. Le code est commun (`kit/ads.js`, `kit/store.js`,
`kit/boutique.js`). Les identifiants et le catalogue de chaque jeu sont dans son `jeu.json`.

## Publicités (Google AdMob)

### Formats et règles

| Format | Où | Règle |
|---|---|---|
| Bannière adaptative, en bas | accueil, carte des niveaux, menus | jamais pendant le jeu : un clic accidentel sur le plateau est interdit par AdMob, et gâche la partie |
| Interstitielle | après une partie terminée (gagnée ou perdue), quand le joueur quitte l'écran de fin | à partir du niveau 4, une partie sur 3, au moins 2 minutes entre deux, jamais juste après une vidéo récompensée |
| Vidéo récompensée | sur un bouton que le joueur choisit | récompense annoncée sur le bouton, accordée seulement si la vidéo est vue jusqu'au bout |

Les valeurs par défaut sont dans `kit/ads.js`. Un jeu peut les ajuster dans `jeu.json`
(`interstitielle.toutesLes`, `interstitielle.delaiMin` en secondes, `interstitielle.aPartirDuNiveau`),
sans jamais les rendre plus agressives sans en parler au propriétaire.

Récompenses habituelles : +1 vie, +1 bonus, +5 coups une fois par partie, une aide, un objet
exclusif (style de voiture, amulette).

« Sans pub » coupe bannières et interstitielles. Les vidéos récompensées restent proposées, car le
joueur les choisit.

### Consentement et vie privée

- Au lancement de l'appli : formulaire de consentement Google UMP (RGPD), puis demande ATT sur iOS.
  Les deux messages se configurent dans la console AdMob, rubrique « Confidentialité et messages ».
- Si le formulaire l'exige, les réglages affichent « Confidentialité et publicité » pour revenir sur
  son choix (`Ads.privacyOptionsRequired`).
- Le message ATT d'iOS (`NSUserTrackingUsageDescription`) est écrit par
  `kit/outils/configure-admob.mjs`, à partir du nom du jeu.

### Identifiants

Dans `jeu.json` :

```json
"admob": {
  "test": true,
  "android": { "appli": "ca-app-pub-…~…", "banniere": "ca-app-pub-…/…", "interstitielle": "…", "recompensee": "…" },
  "ios":     { "appli": "ca-app-pub-…~…", "banniere": "…", "interstitielle": "…", "recompensee": "…" }
}
```

Tant que `test` vaut `true`, ce sont les identifiants de test de Google, qui affichent des pubs de
démonstration sans risque pour le compte. Ne jamais cliquer sur ses propres vraies pubs.

## Achats intégrés (RevenueCat)

### Grille commune

| Produit | Identifiant | Type dans les stores | Prix |
|---|---|---|---|
| Sans pub | `<id>_noads` | non consommable | 3,99 € |
| Petit lot de bonus | `<id>_…` | consommable | 0,99 € |
| Lot découverte (une seule fois) ou lot moyen | `<id>_…` | consommable | 1,99 € |
| Grand lot | `<id>_…` | consommable | 4,99 € |
| Recharge de vies (si le jeu a des vies) | `<id>_lives` | consommable | 0,99 € |

Dans `jeu.json`, chaque produit a un `type` :
- `noads` : achat définitif, restaurable, relié au droit `no_ads` ;
- `once` : proposé une seule fois (lot découverte) ;
- `consumable` : peut être racheté.

Le champ `contenu` dit ce que le jeu accorde (`{ "hammer": 2, "lives": "full" }`) : c'est le jeu qui
l'interprète, le kit ne fait que le lui transmettre.

### Mise en place (une fois par jeu)

1. Compte gratuit sur **revenuecat.com** (gratuit jusqu'à 2 500 $ de revenus par mois), un projet par
   jeu, avec une appli Android et une appli iOS.
2. Créer les produits dans **Google Play Console** (Monétiser › Produits intégrés) et dans
   **App Store Connect** (Achats intégrés), avec exactement les identifiants de `jeu.json`.
3. Dans RevenueCat : importer les produits, créer le droit (*entitlement*) `no_ads` et lui rattacher
   `<id>_noads`.
4. Coller les clés publiques RevenueCat (`goog_…` et `appl_…`) dans `jeu.json` › `revenuecat`.
5. iOS : dans Xcode, onglet *Signing & Capabilities*, ajouter **In-App Purchase**.
6. Tester avec un compte testeur (Play Console › Tests de licence, Sandbox sur App Store Connect) :
   aucun débit réel.

## Catalogue par jeu

| Jeu | Sans pub | 0,99 € | 1,99 € | 4,99 € |
|---|---|---|---|---|

Le tableau est complété à l'import de chaque jeu ; `npm run verifier` affiche le catalogue réel.
