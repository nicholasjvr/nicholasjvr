// Side-profile (Left / Right ortho) cab SVG.
// Conventional long-nose profile: nose left, wheels bottom, trailer attaches
// to the right edge. ViewBox is 52×108 — `cab-marker--side` sizes the
// container in pixels.

export function cabSvgSide() {
  return `
    <svg class="cab-art cab-art--side" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 108"
         preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id="cSB" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0"   stop-color="#f8f9fb" />
          <stop offset="0.45" stop-color="#eef0f2" />
          <stop offset="1"   stop-color="#d6dbe0" />
        </linearGradient>
        <linearGradient id="cSH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0"   stop-color="#eceff2" />
          <stop offset="1"   stop-color="#ccd3d9" />
        </linearGradient>
        <linearGradient id="cSW" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#a5b5bf" />
          <stop offset="1" stop-color="#3a4650" />
        </linearGradient>
      </defs>
      <!-- Hood / engine bay -->
      <path fill="url(#cSH)" stroke="#6d7882" stroke-width="1.1" stroke-linejoin="round"
            d="M 3 56 Q 3 49 7 47 L 18 44 L 18 84 L 4 84 L 3 78 Z" />
      <line x1="8" y1="46" x2="18" y2="46" stroke="#6d7882" stroke-width="0.45" opacity="0.55" />
      <!-- Cab + sleeper body -->
      <path fill="url(#cSB)" stroke="#7b8792" stroke-width="1.2" stroke-linejoin="round"
            d="M 18 14 L 46 14 L 46 84 L 18 84 Z" />
      <!-- Cowl/firewall -->
      <line x1="18" y1="44" x2="18" y2="84" stroke="#7b8792" stroke-width="1.2" />
      <!-- Raked windshield -->
      <path fill="url(#cSW)" stroke="#455a64" stroke-width="0.9" d="M 18 44 L 28 14 L 28 44 Z" />
      <!-- Cab roof cap -->
      <rect x="28" y="14" width="2" height="3" rx="0.5" fill="#7b8792" opacity="0.6" />
      <!-- A-pillar -->
      <line x1="28" y1="14" x2="28" y2="44" stroke="#263238" stroke-width="1.1" />
      <!-- Door window -->
      <rect x="30" y="18" width="12" height="26" rx="1" fill="url(#cSW)" stroke="#455a64" stroke-width="0.7" opacity="0.8" />
      <!-- B-pillar / sleeper break -->
      <line x1="42" y1="14" x2="42" y2="82" stroke="#59656f" stroke-width="0.7" stroke-opacity="0.5" />
      <!-- Sleeper window -->
      <rect x="43.5" y="22" width="2.5" height="18" rx="0.6" fill="url(#cSW)" stroke="#455a64" stroke-width="0.4" opacity="0.7" />
      <!-- Demo side swoosh -->
      <path fill="#4A6FA5" opacity="0.95" d="M 6 73 C 14 68, 27 64, 45 61 L 45 66 C 26 69, 14 74, 6 80 Z" />
      <path fill="#8A929A" opacity="0.95" d="M 6 77 C 14 73, 28 69, 45 66 L 45 69 C 26 72, 14 77, 6 83 Z" />
      <line x1="7" y1="81" x2="42" y2="70" stroke="#6B8CAE" stroke-width="0.8" opacity="0.85"/>
      <!-- Door badge -->
      <circle cx="34.5" cy="50" r="3.2" fill="#4A6FA5" stroke="#ffffff" stroke-width="0.9"/>
      <text x="34.5" y="51.5" fill="#ffffff" font-size="2.7" font-family="Segoe UI, sans-serif" text-anchor="middle" font-weight="700">D</text>
      <!-- Fleet branding text -->
      <text x="27" y="78.5" fill="#111111" font-size="2.9" font-family="Segoe UI, sans-serif" text-anchor="middle" font-weight="700">DEMO</text>
      <!-- Grille on hood nose -->
      <rect x="2.5" y="58" width="3" height="18" rx="0.7" fill="#37474f" stroke="#263238" stroke-width="0.45" />
      <line x1="2.5" y1="62" x2="5.5" y2="62" stroke="#263238" stroke-width="0.55" />
      <line x1="2.5" y1="66" x2="5.5" y2="66" stroke="#263238" stroke-width="0.55" />
      <line x1="2.5" y1="70" x2="5.5" y2="70" stroke="#263238" stroke-width="0.55" />
      <!-- Headlight on hood nose -->
      <rect x="2.5" y="50" width="3.5" height="6" rx="1" fill="#ffe57f" stroke="#b8860b" stroke-width="0.4" />
      <!-- Front bumper -->
      <rect x="1.5" y="78" width="5" height="6" rx="1.3" fill="#37474f" stroke="#263238" stroke-width="0.55" />
      <!-- Running board / step -->
      <rect x="18" y="83" width="14" height="5" rx="1.5" fill="#2b3238" stroke="#1a1f24" stroke-width="0.5" />
      <!-- Front (steer) wheel -->
      <circle cx="9" cy="99" r="8.5" fill="#212121" stroke="#0d1215" stroke-width="0.85" />
      <circle cx="9" cy="99" r="3.2" fill="#455a64" opacity="0.35" />
      <!-- Rear (drive) wheel -->
      <circle cx="38" cy="99" r="8.5" fill="#212121" stroke="#0d1215" stroke-width="0.85" />
      <circle cx="38" cy="99" r="3.2" fill="#455a64" opacity="0.35" />
      <!-- Windshield glare -->
      <line x1="20" y1="40" x2="27" y2="18" stroke="#cfd8dc" stroke-width="0.9" stroke-opacity="0.4" />
    </svg>
  `;
}
