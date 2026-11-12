// Kit — cadeau du jour.
// Convention (CLAUDE.md) : un cadeau par jour (date locale du téléphone), à ouvrir depuis l'accueil
// ou la carte, avec un indicateur quand il est prêt.

/** Date locale du jour, « AAAA-MM-JJ ». */
export function aujourdhui(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * creerCadeau(data, { tirages: [{ … }], enregistrer, champ, hasard })
 * La date du dernier cadeau ouvert est rangée dans data[champ] (« lastGift » par défaut).
 * Le jeu décide de ce que contient un tirage et l'accorde lui-même.
 */
export function creerCadeau(data, { tirages, enregistrer = () => {}, champ = "lastGift", hasard = Math.random, jour = aujourdhui } = {}) {
  if (typeof data[champ] !== "string") data[champ] = "";
  return {
    get pret() { return data[champ] !== jour(); },
    /** Tire le cadeau du jour et le marque comme ouvert. Renvoie null s'il est déjà ouvert. */
    ouvrir() {
      if (data[champ] === jour()) return null;
      const t = tirages[Math.floor(hasard() * tirages.length)];
      data[champ] = jour();
      enregistrer();
      return t;
    },
  };
}
