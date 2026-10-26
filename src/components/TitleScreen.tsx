import React from 'react';
import { TimeOfDay, LIGHTING_PRESETS } from '../game/islandLogic';

interface TitleScreenProps {
  onStart: () => void;
  timeOfDay: TimeOfDay;
  onCycleTime: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  timeOfDay,
  onCycleTime,
}) => {
  const preset = LIGHTING_PRESETS[timeOfDay];

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12 pointer-events-none select-none"
      style={{
        background:
          'linear-gradient(to bottom, rgba(12, 22, 38, 0.45) 0%, rgba(12, 22, 38, 0.05) 45%, rgba(12, 22, 38, 0.65) 100%)',
      }}
    >
      {/* Top Bar: Subtle Island Coordinates & Lighting Preview Button */}
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-3 text-amber-100/90 text-xs tracking-widest uppercase font-mono">
          <span>Setouchi Inland Sea · 34°14&apos;N 133°00&apos;E</span>
        </div>

        <button
          type="button"
          onClick={onStart ? onCycleTime : undefined}
          className="pointer-events-auto px-3.5 py-1.5 rounded-lg text-xs font-medium text-amber-50 transition-colors cursor-pointer"
          style={{
            backgroundColor: 'rgba(20, 28, 42, 0.78)',
            border: '1px solid rgba(255, 224, 178, 0.28)',
          }}
          aria-label={`Change Sky Atmosphere: ${preset.label}`}
        >
          Sky: {preset.label}
        </button>
      </div>

      {/* Center-Left Negative Space Title Emblem & Primary Start CTA */}
      <div className="my-auto w-full max-w-6xl mx-auto flex flex-col items-start">
        <div className="max-w-xl">
          {/* Bespoke Inline SVG Title Emblem Lockup (Vector Torii Hanko Seal, zero missing-font glyphs) */}
          <svg
            viewBox="0 0 640 165"
            className="w-full max-w-[520px] h-auto mb-5 drop-shadow-[0_4px_16px_rgba(0,0,0,0.65)]"
            role="img"
            aria-label="Shiosai: Setouchi Late Summer"
          >
            {/* Vermilion Hanko Stamp Seal with Vector Torii & Wave Crest */}
            <g transform="translate(8, 16)">
              <rect
                x="0"
                y="0"
                width="44"
                height="44"
                rx="6"
                fill="#c93528"
                stroke="#fde8d0"
                strokeWidth="1.5"
              />
              {/* Vector Torii silhouette inside stamp */}
              <path
                d="M8 14 C16 16, 28 16, 36 14 M11 19 H33 M15 15 V34 M29 15 V34 M9 35 Q16 32, 22 35 T35 35"
                stroke="#fff6ec"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* Romanized Japanese Subtitle Kicker */}
            <text
              x="66"
              y="36"
              fill="#ffdca8"
              fontSize="14"
              letterSpacing="5.5"
              fontFamily="'Plus Jakarta Sans', sans-serif"
              fontWeight="600"
            >
              SHIOSAI NO SHIMA · SETOUCHI LATE SUMMER
            </text>

            {/* Decorative Torii & Wave Horizon Rule */}
            <path
              d="M66 48 L460 48"
              stroke="#ffdca8"
              strokeWidth="1"
              strokeOpacity="0.55"
            />
            <circle cx="66" cy="48" r="2.5" fill="#ff9e58" />

            {/* Main Display Title */}
            <text
              x="6"
              y="112"
              fill="#fffaf0"
              fontSize="72"
              letterSpacing="5"
              fontFamily="'Cormorant Garamond', Georgia, serif"
              fontWeight="700"
            >
              SHIOSAI
            </text>

            {/* English Subtitle */}
            <text
              x="10"
              y="148"
              fill="#f3d5b5"
              fontSize="18"
              letterSpacing="5"
              fontFamily="'Plus Jakarta Sans', sans-serif"
              fontWeight="500"
            >
              SETOUCHI ISLAND WALKING SIMULATOR
            </text>
          </svg>

          <p
            className="text-amber-50/95 text-base md:text-lg leading-relaxed mb-7 max-w-md font-normal"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.85)' }}
          >
            Wander a quiet coastal path from the tetrapod harbor to the hilltop
            shrine as late-summer sunlight softens over the inland sea.
          </p>

          <div className="flex flex-wrap items-center gap-4 pointer-events-auto">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStart();
              }}
              className="px-7 py-3.5 rounded-lg text-base font-semibold text-stone-950 transition-transform active:scale-95 hover:brightness-105 cursor-pointer shadow-lg whitespace-nowrap shrink-0"
              style={{
                backgroundColor: '#f6c177',
                border: '1px solid #ffe6bf',
              }}
            >
              Begin Island Walk
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Safe Margin: Flat, Borderless Inline Control Hint */}
      <div className="w-full max-w-6xl mx-auto pt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-amber-100/90 font-mono">
        <span>
          WASD / Arrows Move · Mouse / Touch Look · V 1st/3rd Person · T Lighting Cycle · E Observe · Esc Pause
        </span>
        <span>Press Enter or Space to Begin</span>
      </div>
    </div>
  );
};
