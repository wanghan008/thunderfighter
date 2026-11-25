export type AudioSettings = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
};

export type MusicMode = "menu" | "battle" | "boss" | "paused";

const STORAGE_KEY = "thunderfighter-audio-settings";
const DEFAULT_SETTINGS: AudioSettings = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.2,
  sfxVolume: 0.78,
};

let settings: AudioSettings = { ...DEFAULT_SETTINGS };
let audioContext: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let musicMode: MusicMode = "menu";
let lastExplosionAt = 0;

export function readAudioSettings(): AudioSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return {
      musicEnabled: typeof saved?.musicEnabled === "boolean" ? saved.musicEnabled : DEFAULT_SETTINGS.musicEnabled,
      sfxEnabled: typeof saved?.sfxEnabled === "boolean" ? saved.sfxEnabled : DEFAULT_SETTINGS.sfxEnabled,
      musicVolume: Number.isFinite(saved?.musicVolume) ? Math.max(0, Math.min(1, saved.musicVolume)) : DEFAULT_SETTINGS.musicVolume,
      sfxVolume: Number.isFinite(saved?.sfxVolume) ? Math.max(0, Math.min(1, saved.sfxVolume)) : DEFAULT_SETTINGS.sfxVolume,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function ensureAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  try {
    const AudioContextConstructor =
      window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    audioContext = new AudioContextConstructor();
    musicGain = audioContext.createGain();
    sfxGain = audioContext.createGain();
    musicGain.gain.value = settings.musicEnabled ? settings.musicVolume * 0.34 : 0;
    sfxGain.gain.value = settings.sfxEnabled ? settings.sfxVolume : 0;
    musicGain.connect(audioContext.destination);
    sfxGain.connect(audioContext.destination);
    return audioContext;
  } catch {
    return null;
  }
}

export function configureAudio(next: AudioSettings): void {
  settings = {
    musicEnabled: next.musicEnabled,
    sfxEnabled: next.sfxEnabled,
    musicVolume: Math.max(0, Math.min(1, next.musicVolume)),
    sfxVolume: Math.max(0, Math.min(1, next.sfxVolume)),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Audio preferences are optional; sound still works for this session.
  }
  if (musicGain) musicGain.gain.setTargetAtTime(settings.musicEnabled ? settings.musicVolume * 0.34 : 0, audioContext!.currentTime, 0.08);
  if (sfxGain) sfxGain.gain.setTargetAtTime(settings.sfxEnabled ? settings.sfxVolume : 0, audioContext!.currentTime, 0.04);
  if (settings.musicEnabled && audioContext?.state === "running" && musicTimer === null) {
    setMusicMode(musicMode);
  }
  if (!settings.musicEnabled && musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.18,
  endFrequency?: number,
  destination: GainNode | null = sfxGain,
): void {
  const ctx = ensureAudio();
  if (!ctx || !destination) return;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  const now = ctx.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(30, frequency), now);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.025);
}

function noise(duration: number, volume = 0.22): void {
  const ctx = ensureAudio();
  if (!ctx || !sfxGain) return;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const envelope = ctx.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  envelope.gain.setValueAtTime(volume, ctx.currentTime);
  envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(sfxGain);
  source.start();
  source.stop(ctx.currentTime + duration);
}

function playMusicPhrase(): void {
  if (!settings.musicEnabled || !musicGain || !audioContext) return;
  const battle = musicMode === "battle" || musicMode === "boss";
  const scale = musicMode === "boss" ? [55, 65.41, 73.42, 82.41, 73.42, 65.41, 49, 58.27] :
    battle ? [55, 65.41, 73.42, 82.41, 73.42, 65.41, 58.27, 65.41] :
    [55, 65.41, 73.42, 65.41, 49, 58.27, 65.41, 58.27];
  const root = scale[musicStep % scale.length];
  const now = audioContext.currentTime;
  const pad = audioContext.createOscillator();
  const padGain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  pad.type = "sawtooth";
  pad.frequency.setValueAtTime(root, now);
  filter.type = "lowpass";
  filter.frequency.value = musicMode === "boss" ? 520 : 360;
  padGain.gain.setValueAtTime(0.0001, now);
  padGain.gain.linearRampToValueAtTime(musicMode === "boss" ? 0.11 : 0.075, now + 0.12);
  padGain.gain.setTargetAtTime(0.0001, now + 0.42, 0.22);
  pad.connect(filter);
  filter.connect(padGain);
  padGain.connect(musicGain);
  pad.start(now);
  pad.stop(now + 1.05);

  if (musicStep % 2 === 0) {
    tone(root / 2, 0.52, "triangle", 0.055, root / 2.8, musicGain);
  }
  if (musicMode !== "menu" && musicStep % 4 === 2) {
    tone(root * 2, 0.16, "sine", 0.035, root * 1.5, musicGain);
  }
  musicStep += 1;
}

export function setMusicMode(mode: MusicMode): void {
  musicMode = mode;
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  if (!settings.musicEnabled || mode === "paused" || !audioContext || audioContext.state !== "running") return;
  musicStep = 0;
  playMusicPhrase();
  musicTimer = window.setInterval(playMusicPhrase, mode === "boss" ? 520 : 760);
}

export function unlockAudio(): void {
  const ctx = ensureAudio();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().then(() => setMusicMode(musicMode)).catch(() => undefined);
  else if (musicTimer === null && musicMode !== "paused") setMusicMode(musicMode);
}

export function playSfx(
  name: "fire" | "explosion" | "bossIntro" | "bossKill" | "bomb" | "hurt" | "pickup" | "combo" | "shield" | "weapon",
  weapon: "laser" | "homing" | "spread" | "piercing" = "laser",
): void {
  if (!settings.sfxEnabled) return;
  const ctx = ensureAudio();
  if (!ctx || ctx.state !== "running") return;

  switch (name) {
    case "fire":
      if (weapon === "homing") tone(260, 0.12, "triangle", 0.11, 105);
      else if (weapon === "spread") tone(610, 0.075, "square", 0.075, 380);
      else if (weapon === "piercing") tone(420, 0.11, "sawtooth", 0.085, 170);
      else tone(880, 0.055, "square", 0.07, 520);
      break;
    case "explosion": {
      const now = performance.now();
      if (now - lastExplosionAt < 90) return;
      lastExplosionAt = now;
      noise(0.22, 0.24);
      tone(115, 0.28, "triangle", 0.18, 42);
      break;
    }
    case "bossIntro":
      tone(110, 0.75, "sawtooth", 0.18, 55);
      window.setTimeout(() => tone(165, 0.55, "sawtooth", 0.15, 82), 180);
      break;
    case "bossKill":
      tone(220, 0.7, "sawtooth", 0.18, 660);
      window.setTimeout(() => tone(440, 0.65, "triangle", 0.15, 990), 170);
      noise(0.34, 0.16);
      break;
    case "bomb":
      noise(0.48, 0.34);
      tone(82, 0.48, "sawtooth", 0.22, 35);
      break;
    case "hurt":
      tone(190, 0.24, "sawtooth", 0.2, 58);
      break;
    case "pickup":
      tone(520, 0.12, "sine", 0.13, 780);
      window.setTimeout(() => tone(780, 0.16, "sine", 0.12, 1040), 100);
      break;
    case "combo":
      tone(660, 0.12, "square", 0.11, 880);
      window.setTimeout(() => tone(990, 0.18, "triangle", 0.12, 1320), 95);
      break;
    case "shield":
      tone(340, 0.3, "sine", 0.16, 720);
      break;
    case "weapon":
      tone(360, 0.1, "square", 0.11, 540);
      window.setTimeout(() => tone(540, 0.12, "square", 0.1, 720), 85);
      break;
  }
}
