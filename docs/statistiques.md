# Statistiques anonymes (PostHog)

Tous les jeux envoient des statistiques d'utilisation anonymes au même projet **PostHog**, hébergé dans
l'Union européenne (`https://eu.i.posthog.com`). Le code est commun : `kit/stats.js` (`Kit.Stats`). La
clé publique du projet (`phc_…`) est dans le `jeu.json` de chaque jeu, rubrique `statistiques`.

## Ce qui est envoyé, et ce qui ne l'est pas

- Un **identifiant tiré au hasard** sur l'appareil (`distinct_id`, `u…`), sans profil PostHog
  (`$process_person_profile: false`), **sans cookie** et sans script PostHog : le jeu envoie lui-même
  les événements par lots (`/batch/`), toutes les 8 secondes ou quand il passe en arrière-plan.
- Jamais de nom, d'e-mail, de position, ni d'identifiant publicitaire.
- Chaque événement porte : `jeu` (`melopop`, `caroule`, `maxjade`, `pingo`), `version`, `build`,
  `platform` (`app`, `web-installed`, `web`), `lang`, `sw` et `sh` (taille d'écran), et pour l'onglet
  *Web analytics* : `$session_id` (UUID v7 ; nouvelle session après 30 minutes en arrière-plan),
  `$current_url`, `$host`, `$pathname` (`/jeux/melopop/`…).
- **Le joueur peut couper les statistiques** : Réglages › Statistiques anonymes (Mélo Pop), pause
  (Ça Roule), Options (Max), lien sous « Glisser ! » (Pingo). Un dernier `setting_change { stats: false }`
  part, puis plus rien.
- **Les tests automatiques n'envoient rien** (navigateur piloté, `navigator.webdriver`). Les tests qui
  vérifient les statistiques interceptent eux-mêmes les requêtes : rien n'arrive dans PostHog.
- La politique de confidentialité doit le dire (modèle : `jeux/melopop/www/privacy.html`).

## Événements communs (kit)

| Événement | Quand | Propriétés |
|---|---|---|
| `$pageview` | lancement du jeu, et retour après plus de 30 min d'absence | `$referrer`, `title` (pour *Web analytics*) |
| `session_start` | lancement du jeu | propres au jeu (progression, record…) |
| `level_start` | début d'un niveau | `mode`, `level`, + infos du jeu |
| `level_win` | niveau réussi | `ms` (durée active, hors arrière-plan), compteurs de la tentative, `fails`, + infos |
| `level_fail` | échec (la tentative peut continuer) | idem |
| `level_quit` | abandon | `reason` : `restart`, `switch` (autre niveau), `home`, `menu`, `pause`, `giveup`, `skip`, **`closed`** (jeu fermé en pleine partie, compté au lancement suivant) |
| `ad_reward` | vidéo récompensée | `place`, `completed` |
| `ad_interstitial` | interstitielle montrée | `level` |
| `purchase` | achat tenté | `product`, `type`, `ok`, `cancelled` |
| `restore` | « Restaurer mes achats » | `ok`, `noAds` |
| `setting_change` | statistiques coupées ou rallumées | `stats` |

## Par jeu

- **Mélo Pop** : `level_*` avec `mode: "level"`, `level` (1 à 60), `moves`, `colors`, `goal` (`score`,
  `collect`, `ice`), `tutorial`, `boosters` (bonus utilisés) ; `level_win` : `stars`, `score`, `record`,
  `first`, `gains`. Autres : `booster_used { kind, level }`, `tutorial_done`, `booster_tutorial_done`,
  `gift_open { kind }`, `shop_open { from }`, `reminder_set { on }`. Vidéos : `place` = `vie`, `bonus`, `coups`.
- **Ça Roule** : mêmes événements qu'avant le kit (continuité des tableaux de bord) : `level_*` avec
  `mode` (`run`, `puzzle`, `daily`), `level`, `opt`, `bumps`, `hints`, `undos`, `revives` ; `home_choice`,
  `hint_used`, `ad_shown`/`ad_closed` (avec l'emplacement), `skin_equip`, `reminder_set`,
  `boost_earned`, `boost_spent`, `shop_open`, `anomaly_moves`. Tentative en cours gardée dans `caroule.att`.
- **Max et l'Œil de Jade** : `level_*` avec `mode: "level"`, `level` (1 à 100), `id` (`inca-3`…),
  compteurs `morts`, `relances`, `amulettes`, `restarts` ; `level_win` : `pieces`, `morts`.
  **`death { level, id, x, y, why }`** à chaque chute, avec la position en cases : de quoi repérer les
  pièges qui tuent le plus. Aussi `level_skip`. Vidéos : `place` = `passer`, `amulette`, `relance`.
  Identifiant et réglage dans `maxjade.stats` (à part de `temple-progres`).
- **Pingo Glisse** : `session_start { best }`, `run_start { run, best }`,
  `run_end { run, m, fish, flips, turbos, record, ms }`.

## Séparer les jeux

Les quatre jeux envoient au **même projet PostHog** : on peut les comparer, et on n'a qu'un tableau de
bord à suivre. Chaque jeu se reconnaît de deux façons :

- **Propriété `jeu`** sur tous les événements (`melopop`, `caroule`, `maxjade`, `pingo`) : c'est la
  bonne méthode partout, y compris dans les applis (où l'adresse est `localhost`).
- **Adresse de la page** dans la version web : `/jeux/melopop/`, `/jeux/ca-roule/`, `/jeux/max/`, `/jeux/pingo/`.

Dans PostHog :

- **Web analytics** : le tableau *Paths* donne déjà un chiffre par jeu. Pour n'en voir qu'un :
  *Filters* › *Event property* › `jeu` › *equals* › `melopop` (ou *Path name* contient `/jeux/melopop/`).
- **Un graphique** (*Product analytics* › *New insight*) : *Breakdown by* › `jeu` pour une courbe par jeu,
  ou *Filters* › `jeu = maxjade` pour un seul jeu.
- **Un tableau de bord par jeu** : *Dashboards* › *New dashboard* « Max », y ajouter ses graphiques, puis
  *Edit filters* en haut du tableau de bord › `jeu = maxjade` : le filtre s'applique à tous les graphiques.
  Pour le jeu suivant : *Duplicate dashboard*, puis changer le filtre.
- **Séparer complètement** (un projet PostHog par jeu) reste possible : créer un projet dans PostHog et
  mettre sa clé `phc_…` dans le `jeu.json` du jeu concerné. On perd alors la vue d'ensemble, et le nombre
  de projets dépend de l'offre PostHog.

## Lire les données dans PostHog

- **Activity** (menu de gauche) : les événements en direct, pour vérifier que tout arrive.
- **Web analytics** : visiteurs, sessions, durée, pages (une par jeu) ; alimenté par `$pageview` et `$session_id`.
- Filtrer par jeu : propriété d'événement **`jeu`** = `melopop`, `caroule`, `maxjade` ou `pingo`.
- Exclure les versions de développement : `build` différent de `dev`.
- Exemples utiles pendant les tests :
  - taux de réussite par niveau : `level_win` ÷ `level_start`, ventilé par `level` ;
  - niveaux où l'on abandonne : `level_quit`, ventilé par `level` et `reason` ;
  - pièges de Max : `death`, ventilé par `id` puis `x` ;
  - temps passé : moyenne de `ms` sur `level_win` ;
  - Pingo : distribution de `m` sur `run_end`.
- Testeurs : le nombre de joueurs distincts est celui des `distinct_id` différents (un par appareil et
  par navigateur).

## Ajouter le suivi à un nouveau jeu

1. `jeu.json` : `"statistiques": { "posthog": "phc_…", "hote": "https://eu.i.posthog.com" }`.
2. Au démarrage : `Stats.init({ data: save, enregistrer: persist, build: JEU.version })` puis
   `Stats.track("session_start", {…})` ; la sauvegarde reçoit `uid` et `stats`.
3. `Stats.debut(mode, niveau, {…})`, `Stats.compter("…")`, `Stats.gagne({…})`, `Stats.echec({…})`,
   `Stats.quitter("raison")` aux bons endroits ; `Ads.rewarded("place")` pour les vidéos.
4. Le réglage « Statistiques anonymes » (`Stats.activer`) : automatique dans `ouvrirReglages` du kit.
5. Un test qui pose `window.KIT_STATS_TEST = true`, intercepte `https://eu.i.posthog.com/**` et vérifie
   les événements.
