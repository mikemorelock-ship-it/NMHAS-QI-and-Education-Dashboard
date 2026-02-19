"use client";

// ---------------------------------------------------------------------------
// Animated Ambulance Loader — NMH-branded loading indicator.
//
// A cartoon ambulance with flashing red/blue light bar, used as the
// skeleton loader across all portals via Next.js loading.tsx files.
// ---------------------------------------------------------------------------

import { cn } from "@/lib/utils";

interface LoadingAmbulanceProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Custom message below the ambulance (default: "Loading...") */
  message?: string;
  /** Additional CSS classes on the outer wrapper */
  className?: string;
}

const SIZES = {
  sm: { width: 120, height: 72, text: "text-xs" },
  md: { width: 180, height: 108, text: "text-sm" },
  lg: { width: 240, height: 144, text: "text-base" },
} as const;

export function LoadingAmbulance({
  size = "md",
  message = "Loading...",
  className,
}: LoadingAmbulanceProps) {
  const { width, height, text } = SIZES[size];

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      {/* Ambulance wrapper with gentle bounce animation */}
      <div className="animate-ambulance-drive">
        <svg
          width={width}
          height={height}
          viewBox="0 0 240 144"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* === Light bar base === */}
          <rect x="80" y="12" width="60" height="10" rx="3" fill="#4b4f54" />

          {/* === Flashing lights === */}
          <circle cx="95" cy="17" r="5" className="animate-light-red" />
          <circle cx="125" cy="17" r="5" className="animate-light-blue" />

          {/* === Light bar glow effect === */}
          <circle cx="95" cy="17" r="8" className="animate-glow-red" />
          <circle cx="125" cy="17" r="8" className="animate-glow-blue" />

          {/* === Main body (box/patient compartment) === */}
          <rect x="60" y="24" width="120" height="70" rx="6" fill="#00b0ad" />

          {/* === Cab (front) === */}
          <path
            d="M180 44 h30 a8 8 0 0 1 8 8 v42 H180 V44z"
            fill="#00b0ad"
          />

          {/* === Windshield === */}
          <path
            d="M184 48 h24 a6 6 0 0 1 6 6 v22 H184 V48z"
            fill="#e8f4f4"
            stroke="#008a87"
            strokeWidth="1.5"
          />

          {/* === Windshield reflection === */}
          <path d="M188 52 h6 v16 h-6z" fill="white" opacity="0.3" rx="1" />

          {/* === Side window === */}
          <rect x="140" y="36" width="32" height="24" rx="4" fill="#e8f4f4" stroke="#008a87" strokeWidth="1.5" />

          {/* === Red cross === */}
          <rect x="90" y="44" width="8" height="24" rx="1.5" fill="white" />
          <rect x="82" y="52" width="24" height="8" rx="1.5" fill="white" />

          {/* === Star of Life accent (small) === */}
          <text x="94" y="82" fontSize="10" fill="white" fontWeight="bold" textAnchor="middle" opacity="0.6">
            ✦
          </text>

          {/* === Horizontal stripe === */}
          <rect x="60" y="72" width="158" height="6" fill="#008a87" />

          {/* === Rear door line === */}
          <line x1="60" y1="30" x2="60" y2="94" stroke="#008a87" strokeWidth="1.5" />

          {/* === Door handle === */}
          <rect x="64" y="56" width="6" height="3" rx="1" fill="#4b4f54" />

          {/* === Headlight === */}
          <rect x="214" y="72" width="6" height="10" rx="2" fill="#fcb526" />

          {/* === Bumper === */}
          <rect x="55" y="94" width="168" height="8" rx="3" fill="#4b4f54" />

          {/* === Rear wheel === */}
          <circle cx="96" cy="108" r="16" fill="#333" />
          <circle cx="96" cy="108" r="10" fill="#555" />
          <circle cx="96" cy="108" r="4" fill="#888" />

          {/* === Front wheel === */}
          <circle cx="192" cy="108" r="16" fill="#333" />
          <circle cx="192" cy="108" r="10" fill="#555" />
          <circle cx="192" cy="108" r="4" fill="#888" />

          {/* === Ground shadow === */}
          <ellipse cx="144" cy="130" rx="80" ry="6" fill="#4b4f54" opacity="0.10" />
        </svg>
      </div>

      {/* Message */}
      {message && (
        <p className={cn("text-muted-foreground font-medium animate-pulse", text)}>
          {message}
        </p>
      )}

      {/* Inline keyframe styles — keeps animations self-contained */}
      <style jsx>{`
        @keyframes ambulance-drive {
          0%, 100% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
        }
        @keyframes light-red {
          0%, 49% { fill: #ef4444; opacity: 1; }
          50%, 100% { fill: #ef4444; opacity: 0.15; }
        }
        @keyframes light-blue {
          0%, 49% { fill: #3b82f6; opacity: 0.15; }
          50%, 100% { fill: #3b82f6; opacity: 1; }
        }
        @keyframes glow-red {
          0%, 49% { fill: #ef4444; opacity: 0.25; }
          50%, 100% { fill: #ef4444; opacity: 0; }
        }
        @keyframes glow-blue {
          0%, 49% { fill: #3b82f6; opacity: 0; }
          50%, 100% { fill: #3b82f6; opacity: 0.25; }
        }
        .animate-ambulance-drive {
          animation: ambulance-drive 2s ease-in-out infinite;
        }
        .animate-light-red {
          animation: light-red 0.8s ease-in-out infinite;
        }
        .animate-light-blue {
          animation: light-blue 0.8s ease-in-out infinite;
        }
        .animate-glow-red {
          animation: glow-red 0.8s ease-in-out infinite;
        }
        .animate-glow-blue {
          animation: glow-blue 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
