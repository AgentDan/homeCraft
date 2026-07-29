import { useCallback, useEffect, useState } from 'react';

const MUTE_KEY = 'homecraft.tts.muted';
const SPEAK_REPLIES_KEY = 'homecraft.tts.speakReplies';

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
 * Browser TTS via Web Speech API (Step 10 V6–V7).
 * Fire-and-forget: never blocks UI. Honours mute + speak-replies prefs.
 */
export function useSpeech() {
  const [muted, setMutedState] = useState(() => readFlag(MUTE_KEY, false));
  const [speakReplies, setSpeakRepliesState] = useState(() =>
    readFlag(SPEAK_REPLIES_KEY, false)
  );

  useEffect(() => {
    writeFlag(MUTE_KEY, muted);
  }, [muted]);

  useEffect(() => {
    writeFlag(SPEAK_REPLIES_KEY, speakReplies);
  }, [speakReplies]);

  /**
   * @param {string | undefined | null} text
   * @param {string} [lang]
   * @param {{ force?: boolean, fromVoice?: boolean }} [options]
   */
  const speak = useCallback(
    (text, lang = 'en-US', options = {}) => {
      if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
        return;
      }
      if (muted && !options.force) return;
      const allowed = options.fromVoice || speakReplies || options.force;
      if (!allowed) return;

      // V7: fire-and-forget — schedule after paint so UI never waits on TTS.
      queueMicrotask(() => {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang;
          utterance.rate = 1;
          window.speechSynthesis.speak(utterance);
        } catch {
          // ignore TTS failures
        }
      });
    },
    [muted, speakReplies]
  );

  return {
    speak,
    muted,
    setMuted: setMutedState,
    speakReplies,
    setSpeakReplies: setSpeakRepliesState
  };
}
