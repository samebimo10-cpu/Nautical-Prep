/**
 * Voice I/O behind an interface so the browser Web Speech API can later be swapped for
 * server STT/TTS without touching the oral screens.
 */
export interface VoiceProvider {
  readonly name: string;
  canListen(): boolean;
  canSpeak(): boolean;
  speak(text: string, opts?: { rate?: number; lang?: string }): Promise<void>;
  stopSpeaking(): void;
  /** Push-to-talk: start listening; partial transcripts stream to onPartial. */
  listen(onPartial: (text: string) => void, opts?: { lang?: string }): { stop: () => Promise<string> };
}

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(): void;
  stop(): void;
};

function recognitionCtor(): (new () => SR) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechVoiceProvider implements VoiceProvider {
  readonly name = "web-speech";
  canListen() {
    return recognitionCtor() !== null;
  }
  canSpeak() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }
  speak(text: string, opts: { rate?: number; lang?: string } = {}) {
    if (!this.canSpeak()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang ?? "en-GB";
      u.rate = opts.rate ?? 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  }
  stopSpeaking() {
    if (this.canSpeak()) window.speechSynthesis.cancel();
  }
  listen(onPartial: (text: string) => void, opts: { lang?: string } = {}) {
    const Ctor = recognitionCtor();
    if (!Ctor) throw new Error("Speech recognition not supported on this device");
    const rec = new Ctor();
    rec.lang = opts.lang ?? "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = "";
    let interim = "";
    rec.onresult = (e) => {
      interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      onPartial(`${finalText}${interim}`.trim());
    };
    let ended: () => void = () => {};
    const done = new Promise<void>((r) => (ended = r));
    rec.onend = () => ended();
    rec.onerror = () => ended();
    rec.start();
    return {
      stop: async () => {
        rec.stop();
        await Promise.race([done, new Promise((r) => setTimeout(r, 1500))]);
        return `${finalText}${interim}`.trim();
      },
    };
  }
}

export const voice: VoiceProvider = new WebSpeechVoiceProvider();
