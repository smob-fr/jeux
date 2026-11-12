# Jeux mobiles smob-fr

Tous les jeux mobiles de smob-fr, dans un seul dépôt : même technique (web + Capacitor), même code de
publicité et d'achats (`kit/`), mêmes conventions.

| Jeu | Dossier | Genre | État |
|---|---|---|---|
| Mélo Pop | `jeux/melopop` | match-3 musical, 60 niveaux | complet, pubs et achats en mode test |
| Ça Roule | `jeux/ca-roule` | casse-tête de parking : Course, Casse-tête, défi du jour | prototype web en test, pubs et achats en mode test |
| Max et l'Œil de Jade | `jeux/max` | plateforme en paysage, 5 mondes, 100 niveaux | jouable de bout en bout, mondes 4 et 5 en test, pubs et achats en mode test |
| Pingo Glisse | `jeux/pingo` | glisse sans fin sur la banquise | **prototype**, pas encore branché sur le kit |

- Notes pour le développement avec Claude Code : `CLAUDE.md`, puis `jeux/<nom>/CLAUDE.md`.
- Monétisation : `docs/monetisation.md`. Publication : `docs/publication.md`. Idées : `docs/idees.md`.

```bash
npm install                     # Playwright pour les tests de bout en bout
npx playwright install chromium # une seule fois
npm test                        # tests du kit, conventions, puis tests de chaque jeu
```
