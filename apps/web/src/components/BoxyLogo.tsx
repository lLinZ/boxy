/** Logo de Boxy: una cajita que guiña el ojo derecho. Mismo dibujo que public/favicon.svg. */
export function BoxyLogo({ className = 'h-9 w-9', titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      <path d="M7 19 L31 19 L25 6.5 L3.5 10.5 Z" fill="#9BEA86" />
      <path d="M33 19 L57 19 L60.5 10.5 L39 6.5 Z" fill="#9BEA86" />
      <rect x="5" y="16" width="54" height="10" rx="3.5" fill="#4FB838" />
      <rect x="8" y="23" width="48" height="36" rx="7" fill="#72DB5A" />
      <rect x="8" y="23" width="48" height="5" fill="#4FB838" opacity=".55" />
      <circle cx="23.5" cy="39" r="3.6" fill="#0C1A08" />
      <path d="M36.5 40 Q41 34.5 45.5 40" fill="none" stroke="#0C1A08" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M23 47 Q32 55 41 46.5" fill="none" stroke="#0C1A08" strokeWidth="3.4" strokeLinecap="round" />
      <ellipse cx="48.5" cy="45" rx="3.2" ry="2.1" fill="#FF8FB1" opacity=".75" />
    </svg>
  )
}
