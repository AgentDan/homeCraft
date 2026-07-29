import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @returns {((new () => {
 *   lang: string,
 *   interimResults: boolean,
 *   continuous: boolean,
 *   maxAlternatives: number,
 *   start: () => void,
 *   stop: () => void,
 *   onresult: ((event: any) => void) | null,
 *   onerror: ((event: any) => void) | null,
 *   onend: (() => void) | null
 * }) | null)}
 */
export function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  const w = /** @type {Window & { SpeechRecognition?: any, webkitSpeechRecognition?: any }} */ (
    window
  );
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Web Speech API STT hook (Step 9 V1–V3).
 *
 * @param {{
 *   lang?: string,
 *   onFinal?: (transcript: string) => void,
 *   onInterim?: (transcript: string) => void,
 *   disabled?: boolean
 * }} [options]
 */
export function useSpeechCommand(options = {}) {
  const { lang = 'en-US', onFinal, onInterim, disabled = false } = options;
  const [status, setStatus] = useState(
    /** @type {'idle' | 'listening' | 'unsupported' | 'error'} */ ('idle')
  );
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const recognitionRef = useRef(
    /** @type {{ stop: () => void, onresult: any, onerror: any, onend: any } | null} */ (null)
  );  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);

  useEffect(() => {
    onFinalRef.current = onFinal;
    onInterimRef.current = onInterim;
  }, [onFinal, onInterim]);

  useEffect(() => {
    if (!getSpeechRecognitionCtor()) {
      setStatus('unsupported');
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch {
        // ignore stop races
      }
      recognitionRef.current = null;
    }
    setStatus((current) => (current === 'listening' ? 'idle' : current));
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) {
      setStatus('unsupported');
      setError('Speech recognition is not available in this browser.');
      return;
    }

    stop();
    setError(null);

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        onInterimRef.current?.(interim.trim());
      }
      if (finalText.trim()) {
        onFinalRef.current?.(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      const code = event.error || 'unknown';
      if (code === 'aborted' || code === 'no-speech') {
        setStatus('idle');
        return;
      }
      setError(code);
      setStatus('error');
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus((current) => (current === 'listening' ? 'idle' : current));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStatus('listening');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      recognitionRef.current = null;
    }
  }, [disabled, lang, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    status,
    error,
    supported: status !== 'unsupported',
    listening: status === 'listening',
    start,
    stop
  };
}
