// Top-down (bird's-eye) cab SVG.
// Scania R-focused silhouette sourced from the design handoff.
// Returned as a string so the caller can innerHTML-inject it.

export function cabSvgTop() {
  return `
    <svg class="cab-art cab-art--top" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220"
         preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="56" y="4" width="36" height="16" rx="5" fill="#161616"/>
      <rect x="59" y="6" width="30" height="12" rx="4" fill="#242424"/>
      <line x1="63" y1="4" x2="63" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="68" y1="4" x2="68" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="73" y1="4" x2="73" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="78" y1="4" x2="78" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="83" y1="4" x2="83" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <rect x="56" y="200" width="36" height="16" rx="5" fill="#161616"/>
      <rect x="59" y="202" width="30" height="12" rx="4" fill="#242424"/>
      <line x1="63" y1="200" x2="63" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="68" y1="200" x2="68" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="73" y1="200" x2="73" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="78" y1="200" x2="78" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="83" y1="200" x2="83" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <rect x="148" y="4" width="36" height="16" rx="5" fill="#161616"/>
      <rect x="151" y="6" width="30" height="12" rx="4" fill="#242424"/>
      <line x1="155" y1="4" x2="155" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="160" y1="4" x2="160" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="165" y1="4" x2="165" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="170" y1="4" x2="170" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="175" y1="4" x2="175" y2="20" stroke="#0d0d0d" stroke-width="0.7"/>
      <rect x="148" y="200" width="36" height="16" rx="5" fill="#161616"/>
      <rect x="151" y="202" width="30" height="12" rx="4" fill="#242424"/>
      <line x1="155" y1="200" x2="155" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="160" y1="200" x2="160" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="165" y1="200" x2="165" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="170" y1="200" x2="170" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="175" y1="200" x2="175" y2="216" stroke="#0d0d0d" stroke-width="0.7"/>
      <line x1="70" y1="22" x2="70" y2="8" stroke="#6f7982" stroke-linecap="round" stroke-width="4"/>
      <line x1="70" y1="8" x2="60" y2="8" stroke="#6f7982" stroke-linecap="round" stroke-width="3.5"/>
      <rect x="38" y="1" width="44" height="13" rx="4" fill="#e8ecf0"/>
      <rect x="40" y="3" width="40" height="9" rx="2.5" fill="#192e48"/>
      <rect x="49" y="14" width="20" height="8" rx="2.5" fill="#e8ecf0"/>
      <rect x="50.5" y="15.5" width="17" height="5" rx="1.5" fill="#192e48"/>
      <line x1="70" y1="198" x2="70" y2="212" stroke="#6f7982" stroke-linecap="round" stroke-width="4"/>
      <line x1="70" y1="212" x2="60" y2="212" stroke="#6f7982" stroke-linecap="round" stroke-width="3.5"/>
      <rect x="38" y="206" width="44" height="13" rx="4" fill="#e8ecf0"/>
      <rect x="40" y="208" width="40" height="9" rx="2.5" fill="#192e48"/>
      <rect x="49" y="198" width="20" height="8" rx="2.5" fill="#e8ecf0"/>
      <rect x="50.5" y="199.5" width="17" height="5" rx="1.5" fill="#192e48"/>
      <rect x="14" y="22" width="14" height="176" rx="2" fill="#e2e7ec"/>
      <rect x="28" y="22" width="5" height="176" fill="rgba(0,0,0,0.09)"/>
      <rect x="28" y="22" width="194" height="176" rx="3" fill="#EEF0F2"/>
      <line x1="28" y1="22" x2="222" y2="22" stroke="#cfd6dc" stroke-width="1.3"/>
      <line x1="28" y1="198" x2="222" y2="198" stroke="#bcc4cc" stroke-width="1.3"/>
      <rect x="30" y="24" width="60" height="172" rx="1" fill="#E6EBEF"/>
      <rect x="32" y="26" width="56" height="78" rx="1" fill="#192e48"/>
      <rect x="32" y="102" width="56" height="10" fill="#E6EBEF"/>
      <rect x="32" y="110" width="56" height="80" rx="1" fill="#192e48"/>
      <polygon points="35,28 50,28 35,42" fill="rgba(255,255,255,0.07)"/>
      <polygon points="35,112 50,112 35,126" fill="rgba(255,255,255,0.07)"/>
      <rect x="13" y="30" width="16" height="9" rx="2" fill="#FADC60"/>
      <rect x="14" y="31" width="13" height="7" rx="1.5" fill="#FFF3A0"/>
      <rect x="13" y="181" width="16" height="9" rx="2" fill="#FADC60"/>
      <rect x="14" y="182" width="13" height="7" rx="1.5" fill="#FFF3A0"/>
      <rect x="13" y="42" width="16" height="136" rx="1" fill="#d7dde3"/>
      <line x1="14" y1="50" x2="27" y2="50" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="58" x2="27" y2="58" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="66" x2="27" y2="66" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="74" x2="27" y2="74" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="82" x2="27" y2="82" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="90" x2="27" y2="90" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="98" x2="27" y2="98" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="106" x2="27" y2="106" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="114" x2="27" y2="114" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="122" x2="27" y2="122" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="130" x2="27" y2="130" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="138" x2="27" y2="138" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="146" x2="27" y2="146" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="154" x2="27" y2="154" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="162" x2="27" y2="162" stroke="#9ca7b1" stroke-width="1.4"/>
      <line x1="14" y1="170" x2="27" y2="170" stroke="#9ca7b1" stroke-width="1.4"/>
      <path d="M 90,22 L 90,36 L 108,22 Z" fill="#d2d9df"/>
      <path d="M 90,198 L 90,184 L 108,198 Z" fill="#d2d9df"/>
      <line x1="90" y1="22" x2="90" y2="198" stroke="#d2d9df" stroke-width="1"/>
      <line x1="128" y1="22" x2="128" y2="198" stroke="#d2d9df" stroke-width="1.5"/>
      <rect x="128" y="22" width="94" height="176" fill="rgba(0,0,0,0.02)"/>
      <rect x="92" y="22" width="102" height="7" rx="2" fill="#D5DCE3"/>
      <rect x="92" y="191" width="102" height="7" rx="2" fill="#D5DCE3"/>
      <rect x="144" y="30" width="28" height="14" rx="4" fill="#D5DCE3"/>
      <rect x="146" y="32" width="24" height="10" rx="3" fill="rgba(0,0,0,0.08)"/>
      <!-- Demo top-view branding -->
      <path d="M 98 150 C 126 140, 156 136, 214 130 L 214 140 C 156 146, 124 152, 98 164 Z" fill="#4A6FA5"/>
      <path d="M 98 160 C 126 151, 158 147, 214 141 L 214 147 C 158 153, 124 160, 98 170 Z" fill="#8A929A"/>
      <line x1="102" y1="167" x2="210" y2="144" stroke="#6B8CAE" stroke-width="1.1" opacity="0.9"/>
      <circle cx="114" cy="72" r="9" fill="#4A6FA5" stroke="#ffffff" stroke-width="2"/>
      <text x="114" y="75" fill="#ffffff" font-size="8" font-family="Segoe UI, sans-serif" text-anchor="middle" font-weight="700">D</text>
      <text x="164" y="82" fill="#121212" font-size="8.2" font-family="Segoe UI, sans-serif" text-anchor="middle" font-weight="700">DEMO</text>
      <circle cx="213" cy="34" r="5" fill="#141414" stroke="#0a0a0a" stroke-width="0.8"/>
      <circle cx="213" cy="34" r="3" fill="#060606"/>
      <circle cx="213" cy="186" r="5" fill="#141414" stroke="#0a0a0a" stroke-width="0.8"/>
      <circle cx="213" cy="186" r="3" fill="#060606"/>
      <rect x="195" y="72" width="30" height="76" rx="5" fill="#7a7a7a" stroke="#555" stroke-width="0.8"/>
      <circle cx="210" cy="110" r="22" fill="#6c6c6c" stroke="#505050" stroke-width="1.2"/>
      <circle cx="210" cy="110" r="14" fill="#5e5e5e"/>
      <circle cx="210" cy="110" r="7" fill="#474747"/>
      <circle cx="210" cy="110" r="3" fill="#2a2a2a"/>
      <rect x="209" y="72" width="3" height="20" rx="1" fill="#383838"/>
    </svg>
  `;
}
