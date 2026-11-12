// Kit — sons, musique d'ambiance et vibrations, tout synthétisé avec Web Audio (aucun fichier audio).
// Le kit fournit le moteur et les sons d'interface communs (tap, gift, win, lose…).
// Chaque jeu ajoute ses propres sons avec tone() et bell(), et peut changer la musique avec setMusic().

// Gamme pentatonique de do majeur : les sons « réussite » montent d'une note à chaque étape.
export const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

let ctx = null, master = null, sfxBus = null, musicBus = null;
let sfxOn = true, musicOn = true, hapticsOn = true;

function ac() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    // Petite réverbération (écho filtré) pour donner de l'espace.
    const delay = ctx.createDelay(); delay.delayTime.value = 0.18;
    const fb = ctx.createGain(); fb.gain.value = 0.25;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
    delay.connect(lp).connect(fb).connect(delay);
    lp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master); sfxBus.connect(delay);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.5 : 0; musicBus.connect(master); musicBus.connect(delay);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Une note synthétisée. bus : "sfx" (coupé par le réglage des effets) ou "music". */
export function tone(freq, { at = 0, dur = 0.25, type = "triangle", vol = 0.16, bus = "sfx", attack = 0.01 } = {}) {
  if (bus === "sfx" && !sfxOn) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus === "sfx" ? sfxBus : musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}
/** Son de « cloche » : fondamentale + harmonique, comme un petit carillon. */
export function bell(freq, opts = {}) {
  tone(freq, { type: "sine", dur: 0.6, vol: 0.14, ...opts });
  tone(freq * 2.01, { type: "sine", dur: 0.3, vol: 0.05, ...opts });
}

/** Vibration courte (Haptics dans l'appli, navigator.vibrate dans le navigateur). */
export function vibrate(ms) {
  if (!hapticsOn) return;
  const C = globalThis.Capacitor;
  const H = C?.Plugins?.Haptics;
  if (H && C.isNativePlatform?.()) {
    H.impact({ style: ms > 30 ? "MEDIUM" : "LIGHT" }).catch(() => {});
  } else if (globalThis.navigator?.vibrate) {
    try { navigator.vibrate(ms); } catch (e) { /* non pris en charge */ }
  }
}

/* ---------- Musique d'ambiance : accords arpégés en boucle ---------- */
// Par défaut, progression I–vi–IV–V en arpèges doux (celle de Mélo Pop).
let music = {
  chords: [
    [261.63, 329.63, 392.0, 523.25],  // do
    [220.0, 261.63, 329.63, 440.0],   // la mineur
    [174.61, 220.0, 261.63, 349.23],  // fa
    [196.0, 246.94, 293.66, 392.0],   // sol
  ],
  pattern: [0, 1, 2, 3, 2, 1, 2, 1],
  step: 0.36, // secondes par note : tempo calme
};
let musicTimer = 0, step = 0, nextAt = 0, playing = false;

function scheduleMusic() {
  const a = ctx;
  const len = music.pattern.length;
  while (nextAt < a.currentTime + 0.6) {
    const chord = music.chords[Math.floor(step / len) % music.chords.length];
    const at = nextAt - a.currentTime;
    tone(chord[music.pattern[step % len]], { at, dur: 0.9, type: "sine", vol: 0.07, bus: "music", attack: 0.03 });
    if (step % len === 0) tone(chord[0] / 2, { at, dur: music.step * len, type: "triangle", vol: 0.05, bus: "music", attack: 0.2 });
    step++;
    nextAt += music.step;
  }
}

export const Sound = {
  get sfx() { return sfxOn; }, set sfx(v) { sfxOn = !!v; },
  get music() { return musicOn; },
  set music(v) {
    musicOn = !!v;
    if (musicBus) musicBus.gain.setTargetAtTime(musicOn ? 0.5 : 0, ctx.currentTime, 0.3);
    if (musicOn) { if (ctx) this.startMusic(); } else this.stopMusic();
  },
  get haptics() { return hapticsOn; }, set haptics(v) { hapticsOn = !!v; },

  /** Change la musique d'ambiance : { chords: [[fréquences]], pattern: [indices], step: secondes }. */
  setMusic(m) { music = { ...music, ...m }; step = 0; },

  /** À appeler au premier geste du joueur (les navigateurs bloquent le son avant). */
  unlock() { ac(); if (musicOn) this.startMusic(); },
  startMusic() {
    if (playing || !musicOn || !ac()) return;
    playing = true;
    nextAt = ctx.currentTime + 0.1;
    musicTimer = setInterval(scheduleMusic, 150);
  },
  stopMusic() { playing = false; clearInterval(musicTimer); },
  /** Appli en arrière-plan : on coupe tout. */
  suspend() { this.stopMusic(); if (ctx) ctx.suspend(); },
  resume() { if (ctx) ctx.resume(); if (musicOn) this.startMusic(); },

  // Sons d'interface communs.
  tap() { tone(880, { dur: 0.06, type: "sine", vol: 0.06 }); },
  bad() { tone(220, { dur: 0.14, type: "square", vol: 0.04 }); tone(185, { at: 0.1, dur: 0.18, type: "square", vol: 0.04 }); vibrate(20); },
  star() { bell(1567.98); bell(2093, { at: 0.08 }); },
  win() { [0, 2, 4, 5, 7, 9].forEach((n, k) => bell(SCALE[n], { at: k * 0.14 })); vibrate(80); },
  lose() { [4, 3, 1, 0].forEach((n, k) => tone(SCALE[n] / 2, { at: k * 0.2, dur: 0.4, type: "sine", vol: 0.12 })); },
  gift() { [0, 4, 7, 9].forEach((n, k) => bell(SCALE[n] * 1.5, { at: k * 0.1 })); },
};
