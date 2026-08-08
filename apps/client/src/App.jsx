import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { getHealth, isApiError, postCommand } from './api/client.js';
import { BomPanel } from './components/BomPanel.jsx';
import { BudgetIndicator } from './components/BudgetIndicator.jsx';
import { ChatPanel } from './components/ChatPanel.jsx';
import { CommandInput } from './components/CommandInput.jsx';
import { LanguageSwitcher } from './components/LanguageSwitcher.jsx';
import { useSpeech } from './hooks/useSpeech.js';
import { useSpeechCommand } from './hooks/useSpeechCommand.js';
import { useLocale } from './i18n/LocaleContext.jsx';

const ScenePreview = lazy(() =>
  import('./components/ScenePreview.jsx').then((module) => ({
    default: module.ScenePreview
  }))
);

/** @param {string} prefix */
function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Chat text for an API response. Extra panels were removed — everything lives
 * in chat; the user replies via the top command field.
 * @param {{
 *   message?: string,
 *   responseType?: string,
 *   downloadUrl?: string,
 *   interaction?: { options?: Array<{ label: string }> },
 *   compatibility?: {
 *     conflicts?: Array<{ message?: string, suggestedSkus?: string[], instanceIds?: string[] }>
 *   }
 * }} result
 * @param {string} fallback
 */
function assistantMessageFromResponse(result, fallback) {
  /** @type {string[]} */
  const parts = [result.message?.trim() || fallback];

  if (result.responseType === 'options') {
    for (const option of result.interaction?.options ?? []) {
      if (option.label) parts.push(option.label);
    }
  }

  const conflicts = result.compatibility?.conflicts ?? [];
  for (const conflict of conflicts) {
    if (conflict.message) parts.push(conflict.message);
    const skus = conflict.suggestedSkus ?? [];
    if (skus.length > 0) {
      const instanceId = conflict.instanceIds?.[0];
      parts.push(
        instanceId
          ? `→ ${skus.map((sku) => `replace ${instanceId} with ${sku}`).join(' | ')}`
          : `→ ${skus.join(' | ')}`
      );
    }
  }

  if (result.downloadUrl) {
    parts.push(result.downloadUrl);
  }

  return parts.join('\n');
}

/** @param {number} mm */
function toMeters(mm) {
  return (mm / 1000).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

/**
 * @param {{
 *   roomShape: { dimensions: { widthMm: number, depthMm: number, heightMm: number } } | null
 * }} props
 */
function RoomBadge({ roomShape }) {
  const dims = roomShape?.dimensions;
  if (!dims) return null;
  const areaM2 = ((dims.widthMm / 1000) * (dims.depthMm / 1000)).toLocaleString(
    'en-US',
    { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  );

  return (
    <div className="hc-glass hc-glass--compact flex items-center gap-3 px-3 py-2">
      <span
        className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--hc-accent)]/15 text-[var(--hc-accent)]"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7z" />
          <path d="M3 8.5 12 13l9-4.5M12 13v7" />
        </svg>
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white">
          {toMeters(dims.widthMm)} × {toMeters(dims.depthMm)}
          <span className="ml-1 text-[var(--hc-muted)]">m</span>
        </div>
        <div className="text-[11px] tracking-wide text-[var(--hc-muted)]">
          H {toMeters(dims.heightMm)} m · {areaM2} m²
        </div>
      </div>
    </div>
  );
}

const DEFAULT_ROOM_SHAPE = {
  dimensions: { widthMm: 3000, depthMm: 4000, heightMm: 2700 }
};

/**
 * @param {{
 *   onVoice: () => void,
 *   disabled?: boolean,
 *   voiceTitle: string,
 *   listening?: boolean,
 *   muted?: boolean,
 *   speakReplies?: boolean,
 *   voiceEngine?: 'browser' | 'ai',
 *   aiTtsAvailable?: boolean,
 *   onToggleMute?: () => void,
 *   onToggleSpeakReplies?: () => void,
 *   onToggleVoiceEngine?: () => void,
 *   muteTitle?: string,
 *   speakRepliesTitle?: string,
 *   voiceEngineTitle?: string
 * }} props
 */
function Toolstrip({
  onVoice,
  disabled,
  voiceTitle,
  listening = false,
  muted = false,
  speakReplies = false,
  voiceEngine = 'browser',
  aiTtsAvailable = false,
  onToggleMute,
  onToggleSpeakReplies,
  onToggleVoiceEngine,
  muteTitle = 'Mute',
  speakRepliesTitle = 'Speak replies',
  voiceEngineTitle = 'Voice engine'
}) {
  return (
    <div className="flex items-center gap-1" aria-label="Quick tools">
      <button
        type="button"
        className={`hc-icon-btn hc-icon-btn--ghost ${listening ? 'text-[var(--hc-accent)]' : ''}`}
        disabled={disabled}
        title={voiceTitle}
        aria-pressed={listening}
        onClick={onVoice}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 21h8" />
        </svg>
      </button>
      <button
        type="button"
        className={`hc-icon-btn hc-icon-btn--ghost ${speakReplies ? 'text-[var(--hc-accent)]' : ''}`}
        title={speakRepliesTitle}
        aria-pressed={speakReplies}
        onClick={onToggleSpeakReplies}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <path d="M15.5 8.5a4 4 0 0 1 0 7M18 6a7 7 0 0 1 0 12" />
        </svg>
      </button>
      <button
        type="button"
        className={`hc-icon-btn hc-icon-btn--ghost ${voiceEngine === 'ai' ? 'text-[var(--hc-accent)]' : ''}`}
        title={voiceEngineTitle}
        aria-pressed={voiceEngine === 'ai'}
        disabled={!aiTtsAvailable && voiceEngine !== 'ai'}
        onClick={onToggleVoiceEngine}
      >
        <span className="text-[9px] font-semibold tracking-wide">
          {voiceEngine === 'ai' ? 'AI' : 'BR'}
        </span>
      </button>
      <button
        type="button"
        className={`hc-icon-btn hc-icon-btn--ghost ${muted ? 'text-[var(--hc-accent)]' : ''}`}
        title={muteTitle}
        aria-pressed={muted}
        onClick={onToggleMute}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {muted ? (
            <>
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              <path d="m16 9 6 6M22 9l-6 6" />
            </>
          ) : (
            <>
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              <path d="M15.5 8.5a4 4 0 0 1 0 7" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

export function App() {
  const { locale, t, speechLang } = useLocale();
  const [sessionId] = useState(() => newId('sess'));
  const [projectId] = useState(() => newId('proj'));
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState(
    /** @type {Array<{ id: string, role: 'user' | 'assistant', text: string }>} */ ([])
  );
  const [sceneResult, setSceneResult] = useState(
    /** @type {{ projectId: string, modules: unknown[] } | null} */ (null)
  );
  const [roomShape, setRoomShape] = useState(
    /** @type {{ dimensions: { widthMm: number, depthMm: number, heightMm: number } }} */ (
      DEFAULT_ROOM_SHAPE
    )
  );
  const [bom, setBom] = useState(
    /** @type {{
     *   lines?: Array<Record<string, unknown>>,
     *   subtotalEur?: number,
     *   vatEur?: number,
     *   totalEur?: number,
     *   catalogSnapshotId?: string
     * } | null} */ (null)
  );
  const [budgetEur, setBudgetEur] = useState(
    /** @type {number | null} */ (null)
  );
  const [planVersion, setPlanVersion] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const {
    speak,
    muted,
    setMuted,
    speakReplies,
    setSpeakReplies,
    voiceEngine,
    setVoiceEngine,
    aiTtsAvailable
  } = useSpeech();

  useEffect(() => {
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  const sendCommand = useCallback(
    /**
     * @param {string} command
     * @param {'text' | 'voice'} [inputChannel]
     */
    async (command, inputChannel = 'text') => {
      setLoading(true);
      setInterimTranscript('');
      setTurns((current) => [
        ...current,
        { id: newId('turn'), role: 'user', text: command }
      ]);
      try {
        const result = await postCommand({
          requestId: newId('req'),
          sessionId,
          projectId,
          inputChannel,
          language: locale,
          command,
          expectedVersion: planVersion,
          clientState: {}
        });
        if (typeof result.planVersion === 'number') {
          setPlanVersion(result.planVersion);
        }
        if (result.speech) {
          speak(result.speech, speechLang, { fromVoice: inputChannel === 'voice' });
        }
        if (result.sceneResult) {
          setSceneResult(result.sceneResult);
        }
        if (result.roomShape) {
          setRoomShape(result.roomShape);
        }
        if (result.bom) {
          setBom(result.bom);
        }
        if (result.budgetEur !== undefined) {
          setBudgetEur(result.budgetEur);
        }
        setTurns((current) => [
          ...current,
          {
            id: newId('turn'),
            role: 'assistant',
            text: assistantMessageFromResponse(result, t('done'))
          }
        ]);
      } catch (err) {
        if (isApiError(err) && err.code === 'version_conflict') {
          const current =
            typeof err.body?.currentVersion === 'number'
              ? err.body.currentVersion
              : planVersion;
          setPlanVersion(current);
          setTurns((currentTurns) => [
            ...currentTurns,
            {
              id: newId('turn'),
              role: 'assistant',
              text: t('versionConflict', { current })
            }
          ]);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          setTurns((current) => [
            ...current,
            { id: newId('turn'), role: 'assistant', text: message }
          ]);
        }
      } finally {
        setLoading(false);
      }
    },
    [projectId, sessionId, speak, locale, speechLang, t, planVersion]
  );

  const {
    status: voiceStatus,
    error: voiceError,
    listening,
    start: startVoice,
    stop: stopVoice,
    supported: voiceSupported
  } = useSpeechCommand({
    lang: speechLang,
    disabled: loading,
    onInterim: setInterimTranscript,
    onFinal: (transcript) => {
      setInterimTranscript('');
      if (transcript.trim()) {
        sendCommand(transcript.trim(), 'voice');
      }
    }
  });

  const voiceTitle = listening
    ? t('voiceListening')
    : voiceStatus === 'unsupported'
      ? t('voiceUnsupported')
      : voiceError
        ? t('voiceError', { error: voiceError })
        : t('voiceTitle');

  return (
    <div className="relative h-dvh w-full overflow-hidden text-[var(--hc-text)]">
      <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-[var(--hc-bg)]" />}>
        <ScenePreview
          sceneResult={sceneResult ?? { projectId, modules: [] }}
          roomShape={roomShape}
        />
      </Suspense>

      <div
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.45)_100%)]"
        aria-hidden="true"
      />

      <div className="pointer-events-auto absolute top-4 left-5 z-20 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--hc-accent)] shadow-[0_0_10px_var(--hc-accent)]" />
            <span className="text-sm font-semibold tracking-wide text-white/90">HomeCraft</span>
          </div>
          <LanguageSwitcher />
        </div>
        <RoomBadge roomShape={roomShape} />
        <BudgetIndicator budgetEur={budgetEur} totalEur={bom?.totalEur ?? null} />
        <BomPanel bom={/** @type {any} */ (bom)} />
      </div>

      <div className="pointer-events-auto absolute right-4 bottom-5 z-20 flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        <CommandInput
          onSubmit={sendCommand}
          disabled={loading}
          interimTranscript={interimTranscript}
        />
        <ChatPanel
          turns={turns}
          loading={loading}
          online={online}
          tools={
            <Toolstrip
              disabled={loading || !voiceSupported}
              voiceTitle={voiceTitle}
              listening={listening}
              muted={muted}
              speakReplies={speakReplies}
              voiceEngine={voiceEngine}
              aiTtsAvailable={aiTtsAvailable}
              muteTitle={muted ? t('unmuteSpeech') : t('muteSpeech')}
              speakRepliesTitle={t('speakReplies')}
              voiceEngineTitle={
                aiTtsAvailable
                  ? voiceEngine === 'ai'
                    ? t('voiceEngineAi')
                    : t('voiceEngineBrowser')
                  : t('voiceEngineAiUnavailable')
              }
              onToggleMute={() => setMuted((value) => !value)}
              onToggleSpeakReplies={() => setSpeakReplies((value) => !value)}
              onToggleVoiceEngine={() =>
                setVoiceEngine((current) =>
                  current === 'ai' ? 'browser' : 'ai'
                )
              }
              onVoice={() => {
                if (listening) {
                  stopVoice();
                  setInterimTranscript('');
                  return;
                }
                startVoice();
              }}
            />
          }
        />
      </div>
    </div>
  );
}
