// Reconstrução vetorial do coração da CardioCentro (vermelho + azul-marinho).
// Aproximação fiel ao logo original para uso na interface.
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="CardioCentro">
      <path
        d="M50 86C50 86 14 64 14 38C14 25 24 16 35 16C43 16 48 21 50 26C52 21 57 16 65 16C76 16 86 25 86 38C86 64 50 86 50 86Z"
        fill="url(#cc-grad)"
      />
      {/* recorte branco em "swoosh" característico */}
      <path
        d="M38 40C44 33 52 30 60 31C54 33 49 37 45 44C51 41 57 41 62 44C55 45 49 49 45 56C44 50 41 45 38 40Z"
        fill="#fff"
      />
      <defs>
        <linearGradient id="cc-grad" x1="14" y1="50" x2="86" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DC2F2A" />
          <stop offset="0.5" stopColor="#9A2A52" />
          <stop offset="1" stopColor="#16285A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LogoLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={36} />
      <div className="leading-tight">
        <div className="text-[17px] font-extrabold tracking-tight text-navy-900">
          Cardio<span className="text-brand-red">centro</span>
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
          Métodos diagnósticos em cardiologia
        </div>
      </div>
    </div>
  );
}
