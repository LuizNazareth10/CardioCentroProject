import { Logo } from '@/components/Logo';

/**
 * Lockup da marca para a landing. `tone="dark"` = texto branco (fundos escuros);
 * `tone="light"` = texto navy (fundos claros).
 */
export function BrandLogo({
  tone = 'light',
  size = 40,
}: {
  tone?: 'light' | 'dark';
  size?: number;
}) {
  const title = tone === 'dark' ? 'text-white' : 'text-navyblue-800';
  const sub = tone === 'dark' ? 'text-white/60' : 'text-gray-500';
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          tone === 'dark'
            ? 'grid place-items-center rounded-2xl bg-white/95 p-1.5 shadow-soft'
            : ''
        }
      >
        <Logo size={size} />
      </div>
      <div className="leading-tight">
        <div className={`font-serif text-[19px] font-bold tracking-tight ${title}`}>
          Cardio<span className="text-cardio">centro</span>
        </div>
        <div className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${sub}`}>
          Métodos diagnósticos em cardiologia
        </div>
      </div>
    </div>
  );
}
