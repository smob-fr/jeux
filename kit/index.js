// Kit — point d'entrée : tout le kit en un seul import.
//   import { configurer, Ads, Store, … } from "../kit/index.js";
// Dans le format « global » (un seul script classique), ces mêmes noms sont dans window.Kit.
export { configurer, config } from "./config.js";
export { estNatif, plateforme, plugin } from "./plateforme.js";
export { Ads, REGLES_INTERSTITIELLE } from "./ads.js";
export { Store } from "./store.js";
export { Notify, rappelsStandard, horsHeuresCalmes, HEURES_CALMES, CANAL } from "./notify.js";
export { Sound, SCALE, tone, bell, vibrate } from "./sound.js";
export { creerSauvegarde } from "./sauvegarde.js";
export { creerVies, VIES_MAX, RECHARGE_MS } from "./vies.js";
export { creerInventaire } from "./bonus.js";
export { creerCadeau, aujourdhui } from "./cadeau.js";
export { fenetre, demander, informer, Ecrans } from "./fenetres.js";
export { Boutique } from "./boutique.js";
export { ouvrirReglages, appliquerReglages, proposerRappels } from "./reglages.js";
export { Tutoriel } from "./tutoriel.js";
export { ICONS, svg } from "./icones.js";
