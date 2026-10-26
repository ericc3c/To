import React, { useRef } from 'react';
import {
  CameraPerspective,
  InspectableLandmark,
  LIGHTING_PRESETS,
  TimeOfDay,
} from '../game/islandLogic';

interface GameHudProps {
  perspective: CameraPerspective;
  onTogglePerspective: () => void;
  timeOfDay: TimeOfDay;
  onCycleTime: () => void;
  onSelectTime: (t: TimeOfDay) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  isPaused: boolean;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  nearbyLandmark: InspectableLandmark | null;
  activeObservation: InspectableLandmark | null;
  onTriggerObserve: () => void;
  onCloseObservation: () => void;
  observedIds: string[];
  allLandmarks: InspectableLandmark[];
  onTeleportToLandmark: (lm: InspectableLandmark) => void;
  currentZoneName: string;
  dockCollapsed: boolean;
  onToggleDock: () => void;
  onTouchMoveInput: (dx: number, dy: number) => void;
  onTouchLookInput: (dx: number, dy: number) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  perspective,
  onTogglePerspective,
  timeOfDay,
  onCycleTime,
  onSelectTime,
  isMuted,
  onToggleMute,
  onPause,
  isPaused,
  onResume,
  onRestart,
  onReturnTitle,
  nearbyLandmark,
  activeObservation,
  onTriggerObserve,
  onCloseObservation,
  observedIds,
  allLandmarks,
  onTeleportToLandmark,
  currentZoneName,
  dockCollapsed,
  onToggleDock,
  onTouchMoveInput,
  onTouchLookInput,
}) => {
  const preset = LIGHTING_PRESETS[timeOfDay];

  // Touch Virtual Joystick state refs
  const moveStickRef = useRef<HTMLDivElement>(null);
  const moveKnobRef = useRef<HTMLDivElement>(null);
  const lookStickRef = useRef<HTMLDivElement>(null);
  const lookKnobRef = useRef<HTMLDivElement>(null);

  const handleStickPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    stickRef: React.RefObject<HTMLDivElement | null>,
    knobRef: React.RefObject<HTMLDivElement | null>,
    callback: (dx: number, dy: number) => void
  ) => {
    e.stopPropagation();
    const el = stickRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;

    const updateFromClient = (clientX: number, clientY: number) => {
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR && dist > 0) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      if (knobRef.current) {
        knobRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }
      callback(dx / maxR, dy / maxR);
    };

    updateFromClient(e.clientX, e.clientY);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      updateFromClient(ev.clientX, ev.clientY);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      if (knobRef.current) {
        knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
      callback(0, 0);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between p-4 md:p-6">
        {/* Top-Left World-Matched Status Plaque: Zone & Memories Observed */}
        <div
          className="px-4 py-2.5 rounded-lg flex items-center gap-4"
          style={{
            backgroundColor: 'rgba(20, 26, 36, 0.84)',
            border: '1px solid rgba(246, 193, 119, 0.32)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
          }}
        >
          {/* SVG Vermilion Seal Icon */}
          <svg
            viewBox="0 0 24 24"
            className="w-7 h-7 shrink-0"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="20"
              height="20"
              rx="4"
              fill="#c93528"
              stroke="#ffdca8"
              strokeWidth="1.5"
            />
            <path
              d="M6 9 H18 M8 9 V18 M16 9 V18 M5 6 C9 7, 15 7, 19 6"
              stroke="#fffaf0"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-amber-200/80 font-medium">
              {currentZoneName}
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-xl font-bold text-amber-50 font-mono"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {observedIds.length} / {allLandmarks.length}
              </span>
              <span className="text-xs text-amber-100/75">
                Memories Observed
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right Compact Utility Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePerspective();
            }}
            className="h-10 px-3 rounded-lg flex items-center gap-2 text-xs font-medium text-amber-50 hover:brightness-110 transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'rgba(20, 26, 36, 0.84)',
              border: '1px solid rgba(246, 193, 119, 0.32)',
            }}
            aria-label={`Switch Camera View (Currently ${
              perspective === 'third' ? '3rd Person' : '1st Person'
            })`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M12 5c-3.86 0-7 3.14-7 7s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            <span>{perspective === 'third' ? '3rd Person [V]' : '1st Person [V]'}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleTime();
            }}
            className="h-10 px-3 rounded-lg flex items-center gap-2 text-xs font-medium text-amber-50 hover:brightness-110 transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'rgba(20, 26, 36, 0.84)',
              border: '1px solid rgba(246, 193, 119, 0.32)',
            }}
            aria-label={`Cycle Lighting Time of Day (Currently ${preset.label})`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-amber-300">
              <circle cx="12" cy="12" r="5" />
              <path
                d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden sm:inline">{preset.label} [T]</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-50 hover:brightness-110 transition-transform active:scale-95 cursor-pointer shrink-0"
            style={{
              backgroundColor: 'rgba(20, 26, 36, 0.84)',
              border: '1px solid rgba(246, 193, 119, 0.32)',
            }}
            aria-label={isMuted ? 'Unmute Sound [M]' : 'Mute Sound [M]'}
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-50 hover:brightness-110 transition-transform active:scale-95 cursor-pointer shrink-0"
            style={{
              backgroundColor: 'rgba(20, 26, 36, 0.84)',
              border: '1px solid rgba(246, 193, 119, 0.32)',
            }}
            aria-label="Pause Game [P]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Subtle Center Crosshair Dot in 1st Person Mode */}
      {perspective === 'first' && !activeObservation && !isPaused && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
          style={{
            backgroundColor: 'rgba(255, 250, 240, 0.7)',
            boxShadow: '0 0 6px rgba(0, 0, 0, 0.6)',
          }}
        />
      )}

      {/* Interactive Inspection Prompt ([E] Observe) when near a Landmark */}
      {nearbyLandmark && !activeObservation && !isPaused && (
        <div className="fixed left-1/2 bottom-36 -translate-x-1/2 pointer-events-auto z-20">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerObserve();
            }}
            className="px-5 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium text-amber-50 shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(18, 24, 34, 0.9)',
              border: '1px solid rgba(246, 193, 119, 0.55)',
            }}
          >
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-300 text-stone-950">
              E
            </span>
            <span>Observe · {nearbyLandmark.title}</span>
          </button>
        </div>
      )}

      {/* Poetic Environmental Storytelling Caption Card when Inspecting a Landmark */}
      {activeObservation && !isPaused && (
        <div className="fixed inset-x-0 bottom-28 flex justify-center px-4 pointer-events-auto z-20">
          <div
            className="w-full max-w-xl p-6 rounded-xl shadow-2xl"
            style={{
              backgroundColor: 'rgba(16, 22, 32, 0.92)',
              border: '1px solid rgba(246, 193, 119, 0.45)',
            }}
            role="dialog"
            aria-label={activeObservation.title}
          >
            <div className="flex items-center justify-between gap-4 mb-1">
              <span className="text-xs font-mono tracking-wider uppercase text-amber-300/90">
                {activeObservation.subtitle} · {activeObservation.jpTitle}
              </span>
              <span className="text-xs font-mono text-amber-200/70">
                Memory Recorded
              </span>
            </div>

            <h2
              className="text-2xl font-semibold text-amber-50 mb-2.5"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {activeObservation.title}
            </h2>

            <p className="text-sm md:text-base text-amber-50/90 leading-relaxed mb-5">
              “{activeObservation.caption}”
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCloseObservation();
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-950 cursor-pointer transition-transform active:scale-95"
                style={{ backgroundColor: '#f6c177' }}
              >
                Continue Walk [E / Space]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive On-Screen Virtual Touch Joysticks (Left: Move, Right: Look) */}
      {!isPaused && (
        <div className="fixed inset-x-0 bottom-20 px-5 flex items-end justify-between pointer-events-none md:opacity-75">
          {/* Left Virtual Joystick: Movement */}
          <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
            <div
              ref={moveStickRef}
              onPointerDown={(e) =>
                handleStickPointerDown(
                  e,
                  moveStickRef,
                  moveKnobRef,
                  onTouchMoveInput
                )
              }
              className="w-24 h-24 rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: 'rgba(18, 24, 34, 0.62)',
                border: '1.5px solid rgba(246, 193, 119, 0.35)',
              }}
              aria-label="Virtual Movement Joystick"
            >
              <div
                ref={moveKnobRef}
                className="w-10 h-10 rounded-full pointer-events-none"
                style={{
                  backgroundColor: 'rgba(246, 193, 119, 0.85)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
                }}
              />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-100/75">
              Walk
            </span>
          </div>

          {/* Right Virtual Joystick: Camera Look */}
          <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
            <div
              ref={lookStickRef}
              onPointerDown={(e) =>
                handleStickPointerDown(
                  e,
                  lookStickRef,
                  lookKnobRef,
                  onTouchLookInput
                )
              }
              className="w-24 h-24 rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: 'rgba(18, 24, 34, 0.62)',
                border: '1.5px solid rgba(246, 193, 119, 0.35)',
              }}
              aria-label="Virtual Camera Look Joystick"
            >
              <div
                ref={lookKnobRef}
                className="w-10 h-10 rounded-full pointer-events-none"
                style={{
                  backgroundColor: 'rgba(255, 250, 240, 0.82)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
                }}
              />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-100/75">
              Look
            </span>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Zero Side-Panel Clutter) */}
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-3 z-20 flex flex-col items-center pointer-events-auto transition-transform duration-200"
        style={{
          maxWidth: 'min(920px, 94vw)',
          width: '100%',
        }}
      >
        {/* Collapse / Expand Toggle Handle */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleDock();
          }}
          className="px-3.5 py-1 rounded-t-lg text-[11px] font-mono text-amber-100/90 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          style={{
            backgroundColor: 'rgba(18, 24, 34, 0.88)',
            borderTop: '1px solid rgba(246, 193, 119, 0.32)',
            borderLeft: '1px solid rgba(246, 193, 119, 0.32)',
            borderRight: '1px solid rgba(246, 193, 119, 0.32)',
          }}
        >
          <svg
            viewBox="0 0 16 16"
            className="w-3 h-3 fill-none stroke-current"
            strokeWidth="2"
          >
            {dockCollapsed ? (
              <path d="M4 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
          <span>{dockCollapsed ? 'Show Island Dock [H]' : 'Hide Controls [H]'}</span>
        </button>

        {!dockCollapsed && (
          <div
            className="w-full px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xl"
            style={{
              backgroundColor: 'rgba(18, 24, 34, 0.9)',
              border: '1px solid rgba(246, 193, 119, 0.32)',
            }}
          >
            {/* Time of Day Segmented Controls */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-950/70">
              {(['sunset', 'twilight', 'day'] as TimeOfDay[]).map((mode) => {
                const active = timeOfDay === mode;
                const label =
                  mode === 'sunset'
                    ? 'Sunset'
                    : mode === 'twilight'
                    ? 'Twilight'
                    : 'Day';
                return (
                  <button
                    key={mode}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectTime(mode);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-amber-300 text-stone-950 font-semibold'
                        : 'text-amber-100/80 hover:text-amber-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Quick Landmark Footpath Stops */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              <span className="text-[11px] font-mono text-amber-200/70 mr-1 shrink-0">
                Stroll to:
              </span>
              {allLandmarks.map((lm) => {
                const visited = observedIds.includes(lm.id);
                const shortLabel =
                  lm.id === 'fishing_boat'
                    ? 'Pier & Boat'
                    : lm.id === 'vending_machine'
                    ? 'Vending'
                    : lm.id === 'bus_stop'
                    ? 'Bus Stop'
                    : lm.id === 'torii_gate'
                    ? 'Torii Gate'
                    : lm.id === 'jizo_statue'
                    ? 'Jizo Statue'
                    : 'Hilltop Shrine';
                return (
                  <button
                    key={lm.id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onTeleportToLandmark(lm);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: visited
                        ? 'rgba(246, 193, 119, 0.22)'
                        : 'rgba(255, 255, 255, 0.07)',
                      color: visited ? '#fde68a' : '#fef3c7',
                      border: visited
                        ? '1px solid rgba(246, 193, 119, 0.45)'
                        : '1px solid rgba(255, 255, 255, 0.12)',
                    }}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pause Modal Card */}
      {isPaused && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
          style={{ backgroundColor: 'rgba(10, 15, 24, 0.72)' }}
        >
          <div
            className="w-full max-w-md p-6 rounded-xl shadow-2xl"
            style={{
              backgroundColor: 'rgba(18, 25, 38, 0.96)',
              border: '1px solid rgba(246, 193, 119, 0.42)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-modal-title"
          >
            <div className="text-xs font-mono uppercase tracking-widest text-amber-300/80 mb-1">
              Setouchi Island Walk · Paused
            </div>
            <h2
              id="pause-modal-title"
              className="text-2xl font-bold text-amber-50 mb-5"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Quiet Moment on the Trail
            </h2>

            {/* 3 Tabular Stat Tiles */}
            <div className="grid grid-cols-3 gap-2.5 mb-6">
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="text-[10px] font-mono uppercase text-amber-200/70">
                  Memories
                </div>
                <div
                  className="text-lg font-bold text-amber-50 font-mono"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {observedIds.length} / {allLandmarks.length}
                </div>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="text-[10px] font-mono uppercase text-amber-200/70">
                  Camera
                </div>
                <div className="text-sm font-semibold text-amber-50 mt-0.5">
                  {perspective === 'third' ? '3rd Person' : '1st Person'}
                </div>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="text-[10px] font-mono uppercase text-amber-200/70">
                  Sky Light
                </div>
                <div className="text-sm font-semibold text-amber-50 mt-0.5 truncate">
                  {timeOfDay === 'sunset'
                    ? 'Sunset'
                    : timeOfDay === 'twilight'
                    ? 'Twilight'
                    : 'Noon'}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-stone-950 cursor-pointer transition-transform active:scale-95"
                style={{ backgroundColor: '#f6c177' }}
              >
                Resume Walk
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-amber-100 hover:bg-white/10 cursor-pointer transition-colors"
                style={{ border: '1px solid rgba(246, 193, 119, 0.28)' }}
              >
                Reset to Harbor Pier
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-amber-200/80 hover:text-amber-50 cursor-pointer transition-colors"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
