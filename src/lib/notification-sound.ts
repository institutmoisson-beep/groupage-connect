/**
 * Son de notification partagé (messages + alertes), pour le client ET l'admin.
 *
 * Généré via Web Audio API (deux notes courtes façon "ding") plutôt qu'un fichier
 * .mp3 à héberger : aucun asset à gérer, fonctionne offline, poids ~0.
 *
 * Les navigateurs bloquent l'audio tant qu'aucune interaction utilisateur n'a eu
 * lieu sur la page : on "débloque" donc le contexte audio au premier clic/touch,
 * et on avale silencieusement les erreurs si un son arrive avant ce déblocage.
 */

const MUTE_KEY = "msn:notif-sound-muted";
let audioCtx: AudioContext | null = null;
let unlocked = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function unlock() {
  if (unlocked) return;
  const ctx = getContext();
  if (ctx?.state === "suspended") ctx.resume().catch(() => {});
  unlocked = true;
}

if (typeof window !== "undefined") {
  ["pointerdown", "keydown", "touchstart"].forEach((evt) =>
    window.addEventListener(evt, unlock, { once: true, passive: true }),
  );
}

export function isNotificationSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setNotificationSoundMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

/** Joue un court carillon à deux notes. Silencieux si l'utilisateur a coupé le son ou si l'audio est indisponible. */
export function playNotificationSound() {
  if (isNotificationSoundMuted()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const notes: Array<[frequency: number, start: number, duration: number]> = [
      [880, 0, 0.14],
      [1318.5, 0.12, 0.18],
    ];

    for (const [freq, start, duration] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.02);
    }
  } catch {
    // Audio indisponible (ancien navigateur, contexte non débloqué…) : on ignore.
  }
}
