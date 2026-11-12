# Publication

## Version web (GitHub Pages)

Le workflow `.github/workflows/pages.yml` construit tous les jeux à chaque envoi sur `main` et les
publie sur un seul site : `https://smob-fr.github.io/jeux/<nom>/`. Dans cette version, les pubs, les
achats et les notifications sont simulés. Sur téléphone, « Ajouter à l'écran d'accueil » installe le
jeu comme une appli.

À faire une fois : dans les réglages du dépôt sur GitHub, *Pages* › *Source* : **GitHub Actions**.

Les anciens dépôts (`smob-fr/melopop`, `smob-fr/ca-roule`, `smob-fr/max-oeil-de-jade`) gardent leur
propre site tant qu'ils ne sont pas archivés : les testeurs peuvent continuer à utiliser les anciens
liens pendant la transition.

## Construire les applis

Il faut Node 20 ou plus, **Android Studio** pour Android, et un **Mac avec Xcode** pour iOS. Depuis
le dossier du jeu :

```bash
npm install
npm run build          # construit le dossier web (webDir) avec le kit
npm run add:android    # une fois : crée android/ et y ajoute la config AdMob
npm run add:ios        # une fois, sur Mac : crée ios/
npm run assets         # icône et écran de démarrage, à partir de assets/
npm run android        # ouvre Android Studio → Build › Generate Signed Bundle (.aab)
npm run ios            # ouvre Xcode → Product › Archive
```

Après chaque modification du jeu ou du kit : `npm run build` puis `npx cap sync`.

Les dossiers `android/` et `ios/` sont générés et ne sont pas versionnés tant qu'on n'y fait pas de
modification à la main.

## Checklist avant publication

1. **Tests** : `npm test` à la racine du dépôt, tout passe.
2. **AdMob** (admob.google.com) : créer 2 applis (Android et iOS) et, pour chacune, 3 blocs
   d'annonces (bannière adaptative, interstitielle, récompensée). Coller les identifiants dans
   `jeu.json` › `admob`, puis passer `admob.test` à `false`.
3. **Identifiants d'application AdMob** dans les projets natifs : `npm run admob:config` (relit
   `jeu.json`).
4. AdMob › Confidentialité et messages : activer le **message RGPD** et le **message ATT** (iOS).
5. Publier un fichier **app-ads.txt** sur le site web du développeur, déclaré comme site du
   développeur dans les deux stores. Une seule ligne par compte AdMob, commune à tous les jeux.
6. **Achats intégrés** : produits créés dans les deux stores, droit `no_ads`, clés RevenueCat dans
   `jeu.json` (voir `docs/monetisation.md`).
7. `appId` définitif dans `capacitor.config.json` (`fr.smob.<id>`) ; numéro de version augmenté dans
   `package.json` et `jeu.json`.
8. **Icône et écran de démarrage** : `assets/icon-only.png` 1024×1024, `assets/splash.png`
   2732×2732, puis `npm run assets`.
9. **Politique de confidentialité** : partir de celle de Mélo Pop (`jeux/melopop/www/privacy.html`),
   compléter les zones surlignées (nom, e-mail, date), la publier (GitHub Pages) et indiquer son
   adresse dans les deux stores.
10. **Google Play Console** (25 $ une fois) : formulaire « Sécurité des données » (identifiant
    publicitaire collecté), case « Contient des annonces », classification du contenu, et test fermé
    avec 12 testeurs pendant 14 jours pour un nouveau compte personnel.
11. **App Store Connect** (99 $ par an) : « App Privacy » (Identifiers › Device ID, utilisé pour la
    publicité tierce), classification d'âge, capacité In-App Purchase dans Xcode.
12. **Fiche des stores** : titre, textes en français, captures d'écran (téléphone et tablette).
13. **Essai sur un vrai téléphone** : pubs de test, consentement, achat avec un compte testeur,
    restauration après réinstallation, notifications (et leur absence la nuit), mode avion, retour
    au premier plan.
