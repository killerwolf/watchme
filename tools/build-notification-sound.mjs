// Genere misc/notification-sound.wav.
//
// Le fichier audio est un artefact : ce script en est la source. On evite
// ainsi un binaire orpheline dont personne ne sait d'ou il vient — meme
// logique que assets/icon.svg pour l'icone.
//
//   npm run sound:build
//
// Cahier des charges : une petite fanfare de fin facon Super Nintendo.
// Ondes pulsees (le timbre "chiptune"), arpege ascendant qui se termine
// sur l'octave, deux voix — la SNES etait polyphonique, contrairement a la
// NES — et une reverb courte, sa signature sonore.
//
// Frequence d'echantillonnage : 32000 Hz, celle du DSP de la console.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 32000;
const CHANNELS = 2;
const BITS = 16;

// Do majeur : l'arpege monte puis se pose sur l'octave.
const LEAD = [
  { hz: 523.25, start: 0.0, dur: 0.075 }, // do5
  { hz: 659.25, start: 0.07, dur: 0.075 }, // mi5
  { hz: 783.99, start: 0.14, dur: 0.075 }, // sol5
  { hz: 1046.5, start: 0.21, dur: 0.42 }, // do6, tenue finale
];

// Voix d'accompagnement, une sixte plus bas, en retrait.
const HARMONY = [
  { hz: 329.63, start: 0.0, dur: 0.075 }, // mi4
  { hz: 392.0, start: 0.07, dur: 0.075 }, // sol4
  { hz: 523.25, start: 0.14, dur: 0.075 }, // do5
  { hz: 659.25, start: 0.21, dur: 0.42 }, // mi5
];

const DURATION = 0.78;
const TOTAL = Math.floor(SAMPLE_RATE * DURATION);

/** Onde pulsee : le timbre carre des consoles 8/16 bits. */
function pulse(phase, duty) {
  return phase % 1 < duty ? 1 : -1;
}

/**
 * Enveloppe percussive : attaque tres courte pour eviter le clic,
 * puis decroissance exponentielle.
 */
function envelope(t, dur) {
  if (t < 0 || t > dur) return 0;
  const attack = 0.004;
  if (t < attack) return t / attack;
  return Math.exp(-3.2 * ((t - attack) / (dur - attack)));
}

function renderVoice(notes, { duty, gain, vibrato }) {
  const out = new Float64Array(TOTAL);
  for (const note of notes) {
    const from = Math.floor(note.start * SAMPLE_RATE);
    const to = Math.min(
      TOTAL,
      Math.floor((note.start + note.dur) * SAMPLE_RATE)
    );
    let phase = 0;
    for (let i = from; i < to; i++) {
      const t = (i - from) / SAMPLE_RATE;
      // Le vibrato ne s'installe que sur la note tenue, comme un musicien.
      const depth = vibrato * Math.min(1, t / 0.18);
      const hz = note.hz * (1 + depth * Math.sin(2 * Math.PI * 5.5 * t));
      phase += hz / SAMPLE_RATE;
      out[i] += pulse(phase, duty) * envelope(t, note.dur) * gain;
    }
  }
  return out;
}

/** Reverb rudimentaire : quelques echos decroissants. */
function reverb(input, { delayMs, feedback, taps }) {
  const out = Float64Array.from(input);
  const delay = Math.floor((delayMs / 1000) * SAMPLE_RATE);
  for (let tap = 1; tap <= taps; tap++) {
    const offset = delay * tap;
    const gain = feedback ** tap;
    for (let i = offset; i < TOTAL; i++) {
      out[i] += input[i - offset] * gain;
    }
  }
  return out;
}

const lead = renderVoice(LEAD, { duty: 0.25, gain: 0.5, vibrato: 0.006 });
const harmony = renderVoice(HARMONY, { duty: 0.5, gain: 0.22, vibrato: 0 });

// Leger etalement stereo : la SNES etait stereo, on place les deux voix
// de part et d'autre du centre plutot que de les empiler.
const left = reverb(
  lead.map((v, i) => v * 0.85 + harmony[i]),
  { delayMs: 92, feedback: 0.26, taps: 3 }
);
const right = reverb(
  lead.map((v, i) => v + harmony[i] * 0.7),
  { delayMs: 108, feedback: 0.26, taps: 3 }
);

// Normalisation a -1 dBFS, avec une saturation douce en garde-fou.
let peak = 0;
for (let i = 0; i < TOTAL; i++) {
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const normalize = 0.891 / (peak || 1);

// Fondu de sortie, pour ne pas couper net sur la queue de reverb.
const fadeFrom = Math.floor(TOTAL * 0.82);

const pcm = Buffer.alloc(TOTAL * CHANNELS * (BITS / 8));
for (let i = 0; i < TOTAL; i++) {
  const fade = i < fadeFrom ? 1 : 1 - (i - fadeFrom) / (TOTAL - fadeFrom);
  for (const [channel, source] of [left, right].entries()) {
    const value = Math.tanh(source[i] * normalize) * fade;
    const sample = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
    pcm.writeInt16LE(sample, (i * CHANNELS + channel) * 2);
  }
}

const byteRate = SAMPLE_RATE * CHANNELS * (BITS / 8);
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(CHANNELS, 22);
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(byteRate, 28);
header.writeUInt16LE(CHANNELS * (BITS / 8), 32);
header.writeUInt16LE(BITS, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const target = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'misc',
  'notification-sound.wav'
);
writeFileSync(target, Buffer.concat([header, pcm]));

const kb = Math.round((header.length + pcm.length) / 102.4) / 10;
console.log(`${path.relative(process.cwd(), target)} — ${DURATION}s, ${kb} Ko`);
