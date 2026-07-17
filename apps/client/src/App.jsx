import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { getHealth, postCommand } from './api/client.js';
import { ChatPanel } from './components/ChatPanel.jsx';
import { CommandInput } from './components/CommandInput.jsx';
import { ResponseRouter } from './components/ResponseRouter.jsx';

const ScenePreview = lazy(() =>
  import('./components/ScenePreview.jsx').then((module) => ({
    default: module.ScenePreview
  }))
);

/** @param {string} prefix */
function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function Toolstrip({ onVoice, disabled }) {
  return (
    <div className="flex items-center gap-1" aria-label="Quick tools">
      <button
        type="button"
        className="hc-icon-btn hc-icon-btn--ghost"
        disabled={disabled}
        title="Voice command"
        onClick={onVoice}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 21h8" />
        </svg>
      </button>
      <button type="button" className="hc-icon-btn hc-icon-btn--ghost" title="Home view" disabled>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5z" />
        </svg>
      </button>
      <button type="button" className="hc-icon-btn hc-icon-btn--ghost" title="Menu" disabled>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
    </div>
  );
}

export function App() {
  const [sessionId] = useState(() => newId('sess'));
  const [projectId] = useState(() => newId('proj'));
  const [response, setResponse] = useState(
    /** @type {{ requestId: string, message?: string, [key: string]: unknown } | null} */ (null)
  );
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState(
    /** @type {Array<{ id: string, role: 'user' | 'assistant', text: string }>} */ ([])
  );
  const [sceneResult, setSceneResult] = useState(
    /** @type {{ projectId: string, modules: unknown[] } | null} */ (null)
  );
  const [view, setView] = useState(
    /** @type {{ kind: '2d_plan' | '3d_scene', render: 'full' | 'delta' }} */ ({
      kind: '3d_scene',
      render: 'full'
    })
  );

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
          command,
          clientState: {}
        });
        setResponse(result);
        if (result.sceneResult) {
          setSceneResult(result.sceneResult);
        }
        if (result.view) {
          setView(result.view);
        }
        setTurns((current) => [
          ...current,
          {
            id: newId('turn'),
            role: 'assistant',
            text: result.message ?? 'Done.'
          }
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setTurns((current) => [
          ...current,
          { id: newId('turn'), role: 'assistant', text: message }
        ]);
      } finally {
        setLoading(false);
      }
    },
    [projectId, sessionId]
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden text-[var(--hc-text)]">
      <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-[var(--hc-bg)]" />}>
        <ScenePreview
          sceneResult={sceneResult ?? { projectId, modules: [] }}
          view={view}
        />
      </Suspense>

      <div
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.45)_100%)]"
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute top-4 left-5 z-20 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[var(--hc-accent)] shadow-[0_0_10px_var(--hc-accent)]" />
        <span className="text-sm font-semibold tracking-wide text-white/90">HomeCraft</span>
      </div>

      {/* Right HUD: Command above Chat */}
      <div className="pointer-events-auto absolute right-4 bottom-5 z-20 flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        <CommandInput onSubmit={sendCommand} disabled={loading} />
        <ResponseRouter
          key={response?.requestId}
          response={response}
          onCommand={sendCommand}
          disabled={loading}
          compact
        />
        <ChatPanel
          turns={turns}
          loading={loading}
          online={online}
          tools={
            <Toolstrip
              disabled={loading}
              onVoice={() => {
                const sample = window.prompt('Voice transcript (demo):', 'add module');
                if (sample?.trim()) sendCommand(sample.trim(), 'voice');
              }}
            />
          }
        />
      </div>
    </div>
  );
}
