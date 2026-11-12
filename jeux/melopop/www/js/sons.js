// Mélo Pop — sons propres au jeu, ajoutés au moteur de son du kit (kit/sound.js).
// Les sons d'interface (tap, bad, star, win, lose, gift) et la musique d'ambiance viennent du kit.
import { Sound, SCALE, tone, bell, vibrate } from "../kit/index.js";

Object.assign(Sound, {
  swap() { tone(392, { dur: 0.12, type: "sine", vol: 0.09 }); tone(523, { at: 0.06, dur: 0.12, type: "sine", vol: 0.07 }); },
  /** Chaque réaction en chaîne monte d'une note de la gamme. */
  match(combo) {
    const i = Math.min(combo - 1, SCALE.length - 1);
    bell(SCALE[i]);
    tone(SCALE[i] / 2, { dur: 0.35, type: "triangle", vol: 0.06 });
    vibrate(12);
  },
  special() { [0, 2, 4, 7].forEach((n, k) => bell(SCALE[n] * 1.5, { at: k * 0.05 })); vibrate(40); },
  boom() { tone(80, { dur: 0.5, type: "sine", vol: 0.3 }); tone(55, { at: 0.02, dur: 0.6, type: "triangle", vol: 0.2 }); vibrate(60); },
});

export { Sound };
