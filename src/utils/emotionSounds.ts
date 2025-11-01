import type { Emotion } from '@/types/emotion';

type AudioCtxCtor = {
  new (contextOptions?: AudioContextOptions): AudioContext;
};

type SourceHandle = {
  stop: () => void;
  lifetime: number; // seconds
};

type LoopIntervalSpec =
  | number
  | {
      min: number;
      max: number;
    };

interface ChirpParams {
  startFreq: number;
  endFreq?: number;
  duration: number;
  wave?: OscillatorType;
  volume?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  vibrato?: {
    speed: number;
    depth: number;
    delay?: number;
  };
  sweepCurve?: 'linear' | 'exponential';
  offset?: number;
  pan?: number;
}

interface NoiseParams {
  duration: number;
  volume?: number;
  attack?: number;
  release?: number;
  offset?: number;
  pan?: number;
}

interface EmotionSoundPreset {
  createVoices: (ctx: AudioContext, master: GainNode) => SourceHandle[];
  loopInterval?: LoopIntervalSpec;
  baseGain?: number;
}

const DEFAULT_MASTER_GAIN = 0.22;

const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
const randomIntInRange = (min: number, max: number) => Math.round(randomInRange(min, max));

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let unlocked = false;
let currentEmotion: Emotion | null = null;
let loopHandle: ReturnType<typeof setTimeout> | null = null;
let activeHandles: SourceHandle[] = [];

const getAudioContextCtor = (): AudioCtxCtor | null => {
  if (typeof window === 'undefined') return null;
  if (typeof window.AudioContext === 'function') {
    return window.AudioContext;
  }
  const webkitCtor = (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext;
  if (typeof webkitCtor === 'function') {
    return webkitCtor;
  }
  return null;
};

const ensureAudioContext = () => {
  if (audioContext) return audioContext;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  audioContext = new Ctor();
  masterGain = audioContext.createGain();
  masterGain.gain.value = DEFAULT_MASTER_GAIN;
  masterGain.connect(audioContext.destination);
  return audioContext;
};

const getMasterGain = () => {
  const ctx = ensureAudioContext();
  if (!ctx || !masterGain) return null;
  return masterGain;
};

const registerHandle = (handle: SourceHandle) => {
  activeHandles.push(handle);
  const cleanupDelayMs = Math.max(handle.lifetime + 0.25, 0.5) * 1000;
  setTimeout(() => {
    const idx = activeHandles.indexOf(handle);
    if (idx >= 0) {
      activeHandles.splice(idx, 1);
    }
  }, cleanupDelayMs);
};

const stopAllHandles = () => {
  activeHandles.forEach((handle) => handle.stop());
  activeHandles = [];
};

const clearLoopHandle = () => {
  if (loopHandle !== null) {
    clearTimeout(loopHandle);
    loopHandle = null;
  }
};

const resolveLoopInterval = (spec: LoopIntervalSpec, fallbackSeconds: number) => {
  if (typeof spec === 'number') {
    return Math.max(200, spec);
  }
  const min = Math.max(120, spec.min ?? fallbackSeconds * 1000);
  const maxBase = spec.max ?? spec.min;
  const max = Math.max(min + 60, maxBase);
  return randomIntInRange(min, max);
};

const createStereoPanner = (ctx: AudioContext) => {
  if (typeof ctx.createStereoPanner === 'function') {
    return ctx.createStereoPanner();
  }
  return null;
};

const scheduleChirp = (ctx: AudioContext, master: GainNode, params: ChirpParams): SourceHandle => {
  const {
    startFreq,
    endFreq = startFreq,
    duration,
    wave = 'sine',
    volume = 0.12,
    attack = 0.02,
    decay = 0.08,
    sustain = 0.6,
    release = 0.18,
    vibrato,
    sweepCurve = 'exponential',
    offset = 0,
    pan = 0,
  } = params;

  const startTime = ctx.currentTime + offset;
  const endTime = startTime + duration;

  const oscillator = ctx.createOscillator();
  oscillator.type = wave;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attack);
  gain.gain.linearRampToValueAtTime(volume * sustain, startTime + attack + decay);
  const sustainTime = Math.max(startTime + attack + decay, endTime - release);
  gain.gain.setValueAtTime(volume * sustain, sustainTime);
  gain.gain.linearRampToValueAtTime(0.0001, endTime);

  const panner = createStereoPanner(ctx);
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
  }

  oscillator.frequency.setValueAtTime(Math.max(1, startFreq), startTime);
  const targetFreq = Math.max(1, endFreq);
  if (sweepCurve === 'linear' || startFreq <= 0 || targetFreq <= 0) {
    oscillator.frequency.linearRampToValueAtTime(targetFreq, endTime);
  } else {
    oscillator.frequency.exponentialRampToValueAtTime(targetFreq, endTime);
  }

  let vibratoOsc: OscillatorNode | null = null;
  let vibratoGain: GainNode | null = null;
  if (vibrato) {
    vibratoOsc = ctx.createOscillator();
    vibratoGain = ctx.createGain();
    vibratoOsc.type = 'sine';
    vibratoOsc.frequency.setValueAtTime(vibrato.speed, startTime);
    vibratoGain.gain.setValueAtTime(vibrato.depth, startTime);
    vibratoOsc.connect(vibratoGain);
    vibratoGain.connect(oscillator.frequency);
    const vibratoStart = startTime + (vibrato.delay ?? 0);
    vibratoOsc.start(vibratoStart);
    vibratoOsc.stop(endTime);
  }

  oscillator.connect(gain);
  if (panner) {
    gain.connect(panner);
    panner.connect(master);
  } else {
    gain.connect(master);
  }

  oscillator.start(startTime);
  oscillator.stop(endTime);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
    oscillator.stop(now + 0.09);
    if (vibratoOsc) {
      vibratoOsc.stop(now + 0.09);
    }
  };

  return {
    stop,
    lifetime: duration,
  };
};

let cachedNoiseBuffer: AudioBuffer | null = null;
let cachedNoiseSampleRate: number | null = null;

const getNoiseBuffer = (ctx: AudioContext) => {
  if (cachedNoiseBuffer && cachedNoiseSampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  cachedNoiseSampleRate = ctx.sampleRate;
  return buffer;
};

const scheduleNoiseBurst = (ctx: AudioContext, master: GainNode, params: NoiseParams): SourceHandle => {
  const {
    duration,
    volume = 0.12,
    attack = 0.01,
    release = 0.18,
    offset = 0,
    pan = 0,
  } = params;

  const startTime = ctx.currentTime + offset;
  const endTime = startTime + duration;

  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attack);
  gain.gain.setValueAtTime(volume, Math.max(startTime + attack, endTime - release));
  gain.gain.linearRampToValueAtTime(0.0001, endTime);

  const panner = createStereoPanner(ctx);
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
  }

  source.connect(gain);
  if (panner) {
    gain.connect(panner);
    panner.connect(master);
  } else {
    gain.connect(master);
  }

  source.start(startTime);
  source.stop(endTime);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.06);
    source.stop(now + 0.07);
  };

  return {
    stop,
    lifetime: duration,
  };
};

const SOUND_PRESETS: Record<Emotion, EmotionSoundPreset> = {
  neutral: {
    baseGain: 0.18,
    loopInterval: { min: 4200, max: 5800 },
    createVoices: (ctx, master) => {
      const base = randomInRange(360, 420);
      return [
        scheduleChirp(ctx, master, {
          startFreq: base,
          endFreq: base * randomInRange(1.05, 1.12),
          duration: 0.6,
          wave: 'triangle',
          attack: 0.04,
          decay: 0.18,
          sustain: 0.55,
          release: 0.28,
          volume: 0.085,
          pan: randomInRange(-0.2, 0.2),
        }),
        scheduleChirp(ctx, master, {
          offset: 0.38,
          startFreq: base * 0.9,
          endFreq: base * 0.82,
          duration: 0.4,
          wave: 'sine',
          attack: 0.03,
          decay: 0.12,
          sustain: 0.5,
          release: 0.22,
          volume: 0.07,
          pan: randomInRange(-0.25, 0.25),
        }),
      ];
    },
  },
  happy: {
    baseGain: 0.24,
    loopInterval: { min: 2400, max: 3200 },
    createVoices: (ctx, master) => {
      const chirpCount = 2 + Math.floor(Math.random() * 2);
      const handles: SourceHandle[] = [];
      for (let i = 0; i < chirpCount; i += 1) {
        const offset = i * randomInRange(0.18, 0.26);
        const start = randomInRange(520, 650);
        handles.push(
          scheduleChirp(ctx, master, {
            offset,
            startFreq: start,
            endFreq: start * randomInRange(1.5, 1.7),
            duration: 0.35,
            wave: 'sine',
            attack: 0.015,
            decay: 0.09,
            sustain: 0.5,
            release: 0.18,
            volume: 0.12,
            vibrato: { speed: randomInRange(7, 9), depth: 6 },
            pan: randomInRange(-0.6, 0.6),
          })
        );
      }
      return handles;
    },
  },
  sad: {
    baseGain: 0.16,
    loopInterval: { min: 5200, max: 6400 },
    createVoices: (ctx, master) => {
      const start = randomInRange(240, 280);
      return [
        scheduleChirp(ctx, master, {
          startFreq: start,
          endFreq: start * randomInRange(0.6, 0.7),
          duration: 0.9,
          wave: 'sine',
          attack: 0.04,
          decay: 0.22,
          sustain: 0.45,
          release: 0.4,
          volume: 0.08,
          sweepCurve: 'linear',
          vibrato: { speed: 4.5, depth: 4 },
          pan: randomInRange(-0.2, 0.2),
        }),
      ];
    },
  },
  sleepy: {
    baseGain: 0.14,
    loopInterval: { min: 7600, max: 9000 },
    createVoices: (ctx, master) => {
      return [
        scheduleChirp(ctx, master, {
          startFreq: randomInRange(180, 210),
          endFreq: randomInRange(150, 190),
          duration: 1.4,
          wave: 'sine',
          attack: 0.25,
          decay: 0.6,
          sustain: 0.4,
          release: 0.6,
          volume: 0.07,
          vibrato: { speed: 2.5, depth: 3 },
          pan: randomInRange(-0.1, 0.1),
        }),
      ];
    },
  },
  angry: {
    baseGain: 0.28,
    loopInterval: { min: 1900, max: 2300 },
    createVoices: (ctx, master) => {
      const handles: SourceHandle[] = [];
      const bursts = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < bursts; i += 1) {
        const offset = i * 0.18;
        const start = randomInRange(420, 520);
        handles.push(
          scheduleChirp(ctx, master, {
            offset,
            startFreq: start,
            endFreq: start * randomInRange(1.3, 1.4),
            duration: 0.25,
            wave: 'square',
            attack: 0.01,
            decay: 0.08,
            sustain: 0.4,
            release: 0.12,
            volume: 0.16,
            vibrato: { speed: 16, depth: 12 },
            pan: randomInRange(-0.5, 0.5),
          })
        );
        handles.push(
          scheduleNoiseBurst(ctx, master, {
            offset: offset + 0.05,
            duration: 0.18,
            volume: 0.08,
            attack: 0.005,
            release: 0.1,
            pan: randomInRange(-0.4, 0.4),
          })
        );
      }
      return handles;
    },
  },
  curious: {
    baseGain: 0.2,
    loopInterval: { min: 3200, max: 4200 },
    createVoices: (ctx, master) => {
      return [
        scheduleChirp(ctx, master, {
          startFreq: randomInRange(380, 430),
          endFreq: randomInRange(600, 680),
          duration: 0.45,
          wave: 'triangle',
          attack: 0.02,
          decay: 0.12,
          sustain: 0.5,
          release: 0.18,
          volume: 0.09,
          pan: randomInRange(-0.4, 0.4),
        }),
        scheduleChirp(ctx, master, {
          offset: 0.36,
          startFreq: randomInRange(650, 720),
          endFreq: randomInRange(320, 360),
          duration: 0.5,
          wave: 'sine',
          attack: 0.03,
          decay: 0.1,
          sustain: 0.45,
          release: 0.22,
          volume: 0.085,
          vibrato: { speed: 6, depth: 5, delay: 0.05 },
          pan: randomInRange(-0.3, 0.3),
        }),
      ];
    },
  },
  bored: {
    baseGain: 0.15,
    loopInterval: { min: 6200, max: 7600 },
    createVoices: (ctx, master) => {
      return [
        scheduleChirp(ctx, master, {
          startFreq: randomInRange(220, 260),
          endFreq: randomInRange(210, 230),
          duration: 0.7,
          wave: 'sine',
          attack: 0.12,
          decay: 0.4,
          sustain: 0.35,
          release: 0.35,
          volume: 0.06,
          vibrato: { speed: 3, depth: 2 },
          pan: randomInRange(-0.2, 0.2),
        }),
      ];
    },
  },
  scared: {
    baseGain: 0.26,
    loopInterval: { min: 1800, max: 2400 },
    createVoices: (ctx, master) => {
      const handles: SourceHandle[] = [];
      const chirps = 3;
      for (let i = 0; i < chirps; i += 1) {
        handles.push(
          scheduleChirp(ctx, master, {
            offset: i * 0.12,
            startFreq: randomInRange(720, 860),
            endFreq: randomInRange(900, 1040),
            duration: 0.25,
            wave: 'sine',
            attack: 0.008,
            decay: 0.06,
            sustain: 0.3,
            release: 0.14,
            volume: 0.11,
            vibrato: { speed: 14, depth: 18 },
            pan: randomInRange(-0.7, 0.7),
          })
        );
      }
      handles.push(
        scheduleNoiseBurst(ctx, master, {
          offset: 0.05,
          duration: 0.25,
          volume: 0.06,
          attack: 0.01,
          release: 0.18,
          pan: randomInRange(-0.5, 0.5),
        })
      );
      return handles;
    },
  },
  calm: {
    baseGain: 0.19,
    loopInterval: { min: 900, max: 1200 },
    createVoices: (ctx, master) => {
      return [
        scheduleChirp(ctx, master, {
          startFreq: randomInRange(160, 190),
          endFreq: randomInRange(180, 210),
          duration: 1.4,
          wave: 'sine',
          attack: 0.18,
          decay: 0.5,
          sustain: 0.5,
          release: 0.5,
          volume: 0.07,
          vibrato: { speed: 5, depth: 4 },
          pan: randomInRange(-0.15, 0.15),
        }),
        scheduleChirp(ctx, master, {
          offset: 0.45,
          startFreq: randomInRange(220, 260),
          endFreq: randomInRange(200, 240),
          duration: 1.2,
          wave: 'triangle',
          attack: 0.25,
          decay: 0.4,
          sustain: 0.5,
          release: 0.45,
          volume: 0.06,
          pan: randomInRange(-0.2, 0.2),
        }),
      ];
    },
  },
  love: {
    baseGain: 0.22,
    loopInterval: { min: 3400, max: 4200 },
    createVoices: (ctx, master) => {
      return [
        scheduleChirp(ctx, master, {
          startFreq: randomInRange(440, 520),
          endFreq: randomInRange(660, 760),
          duration: 0.4,
          wave: 'sine',
          attack: 0.02,
          decay: 0.12,
          sustain: 0.55,
          release: 0.2,
          volume: 0.11,
          pan: randomInRange(-0.3, 0.3),
        }),
        scheduleChirp(ctx, master, {
          offset: 0.32,
          startFreq: randomInRange(520, 580),
          endFreq: randomInRange(780, 880),
          duration: 0.45,
          wave: 'triangle',
          attack: 0.015,
          decay: 0.12,
          sustain: 0.5,
          release: 0.2,
          volume: 0.12,
          vibrato: { speed: 7, depth: 5 },
          pan: randomInRange(-0.4, 0.4),
        }),
      ];
    },
  },
  excited: {
    baseGain: 0.26,
    loopInterval: { min: 1800, max: 2400 },
    createVoices: (ctx, master) => {
      const handles: SourceHandle[] = [];
      const flutters = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < flutters; i += 1) {
        const offset = i * 0.16;
        const start = randomInRange(520, 640);
        handles.push(
          scheduleChirp(ctx, master, {
            offset,
            startFreq: start,
            endFreq: start * randomInRange(1.7, 1.9),
            duration: 0.28,
            wave: 'sine',
            attack: 0.012,
            decay: 0.06,
            sustain: 0.4,
            release: 0.14,
            volume: 0.13,
            vibrato: { speed: 12, depth: 10 },
            pan: randomInRange(-0.65, 0.65),
          })
        );
      }
      return handles;
    },
  },
  confused: {
    baseGain: 0.2,
    loopInterval: { min: 3600, max: 4600 },
    createVoices: (ctx, master) => {
      return [
        scheduleChirp(ctx, master, {
          startFreq: randomInRange(320, 380),
          endFreq: randomInRange(380, 420),
          duration: 0.5,
          wave: 'sine',
          attack: 0.02,
          decay: 0.1,
          sustain: 0.55,
          release: 0.2,
          volume: 0.09,
          vibrato: { speed: 9, depth: 12 },
          pan: randomInRange(-0.4, 0.4),
        }),
        scheduleChirp(ctx, master, {
          offset: 0.32,
          startFreq: randomInRange(420, 470),
          endFreq: randomInRange(250, 300),
          duration: 0.5,
          wave: 'triangle',
          attack: 0.018,
          decay: 0.09,
          sustain: 0.5,
          release: 0.2,
          volume: 0.085,
          vibrato: { speed: 5, depth: 8 },
          pan: randomInRange(-0.35, 0.35),
        }),
      ];
    },
  },
  surprised: {
    baseGain: 0.24,
    loopInterval: { min: 3200, max: 3800 },
    createVoices: (ctx, master) => {
      return [
        scheduleNoiseBurst(ctx, master, {
          duration: 0.22,
          volume: 0.07,
          attack: 0.01,
          release: 0.15,
          pan: randomInRange(-0.2, 0.2),
        }),
        scheduleChirp(ctx, master, {
          offset: 0.1,
          startFreq: randomInRange(480, 540),
          endFreq: randomInRange(820, 940),
          duration: 0.32,
          wave: 'sine',
          attack: 0.01,
          decay: 0.08,
          sustain: 0.4,
          release: 0.16,
          volume: 0.12,
          pan: randomInRange(-0.45, 0.45),
        }),
      ];
    },
  },
  annoyed: {
    baseGain: 0.22,
    loopInterval: { min: 2600, max: 3400 },
    createVoices: (ctx, master) => {
      const handles: SourceHandle[] = [];
      const pulses = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < pulses; i += 1) {
        handles.push(
          scheduleChirp(ctx, master, {
            offset: i * 0.22,
            startFreq: randomInRange(360, 420),
            endFreq: randomInRange(340, 380),
            duration: 0.3,
            wave: 'square',
            attack: 0.015,
            decay: 0.08,
            sustain: 0.35,
            release: 0.16,
            volume: 0.11,
            vibrato: { speed: 10, depth: 6 },
            pan: randomInRange(-0.5, 0.5),
          })
        );
      }
      return handles;
    },
  },
  shy: {
    baseGain: 0.16,
    loopInterval: { min: 5200, max: 6500 },
    createVoices: (ctx, master) => {
      return [
        scheduleChirp(ctx, master, {
          startFreq: randomInRange(360, 420),
          endFreq: randomInRange(460, 510),
          duration: 0.5,
          wave: 'sine',
          attack: 0.05,
          decay: 0.18,
          sustain: 0.5,
          release: 0.28,
          volume: 0.07,
          vibrato: { speed: 5, depth: 5 },
          pan: randomInRange(-0.25, 0.25),
        }),
      ];
    },
  },
  proud: {
    baseGain: 0.24,
    loopInterval: { min: 3600, max: 4400 },
    createVoices: (ctx, master) => {
      return [
        scheduleChirp(ctx, master, {
          startFreq: randomInRange(420, 480),
          endFreq: randomInRange(510, 560),
          duration: 0.32,
          wave: 'triangle',
          attack: 0.02,
          decay: 0.1,
          sustain: 0.55,
          release: 0.2,
          volume: 0.1,
          pan: randomInRange(-0.3, 0.3),
        }),
        scheduleChirp(ctx, master, {
          offset: 0.26,
          startFreq: randomInRange(560, 620),
          endFreq: randomInRange(780, 840),
          duration: 0.35,
          wave: 'sine',
          attack: 0.015,
          decay: 0.11,
          sustain: 0.5,
          release: 0.2,
          volume: 0.12,
          vibrato: { speed: 6, depth: 6 },
          pan: randomInRange(-0.35, 0.35),
        }),
      ];
    },
  },
  silly: {
    baseGain: 0.25,
    loopInterval: { min: 2600, max: 3400 },
    createVoices: (ctx, master) => {
      const handles: SourceHandle[] = [];
      const hops = 3;
      for (let i = 0; i < hops; i += 1) {
        const offset = i * randomInRange(0.16, 0.22);
        const start = randomInRange(360, 540);
        const end = start * randomInRange(0.6, 1.8);
        handles.push(
          scheduleChirp(ctx, master, {
            offset,
            startFreq: start,
            endFreq: Math.max(120, Math.min(1100, end)),
            duration: randomInRange(0.24, 0.32),
            wave: i % 2 === 0 ? 'triangle' : 'sine',
            attack: 0.015,
            decay: 0.08,
            sustain: 0.45,
            release: 0.16,
            volume: 0.11,
            vibrato: { speed: randomInRange(8, 12), depth: 8 },
            pan: randomInRange(-0.7, 0.7),
          })
        );
      }
      return handles;
    },
  },
  determined: {
    baseGain: 0.21,
    loopInterval: { min: 2800, max: 3600 },
    createVoices: (ctx, master) => {
      const handles: SourceHandle[] = [];
      const pulses = 3;
      for (let i = 0; i < pulses; i += 1) {
        handles.push(
          scheduleChirp(ctx, master, {
            offset: i * 0.24,
            startFreq: randomInRange(320, 360),
            endFreq: randomInRange(360, 400),
            duration: 0.32,
            wave: 'triangle',
            attack: 0.02,
            decay: 0.1,
            sustain: 0.55,
            release: 0.18,
            volume: 0.11,
            vibrato: { speed: 7, depth: 4 },
            pan: randomInRange(-0.3, 0.3),
          })
        );
      }
      return handles;
    },
  },
  worried: {
    baseGain: 0.2,
    loopInterval: { min: 3000, max: 3800 },
    createVoices: (ctx, master) => {
      return [
        scheduleChirp(ctx, master, {
          startFreq: randomInRange(320, 360),
          endFreq: randomInRange(260, 300),
          duration: 0.5,
          wave: 'sine',
          attack: 0.03,
          decay: 0.1,
          sustain: 0.5,
          release: 0.25,
          volume: 0.09,
          vibrato: { speed: 8, depth: 10 },
          pan: randomInRange(-0.4, 0.4),
        }),
        scheduleChirp(ctx, master, {
          offset: 0.34,
          startFreq: randomInRange(280, 320),
          endFreq: randomInRange(240, 280),
          duration: 0.4,
          wave: 'triangle',
          attack: 0.02,
          decay: 0.09,
          sustain: 0.5,
          release: 0.2,
          volume: 0.085,
          vibrato: { speed: 9, depth: 7 },
          pan: randomInRange(-0.35, 0.35),
        }),
      ];
    },
  },
  playful: {
    baseGain: 0.25,
    loopInterval: { min: 2200, max: 3000 },
    createVoices: (ctx, master) => {
      const handles: SourceHandle[] = [];
      const bounceCount = 3;
      for (let i = 0; i < bounceCount; i += 1) {
        handles.push(
          scheduleChirp(ctx, master, {
            offset: i * 0.2,
            startFreq: randomInRange(420, 520),
            endFreq: randomInRange(580, 720),
            duration: 0.28,
            wave: 'sine',
            attack: 0.015,
            decay: 0.08,
            sustain: 0.45,
            release: 0.16,
            volume: 0.12,
            vibrato: { speed: 10, depth: 7 },
            pan: randomInRange(-0.6, 0.6),
          })
        );
      }
      handles.push(
        scheduleChirp(ctx, master, {
          offset: 0.48,
          startFreq: randomInRange(620, 680),
          endFreq: randomInRange(480, 540),
          duration: 0.3,
          wave: 'triangle',
          attack: 0.02,
          decay: 0.08,
          sustain: 0.5,
          release: 0.18,
          volume: 0.11,
          pan: randomInRange(-0.4, 0.4),
        })
      );
      return handles;
    },
  },
};

const triggerPreset = (emotion: Emotion, preset: EmotionSoundPreset) => {
  const ctx = ensureAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return 0;

  if (preset.baseGain !== undefined) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(preset.baseGain, ctx.currentTime, 0.45);
  }

  const handles = preset.createVoices(ctx, master);
  let longest = 0;
  handles.forEach((handle) => {
    registerHandle(handle);
    longest = Math.max(longest, handle.lifetime);
  });
  return longest;
};

const scheduleNextLoop = (emotion: Emotion, preset: EmotionSoundPreset, fallbackLifetime: number) => {
  if (!preset.loopInterval) return;
  const delayMs = resolveLoopInterval(preset.loopInterval, fallbackLifetime);
  loopHandle = setTimeout(() => {
    if (currentEmotion !== emotion) return;
    const lifetime = triggerPreset(emotion, preset) || fallbackLifetime;
    scheduleNextLoop(emotion, preset, lifetime);
  }, delayMs);
};

const playEmotion = (emotion: Emotion) => {
  if (!unlocked) return;
  const preset = SOUND_PRESETS[emotion];
  if (!preset) return;
  if (currentEmotion === emotion && loopHandle !== null) {
    return;
  }
  stopAllHandles();
  clearLoopHandle();
  currentEmotion = emotion;
  const lifetime = triggerPreset(emotion, preset) || 1;
  scheduleNextLoop(emotion, preset, lifetime);
};

const stopEmotion = () => {
  currentEmotion = null;
  clearLoopHandle();
  stopAllHandles();
};

export const emotionSoundscape = {
  async unlock() {
    const ctx = ensureAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        return false;
      }
    }
    unlocked = true;
    return true;
  },
  play(emotion: Emotion) {
    playEmotion(emotion);
  },
  stop() {
    stopEmotion();
  },
  isReady() {
    return unlocked;
  },
};
