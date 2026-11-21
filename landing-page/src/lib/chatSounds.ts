/**
 * Short, soft sounds for the message bar, made in the browser so no audio
 * files are needed. They only ever play right after a tap or key press.
 */

export type ChatSound = "send" | "record-start" | "record-cancel";

/** Each note: pitch in Hz, when it starts and how long it lasts, in seconds. */
const NOTES: Record<ChatSound, { pitch: number; at: number; length: number }[]> = {
  // A quick rising pair: the message is on its way.
  send: [
    { pitch: 660, at: 0, length: 0.07 },
    { pitch: 990, at: 0.06, length: 0.11 },
  ],
  // One low blip: the microphone is listening.
  "record-start": [{ pitch: 520, at: 0, length: 0.09 }],
  // A falling pair: the recording was thrown away.
  "record-cancel": [
    { pitch: 440, at: 0, length: 0.07 },
    { pitch: 300, at: 0.06, length: 0.12 },
  ],
};

const VOLUME = 0.07;

let context: AudioContext | null = null;

export function playChatSound(sound: ChatSound) {
  try {
    context ??= new AudioContext();
    const audio = context;
    if (audio.state === "suspended") void audio.resume();

    for (const note of NOTES[sound]) {
      const start = audio.currentTime + note.at;
      const end = start + note.length;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.pitch, start);
      // Fade in and out so the note does not click.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(VOLUME, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  } catch {
    // Sound is a nicety; a browser that cannot play it stays silent.
  }
}
