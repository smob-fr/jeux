# Kit commun

Code partagé par tous les jeux, extrait de Mélo Pop : publicités, achats, notifications, son,
sauvegarde, vies, bonus, cadeau du jour, fenêtres, écrans, boutique, réglages, tutoriel, icônes et
styles de base. Les règles qu'il applique sont décrites dans le `CLAUDE.md` de la racine.

## Installer le kit dans un jeu

Le kit n'est jamais recopié à la main : la construction du jeu l'installe dans son dossier web.

```bash
node ../../kit/outils/installer.mjs . www/kit             # modules ES + jeu.js (Mélo Pop)
node ../../kit/outils/installer.mjs . build/kit --global  # kit.js (window.Kit) + kit.css
```

- **Modules ES** : `import JEU from "../kit/jeu.js"; import { configurer, Ads, … } from "../kit/index.js"; configurer(JEU);`
  et `<link rel="stylesheet" href="kit/styles/base.css">`.
- **Global** : un script classique qui définit `window.Kit`, déjà configuré avec `jeu.json`, et une
  feuille `kit.css`. Pour les jeux en fichier unique (Ça Roule) ou en scripts classiques (Max).
  Mêmes noms que `kit/index.js` : `Kit.Ads`, `Kit.creerVies`…
- `kit/outils/configure-admob.mjs` écrit les identifiants d'application AdMob et le message ATT dans
  `android/` et `ios/` (lancé par `npm run admob:config` du jeu).

Les copies installées sont générées : les ignorer dans git, ne jamais les modifier.

## Modules

| Module | Exporte | Rôle |
|---|---|---|
| `config.js` | `configurer(jeu)`, `config()` | contenu de `jeu.json`, lu par les autres modules |
| `plateforme.js` | `estNatif()`, `plateforme()`, `plugin(nom)` | appli Capacitor ou navigateur |
| `ads.js` | `Ads`, `REGLES_INTERSTITIELLE` | AdMob, consentement UMP, ATT, règles de fréquence, simulation |
| `store.js` | `Store` | RevenueCat, catalogue `jeu.json › produits`, « Sans pub », restauration, simulation |
| `notify.js` | `Notify`, `rappelsStandard`, `horsHeuresCalmes` | notifications locales, heures calmes |
| `sound.js` | `Sound`, `tone`, `bell`, `vibrate`, `SCALE` | Web Audio : sons d'interface, musique, vibrations |
| `sauvegarde.js` | `creerSauvegarde` | `localStorage`, valeurs par défaut, sauvegarde illisible |
| `vies.js` | `creerVies`, `VIES_MAX`, `RECHARGE_MS` | 5 vies, 1 toutes les 20 min |
| `bonus.js` | `creerInventaire` | inventaire, contenu des lots, bonus gagnés en jouant, présentation au 1er usage |
| `cadeau.js` | `creerCadeau`, `aujourdhui` | cadeau du jour (date locale) |
| `fenetres.js` | `fenetre`, `demander`, `informer`, `Ecrans` | fenêtres, écrans, règle de la bannière |
| `boutique.js` | `Boutique` | cartes produits, achat, remerciement, restauration |
| `reglages.js` | `ouvrirReglages`, `appliquerReglages`, `proposerRappels` | réglages communs, proposition des rappels |
| `tutoriel.js` | `Tutoriel` | projecteur, main animée, bulle |
| `icones.js` | `ICONS`, `svg` | icônes SVG |
| `styles/base.css` | classes `kit-…`, variables `--kit-…` | styles des éléments du kit |

### Exemple

```js
import JEU from "../kit/jeu.js";
import { configurer, Ads, Store, Boutique, Ecrans, creerSauvegarde, creerVies, appliquerReglages } from "../kit/index.js";

configurer(JEU);
const sauvegarde = creerSauvegarde({ cle: "monjeu.v1", defauts: () => ({ niveau: 1, sound: true, music: true, haptics: true, notif: null }) });
const save = sauvegarde.data, persist = () => sauvegarde.enregistrer();
const vies = creerVies(save, { enregistrer: persist });
appliquerReglages(save);
Ecrans.configurer({ initial: "accueil", banniere: ["carte"] }); // jamais un écran de jeu
Boutique.configurer({ data: save, enregistrer: persist, accorder: (p) => { /* p.contenu */ }, art: (p) => "…" });
Ads.init();
Store.init(Boutique.surSansPub);
// fin de partie, quand le joueur quitte l'écran de fin :
await Ads.maybeInterstitial(numeroDuNiveau);
```

### Thème

Les éléments du kit (fenêtres, boutons `kit-btn`, boutique, réglages, tutoriel) prennent leurs
couleurs dans des variables CSS. Un jeu les redéfinit dans son `:root` : `--kit-accent`,
`--kit-accent-clair`, `--kit-accent-fonce`, `--kit-accent-texte`, `--kit-texte`, `--kit-texte-doux`,
`--kit-panneau`, `--kit-bord`, `--kit-vif`, `--kit-succes`, `--kit-fenetre-fond`, `--kit-police`…
(liste complète en haut de `styles/base.css` ; valeurs par défaut : Mélo Pop).

Boutons : `kit-btn` + `big` (principal), `reward` (vidéo), `ghost`, `danger`, `danger-fill`, `petit`.

## Tests

`npm test` à la racine lance `kit/tests/*.test.mjs` (Node, sans navigateur) : règles des pubs avec
une horloge simulée, boutique et notifications avec une fausse appli Capacitor, sauvegarde, vies,
bonus, cadeau, et les deux formats de l'installateur. Puis les tests de chaque jeu, qui utilisent le
kit pour de vrai.

Règles pour écrire un module du kit (exigées par le format global) : imports sur une seule ligne
depuis `./autre.js`, sans `as` ; exports `export const|let|function|class` ; un nom exporté par un
seul module ; aucun accès à `document` au chargement du module. Tout nouvel export va aussi dans
`index.js` (un test le vérifie).
