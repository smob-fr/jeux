// Kit — vies qui se rechargent avec le temps.
// Convention (CLAUDE.md) : 5 vies au maximum, 1 qui revient toutes les 20 minutes, un niveau perdu
// ou abandonné en coûte une. Le cadeau du jour peut dépasser le maximum de 1.

export const VIES_MAX = 5;
export const RECHARGE_MS = 20 * 60e3;

/**
 * creerVies(data, { enregistrer, max, recharge, champs })
 * `data` est l'objet de sauvegarde ; les vies y sont rangées dans data.lives et data.livesTs
 * (date de référence de la recharge), noms modifiables avec `champs: { vies, date }`.
 */
export function creerVies(data, { enregistrer = () => {}, max = VIES_MAX, recharge = RECHARGE_MS, champs = {}, maintenant = Date.now } = {}) {
  const V = champs.vies || "lives", D = champs.date || "livesTs";
  if (typeof data[V] !== "number") data[V] = max;
  if (typeof data[D] !== "number") data[D] = maintenant();

  const vies = {
    max,
    recharge,
    get n() { return data[V]; },
    get pleines() { return data[V] >= max; },

    /** Ajoute les vies revenues depuis la dernière fois. */
    rafraichir() {
      if (data[V] >= max) { data[D] = maintenant(); return; }
      const gagnees = Math.floor((maintenant() - data[D]) / recharge);
      if (gagnees > 0) {
        data[V] = Math.min(max, data[V] + gagnees);
        data[D] += gagnees * recharge;
        enregistrer();
      }
    },
    /** Retire une vie (niveau perdu ou abandonné). */
    perdre() {
      vies.rafraichir();
      if (data[V] >= max) data[D] = maintenant();
      data[V] = Math.max(0, data[V] - 1);
      enregistrer();
    },
    /** Ajoute n vies, sans dépasser le maximum (ou le maximum + 1 avec depasser: true). */
    gagner(n = 1, { depasser = false } = {}) {
      vies.rafraichir();
      data[V] = Math.min(max + (depasser ? 1 : 0), data[V] + n);
      enregistrer();
    },
    /** Toutes les vies, tout de suite (achat, lot). */
    remplir() {
      data[V] = Math.max(data[V], max);
      data[D] = maintenant();
      enregistrer();
    },
    /** Millisecondes avant la prochaine vie. */
    prochaineMs() { return Math.max(0, recharge - (maintenant() - data[D])); },
    /** « m:ss » avant la prochaine vie. */
    prochaineDans() {
      const ms = vies.prochaineMs();
      return `${Math.floor(ms / 60e3)}:${String(Math.floor((ms % 60e3) / 1e3)).padStart(2, "0")}`;
    },
    /** Date (ms) à laquelle toutes les vies seront revenues, ou null si elles le sont déjà. */
    pleinesA() { return data[V] < max ? data[D] + (max - data[V]) * recharge : null; },
  };
  return vies;
}
