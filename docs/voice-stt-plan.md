# Voice I/O plan (STT / microphone)

Status: **planned** (not started).  
Recommended slot: **Phase 5** (with dialog/LLM), optional polish in **Phase 6** (Expo).

---

## Goal

Replace the demo `window.prompt` voice button with real microphone capture → transcript → same dialog pipeline as text.

Invariant unchanged:

```text
microphone → STT transcript → command (string) + inputChannel: 'voice'
→ POST /api/commands → existing orchestrator
```

Server does **not** need audio. Only the client (and later Expo) talks to STT.

---

## Current state

| Piece | Status |
|-------|--------|
| `inputChannel: 'text' \| 'voice'` in contracts | ✅ |
| `sendCommand(cmd, 'voice')` in `App.jsx` | ✅ (demo) |
| Mic UI | ❌ `Toolstrip` → `prompt('Voice transcript…')` |
| Browser STT | ❌ |
| TTS from `response.speech` | ❌ |
| Server audio upload | ❌ (not planned for MVP) |

---

## Proposed approach (MVP)

**Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`):

- Pros: no new backend, no API keys, fits English intents, fast to ship  
- Cons: Chrome/Edge best; Firefox limited; needs HTTPS (or localhost); quality varies  

**UX:** push-to-talk (hold or tap mic → listen → auto-send on `onresult` / End).

**Language:** `en-US` (matches IntentRegistry).

**Fallback:** if unsupported → keep typed command + short toast «Voice not supported in this browser».

---

## Tasks

### Phase 5a — Web mic + STT (client)

| # | Task | Notes |
|---|------|--------|
| V1 | `useSpeechCommand` (or `speech.js`) wrapper around Web Speech API | start/stop, interim text, errors |
| V2 | Wire `Toolstrip` mic to hook → `sendCommand(transcript, 'voice')` | remove `window.prompt` |
| V3 | UI states: idle / listening / error | mute while `loading` |
| V4 | Show interim transcript in CommandInput or chip | optional but useful |
| V5 | Manual smoke: Chrome localhost + permission grant | document in dialog-flow |

### Phase 5b — TTS (optional, same phase)

| # | Task | Notes |
|---|------|--------|
| V6 | Speak `response.speech` via `speechSynthesis` when `inputChannel` was voice or user enabled «Speak replies» | respect mute |
| V7 | Do not block UI on TTS | fire-and-forget |

### Phase 6 — Mobile

| # | Task | Notes |
|---|------|--------|
| V8 | Expo: `expo-speech` / device STT → same `command` + `voice` | when mobile app is real |

### Out of scope (for now)

- Uploading audio blobs to the server  
- Cloud STT (Whisper/Google) — only if Web Speech quality is insufficient  
- Continuous always-on listening  

---

## Acceptance

1. Mic button requests permission and listens.  
2. Spoken English command (e.g. «add a cabinet») becomes a normal turn with `inputChannel: 'voice'`.  
3. Pipeline behavior identical to typed text.  
4. Unsupported browser fails gracefully.  
5. Demo `prompt()` is removed.

---

## File touch list (expected)

```text
apps/client/src/hooks/useSpeechCommand.js   # new
apps/client/src/App.jsx                     # Toolstrip wiring
apps/client/src/components/CommandInput.jsx # optional interim text
docs/dialog-flow.md                         # STT section
docs/Roadmap.md                             # Phase 5 tasks V1–V7
```

No contract changes required unless we later add `speechConfidence` (optional, not MVP).

---

## Decision

| Question | Decision |
|----------|----------|
| When? | Phase 5 (after Phase 4 export), unless we pull V1–V5 forward as a small spike |
| Engine? | Web Speech API first |
| Server audio? | No |
| TTS? | Optional same phase (V6–V7) |
