// Kit — sauvegarde locale (localStorage), une clé par jeu.
// Convention : toujours compatible avec les anciennes sauvegardes. On ajoute des champs avec une valeur
// par défaut (dans `defauts` ou `completer`), on ne renomme ni ne supprime jamais un champ existant.
// Une sauvegarde illisible repart des valeurs par défaut sans planter.

const stockage = () => { try { return globalThis.localStorage || null; } catch (e) { return null; } };

/**
 * creerSauvegarde({ cle: "melopop.v1", defauts: () => ({…}), completer: (d) => {…} })
 * → { data, enregistrer(), reinitialiser() }
 * `data` est l'objet sauvegardé, à lire et modifier directement, puis enregistrer().
 * `completer(d)` est appelé après lecture : y compléter les sous-objets des anciennes sauvegardes.
 */
export function creerSauvegarde({ cle, defauts, completer }) {
  const data = defauts();
  try {
    const brut = stockage()?.getItem(cle);
    const lu = brut ? JSON.parse(brut) : null;
    if (lu && typeof lu === "object" && !Array.isArray(lu)) Object.assign(data, lu);
  } catch (e) { /* sauvegarde illisible : valeurs par défaut */ }
  completer?.(data);
  return {
    cle,
    data,
    enregistrer() {
      try { stockage()?.setItem(cle, JSON.stringify(data)); } catch (e) { /* stockage plein ou indisponible */ }
    },
    /** Efface la progression : remet les valeurs par défaut, en gardant le même objet `data`. */
    reinitialiser() {
      for (const k of Object.keys(data)) delete data[k];
      Object.assign(data, defauts());
      completer?.(data);
      this.enregistrer();
    },
  };
}
