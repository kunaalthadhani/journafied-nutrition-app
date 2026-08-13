import { Platform } from 'react-native';

// Speech is the phone's job now. The recognizer on the device turns her words
// into text and that text enters the same pipeline as typing. No audio leaves
// the app, the AI proxy is for parsing text and images only.

// 'silent' is her saying nothing. It needs no popup, the mic simply closes.
export type VoiceFailure = 'unsupported' | 'denied' | 'silent' | 'error';

export interface VoiceHandlers {
  // isFinal marks the transcript the recognizer is done revising
  onTranscript: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (message: string, failure: VoiceFailure) => void;
}

// A recognizer left running with no speech would hold the mic forever.
const MAX_LISTEN_MS = 60000;

// The native recognizer lives in the binary. An over the air update can ship
// this file but never native code, so a build made before this feature must
// degrade to no mic button instead of crashing on a missing module.
let nativeModule: any = null;
let nativeChecked = false;

function getNativeModule(): any {
  if (nativeChecked) return nativeModule;
  nativeChecked = true;
  if (Platform.OS === 'web') return null;
  // Ask the registry BEFORE requiring. The package throws while it is being
  // evaluated when the binary has no such native module, and a throw during
  // module evaluation is reported as an uncaught error even when the require
  // sits inside a try. Checking first means we never trigger it
  const registered = (globalThis as any)?.expo?.modules?.ExpoSpeechRecognition;
  if (!registered) return null;
  try {
    nativeModule = require('expo-speech-recognition')?.ExpoSpeechRecognitionModule ?? null;
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

function getWebRecognizer(): any {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// Recognizer codes are the same vocabulary on both platforms. Say what she can
// do about it, never what the API called it.
function messageFor(code: string): { message: string; failure: VoiceFailure } {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        message: 'Microphone access is off. Turn it on for TrackKcal in your settings to log by voice.',
        failure: 'denied',
      };
    case 'no-speech':
    case 'speech-timeout':
      return { message: 'Nothing came through. Tap the mic and try again.', failure: 'silent' };
    case 'network':
      return { message: 'Voice needs a connection right now. Type it instead.', failure: 'error' };
    case 'language-not-supported':
    case 'bad-grammar':
      return { message: 'This device cannot do voice yet. Type it instead.', failure: 'unsupported' };
    case 'busy':
      return { message: 'Still finishing the last one. Give it a second.', failure: 'error' };
    default:
      return { message: 'Voice did not work that time. Type it instead.', failure: 'error' };
  }
}

class VoiceService {
  private listening = false;
  private subscriptions: { remove: () => void }[] = [];
  private webRecognition: any = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handlers: VoiceHandlers | null = null;
  private ended = false;

  // Called at render time to decide whether the mic button exists at all.
  // Must never prompt for permission.
  isSupported(): boolean {
    if (Platform.OS === 'web') return !!getWebRecognizer();
    const mod = getNativeModule();
    if (!mod) return false;
    try {
      return mod.isRecognitionAvailable();
    } catch {
      return false;
    }
  }

  isListening(): boolean {
    return this.listening;
  }

  async start(handlers: VoiceHandlers): Promise<boolean> {
    if (this.listening) return false;

    this.handlers = handlers;
    this.ended = false;

    const started = Platform.OS === 'web'
      ? this.startWeb()
      : await this.startNative();

    if (started) {
      this.listening = true;
      this.timer = setTimeout(() => this.stop(), MAX_LISTEN_MS);
    }
    return started;
  }

  // Ends the session and asks for a final transcript.
  stop(): void {
    if (!this.listening) return;
    try {
      if (Platform.OS === 'web') this.webRecognition?.stop();
      else getNativeModule()?.stop();
    } catch {
      this.finish();
    }
  }

  // Drops the session with no final result, for unmounts and cancels.
  cancel(): void {
    if (!this.listening) return;
    try {
      if (Platform.OS === 'web') this.webRecognition?.abort();
      else getNativeModule()?.abort();
    } catch {
      // the finish below is what matters
    }
    this.finish();
  }

  private async startNative(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod) {
      this.handlers?.onError('This device cannot do voice yet. Type it instead.', 'unsupported');
      return false;
    }

    try {
      // First tap of the mic is where permission is asked, never app start.
      const permission = await mod.requestPermissionsAsync();
      if (!permission?.granted) {
        this.handlers?.onError(
          'Microphone access is off. Turn it on for TrackKcal in your settings to log by voice.',
          'denied',
        );
        return false;
      }

      this.subscriptions = [
        mod.addListener('result', (event: { isFinal: boolean; results: { transcript: string }[] }) => {
          const transcript = event?.results?.[0]?.transcript ?? '';
          if (transcript) this.handlers?.onTranscript(transcript, !!event.isFinal);
        }),
        mod.addListener('error', (event: { error: string }) => {
          // Aborting is the user changing their mind, not a failure to report.
          if (event?.error === 'aborted') return;
          const { message, failure } = messageFor(event?.error ?? 'unknown');
          this.handlers?.onError(message, failure);
        }),
        mod.addListener('end', () => this.finish()),
      ];

      // continuous false lets the recognizer close itself on silence
      mod.start({ lang: 'en-US', interimResults: true, continuous: false });
      return true;
    } catch (error) {
      if (__DEV__) console.error('Speech recognition failed to start:', error);
      this.clearSubscriptions();
      this.handlers?.onError('Voice did not work that time. Type it instead.', 'error');
      return false;
    }
  }

  private startWeb(): boolean {
    const Recognizer = getWebRecognizer();
    if (!Recognizer) {
      this.handlers?.onError('This browser cannot do voice. Type it instead.', 'unsupported');
      return false;
    }

    try {
      const recognition = new Recognizer();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const isFinal = !!event.results[event.results.length - 1]?.isFinal;
        if (transcript) this.handlers?.onTranscript(transcript.trim(), isFinal);
      };
      recognition.onerror = (event: any) => {
        if (event?.error === 'aborted') return;
        const { message, failure } = messageFor(event?.error ?? 'unknown');
        this.handlers?.onError(message, failure);
      };
      recognition.onend = () => this.finish();

      this.webRecognition = recognition;
      // The browser prompts for the mic here, on her tap.
      recognition.start();
      return true;
    } catch (error) {
      if (__DEV__) console.error('Web speech recognition failed to start:', error);
      this.webRecognition = null;
      this.handlers?.onError('Voice did not work that time. Type it instead.', 'error');
      return false;
    }
  }

  // One session, one onEnd, whichever way it finished.
  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.listening = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.clearSubscriptions();
    this.webRecognition = null;

    const handlers = this.handlers;
    this.handlers = null;
    handlers?.onEnd();
  }

  private clearSubscriptions(): void {
    this.subscriptions.forEach(sub => {
      try { sub.remove(); } catch { /* already gone */ }
    });
    this.subscriptions = [];
  }
}

export const voiceService = new VoiceService();
