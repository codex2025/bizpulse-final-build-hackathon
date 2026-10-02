/** Thin wrappers over the browser's own speech recognition and speech output (no key, no upload by this app). */

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export const canListen = (): boolean => recognitionCtor() !== null;
export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function createRecognition(): Recognition | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'en-IN';
  rec.interimResults = true;
  rec.continuous = false;
  return rec;
}

export const MIC_ERRORS: Record<string, string> = {
  'not-allowed': 'The microphone is blocked. Allow it in the browser’s site settings, then try again.',
  'service-not-allowed': 'The microphone is blocked. Allow it in the browser’s site settings, then try again.',
  'no-speech': 'I did not hear anything. Press the microphone and try again.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs an internet connection.',
};

/** What is read aloud: symbols spelled out, and only the first few sentences of a long answer. */
export function speakable(text: string, maxChars = 420): string {
  const clean = text
    .replace(/₹\s?/g, 'rupees ')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return (end > 120 ? cut.slice(0, end + 1) : cut) + ' The rest is on screen.';
}

export function speak(text: string, onDone?: () => void): void {
  if (!canSpeak()) {
    onDone?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = 'en-IN';
  u.rate = 1.02;
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    onDone?.();
  };
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
