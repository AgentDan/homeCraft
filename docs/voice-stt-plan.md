# Voice I/O plan (STT / microphone)

Status: **done** (Steps 9–10).  
Roadmap: Step 9 = STT V1–V5; Step 10 = Explanation + TTS V6–V7.

---

## Goal

Replace the demo `window.prompt` voice button with real microphone capture → transcript → same dialog pipeline as text.

Invariant unchanged:

```text
microphone → STT transcript → command (string) + inputChannel: 'voice'
→ POST /api/commands → existing orchestrator
```

Server does **not** need audio. Only the client talks to STT.

---

## Approach (shipped)

**Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`):

- Pros: no new backend, no API keys, fits intents, fast to ship
- Cons: Chrome/Edge best; Firefox limited; needs HTTPS (or localhost)

**UX:** tap mic → listen → auto-send on final transcript; tap again to stop.

**Language:** follows UI locale (`speechLang` from `LocaleContext`).

**Fallback:** unsupported browser → mic disabled + title explains why.

---

## Tasks

### Step 9 — Web mic + STT (client)

| # | Task | Status |
|---|------|--------|
| V1 | `useSpeechCommand` around Web Speech API | ✅ |
| V2 | Wire Toolstrip mic → `sendCommand(transcript, 'voice')` | ✅ |
| V3 | UI states: idle / listening / error | ✅ |
| V4 | Interim transcript in `CommandInput` | ✅ |
| V5 | Manual smoke: Chrome localhost + mic permission | ✅ (documented) |

### Step 10 — Explanation + TTS

| # | Task | Status |
|---|------|--------|
| V6 | Speak `response.speech` when voice channel or “Speak replies”; honour mute | ✅ |
| V7 | TTS fire-and-forget (`queueMicrotask`) | ✅ |

Grounded explanations: `decision-report.js` → `explainFromReport` (numbers must appear in the report).

### Deferred (mobile)

| # | Task | Notes |
|---|------|--------|
| V8 | Expo device STT → same `command` + `voice` | when mobile app is real |

### Out of scope

- Uploading audio blobs to the server
- Cloud STT (Whisper/Google) — only if Web Speech quality is insufficient
- Continuous always-on listening

---

## Acceptance

1. Mic button requests permission and listens.
2. Spoken command becomes a normal turn with `inputChannel: 'voice'`.
3. Pipeline behavior identical to typed text.
4. Unsupported browser fails gracefully.
5. Demo `prompt()` is removed.

---

## File touch list

```text
apps/client/src/hooks/useSpeechCommand.js
apps/client/src/hooks/useSpeech.js
apps/client/src/App.jsx
apps/client/src/components/CommandInput.jsx
apps/server/src/core/decision-report.js
apps/server/src/core/output-builder.js
docs/Roadmap.md
```
