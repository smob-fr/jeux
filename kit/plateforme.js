// Kit — plateforme d'exécution : appli native (Capacitor) ou navigateur.
// Lu à chaque appel (et non au chargement du module) pour que les tests puissent simuler l'appli.

const capa = () => globalThis.Capacitor;

/** Vrai dans l'appli Android ou iOS, faux dans un navigateur. */
export function estNatif() {
  const C = capa();
  return !!(C && C.isNativePlatform && C.isNativePlatform());
}

/** "android", "ios" ou "web". */
export function plateforme() {
  return estNatif() ? capa().getPlatform() : "web";
}

/** Un plugin Capacitor (ex. "AdMob"), ou null dans le navigateur. */
export function plugin(nom) {
  return estNatif() ? capa().Plugins?.[nom] ?? null : null;
}
