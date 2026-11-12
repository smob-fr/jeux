# Ça Roule

Puzzle de parking pour mobile : faites sortir les voitures du parking.
- **Course** « sorties limitées » : 75 niveaux en 3 villes, portes de couleur, barrières, niveaux géants.
- **Casse-tête** : 50 énigmes à solution optimale vérifiée.
- **Défi du jour** : un casse-tête expert (30 à 50 coups) par jour, avec série de jours et rappels.
- Garage de styles de voitures (étoiles ou vidéos), coups de pouce 👍, coffres et missions, sons et
  musique synthétisés, tutoriel animé.
- Pubs et boutique (« Sans pub », lots de 👍) avec le kit commun du dépôt : simulées dans le navigateur.

## Version de test pour téléphones
Publiée sur https://smob-fr.github.io/jeux/ca-roule/ à chaque envoi sur `main` (workflow `pages.yml` à
la racine du dépôt : tests, construction, publication). Sur le téléphone : ouvrir le lien, puis
« Ajouter à l'écran d'accueil » (plein écran, hors ligne).

## Démarrage
```
cd jeux/ca-roule
npm run build        # dist/index.html (fichier unique) et site/ (version web installable)
open dist/index.html
npm test             # vérifie tous les niveaux et lance les tests de bout en bout
```
Notes de développement : `CLAUDE.md`. Appli native et publication : `docs/publication.md` à la racine.
