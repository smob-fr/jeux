# Jeux mobiles smob-fr

Tous les jeux mobiles de smob-fr, dans un seul dépôt : même technique (web + Capacitor), même code de
publicité et d'achats (`kit/`), mêmes conventions.

| Jeu | Dossier | Genre | État |
|---|---|---|---|

- Notes pour le développement avec Claude Code : `CLAUDE.md`, puis `jeux/<nom>/CLAUDE.md`.
- Monétisation : `docs/monetisation.md`. Publication : `docs/publication.md`. Idées : `docs/idees.md`.

```bash
npm install                     # Playwright pour les tests de bout en bout
npx playwright install chromium # une seule fois
npm test                        # tests du kit, conventions, puis tests de chaque jeu
```
