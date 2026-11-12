// Kit — inventaire de bonus.
// Convention (CLAUDE.md) : quelques bonus offerts au départ, un bonus ne coûte jamais de coup, il est
// expliqué la première fois qu'on l'utilise. On en gagne en jouant : +1 la première fois qu'un niveau
// est fini avec 3 étoiles, +2 (coffre) la première fois qu'un niveau multiple de 5 est fini.

/**
 * creerInventaire(data, { depart: { hammer: 3, … }, enregistrer, champ, champVus })
 * Les quantités sont rangées dans data[champ] (« boosters » par défaut), et les bonus déjà présentés
 * dans data[champVus] (« boosterSeen »).
 */
export function creerInventaire(data, { depart, enregistrer = () => {}, champ = "boosters", champVus = "boosterSeen", hasard = Math.random } = {}) {
  const sortes = Object.keys(depart);
  const completer = () => {
    data[champ] = { ...depart, ...(data[champ] || {}) };
    data[champVus] = data[champVus] || {};
  };
  completer();

  const inv = {
    sortes,
    completer,
    n(k) { return data[champ][k] || 0; },
    ajouter(k, n = 1) { data[champ][k] = inv.n(k) + n; enregistrer(); },
    /** Retire un bonus. Résout false s'il n'en reste plus. */
    utiliser(k) {
      if (inv.n(k) <= 0) return false;
      data[champ][k]--;
      enregistrer();
      return true;
    },
    /** Ajoute le contenu d'un lot ({ hammer: 2, … } ; les clés inconnues sont ignorées). */
    ajouterContenu(contenu = {}) {
      for (const k of sortes) if (contenu[k]) data[champ][k] = inv.n(k) + contenu[k];
      enregistrer();
    },
    /** Ajoute n bonus tirés au hasard. Renvoie la liste des sortes gagnées. */
    auHasard(n) {
      const gains = [];
      for (let i = 0; i < n; i++) {
        const k = sortes[Math.floor(hasard() * sortes.length)];
        data[champ][k] = inv.n(k) + 1;
        gains.push(k);
      }
      enregistrer();
      return gains;
    },
    /** Bonus gagnés à la fin d'un niveau (convention commune). Renvoie la liste des sortes gagnées. */
    recompensesNiveau({ numero, etoilesAvant, etoiles }) {
      let n = 0;
      if (etoiles === 3 && etoilesAvant < 3) n += 1;
      if (numero % 5 === 0 && etoilesAvant === 0) n += 2;
      return n ? inv.auHasard(n) : [];
    },
    dejaVu(k) { return !!data[champVus][k]; },
    marquerVu(k) { data[champVus][k] = true; enregistrer(); },
  };
  return inv;
}
