/**
 * Browser TTS via Web Speech API — no server, no deps, no cost.
 */
export function useSpeech() {
  return (text, lang = 'en-US') => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };
}
