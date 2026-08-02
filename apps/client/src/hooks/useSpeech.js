import { useCallback, useEffect, useRef, useState } from 'react';

const MUTE_KEY = 'homecraft.tts.muted';
const SPEAK_REPLIES_KEY = 'homecraft.tts.speakReplies';
const VOICE_ENGINE_KEY = 'homecraft.tts.voiceEngine';

/** @typedef {'browser' | 'ai'} VoiceEngine */

/**
 * @param {string} key
 * @param {boolean} fallback
 */
function readFlag(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1' || raw === 'true';
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {boolean} value
 */
function writeFlag(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

/**
 * @returns {VoiceEngine}
 */
function readVoiceEngine() {
  if (typeof window === 'undefined') return 'browser';
  try {
    const raw = window.localStorage.getItem(VOICE_ENGINE_KEY);
    return raw === 'ai' ? 'ai' : 'browser';
  } catch {
    return 'browser';
  }
}

/**
 * @param {string} text
 * @param {string} langBcp47
 */
function speakBrowser(text, langBcp47) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langBcp47;
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

/**
 * @param {string} langBcp47
 * @returns {'en' | 'ru' | 'sr'}
 */
function languageFromBcp47(langBcp47) {
  if (langBcp47.toLowerCase().startsWith('ru')) return 'ru';
  if (langBcp47.toLowerCase().startsWith('sr')) return 'sr';
  return 'en';
}

/**
 * Browser TTS and optional AI TTS (`POST /api/tts`).
 * Fire-and-forget: never blocks UI. Honours mute + speak-replies prefs.
 */
export function useSpeech() {
  const [muted, setMutedState] = useState(() => readFlag(MUTE_KEY, false));
  const [speakReplies, setSpeakRepliesState] = useState(() =>
    readFlag(SPEAK_REPLIES_KEY, false)
  );
  const [voiceEngine, setVoiceEngineState] = useState(() => readVoiceEngine());
  const [aiTtsAvailable, setAiTtsAvailable] = useState(false);
  const audioRef = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const objectUrlRef = useRef(/** @type {string | null} */ (null));

  useEffect(() => {
    writeFlag(MUTE_KEY, muted);
  }, [muted]);

  useEffect(() => {
    writeFlag(SPEAK_REPLIES_KEY, speakReplies);
  }, [speakReplies]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VOICE_ENGINE_KEY, voiceEngine);
    } catch {
      // ignore
    }
  }, [voiceEngine]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tts/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.available) {
          setAiTtsAvailable(true);
        }
      })
      .catch(() => {
        if (!cancelled) setAiTtsAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const setVoiceEngine = useCallback(
    /** @param {VoiceEngine | ((prev: VoiceEngine) => VoiceEngine)} next */
    (next) => {
      setVoiceEngineState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        if (value === 'ai' && !aiTtsAvailable) return 'browser';
        return value === 'ai' ? 'ai' : 'browser';
      });
    },
    [aiTtsAvailable]
  );

  /**
   * @param {string | undefined | null} text
   * @param {string} [lang]
   * @param {{ force?: boolean, fromVoice?: boolean }} [options]
   */
  const speak = useCallback(
    (text, lang = 'en-US', options = {}) => {
      if (!text || typeof window === 'undefined') return;
      if (muted && !options.force) return;
      const allowed = options.fromVoice || speakReplies || options.force;
      if (!allowed) return;

      const useAi = voiceEngine === 'ai' && aiTtsAvailable;

      queueMicrotask(async () => {
        try {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
          }
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }

          if (!useAi) {
            speakBrowser(text, lang);
            return;
          }

          const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              language: languageFromBcp47(lang)
            })
          });
          if (!response.ok) {
            speakBrowser(text, lang);
            return;
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.play().catch(() => {
            speakBrowser(text, lang);
          });
        } catch {
          try {
            speakBrowser(text, lang);
          } catch {
            // ignore TTS failures
          }
        }
      });
    },
    [muted, speakReplies, voiceEngine, aiTtsAvailable]
  );

  return {
    speak,
    muted,
    setMuted: setMutedState,
    speakReplies,
    setSpeakReplies: setSpeakRepliesState,
    voiceEngine,
    setVoiceEngine,
    aiTtsAvailable
  };
}
