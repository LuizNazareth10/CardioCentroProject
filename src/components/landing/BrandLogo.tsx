import Image from 'next/image';
import { brandAssets } from './content';

/**
 * Lockup oficial da marca para a landing.
 * `variant="full"` exibe logo + texto; `variant="mark"` só o ícone.
 * `emphasis="header"` aumenta tipografia para o cabeçalho fixo.
 */
export function BrandLogo({
  tone = 'light',
  size = 44,
  variant = 'full',
  emphasis = 'default',
}: {
  tone?: 'light' | 'dark';
  size?: number;
  variant?: 'full' | 'mark';
  emphasis?: 'default' | 'header';
}) {
  const title = tone === 'dark' ? 'text-white' : 'text-navyblue-900';
  const sub = tone === 'dark' ? 'text-white/65' : 'text-gray-500';
  const isHeader = emphasis === 'header';
  const markSize = isHeader ? Math.max(size, 52) : size;

  return (
    <div className={`flex items-center ${isHeader ? 'gap-3.5' : 'gap-3'}`}>
      <div
        className={`relative flex-none overflow-hidden shadow-soft ring-1 ring-black/5 ${
          isHeader ? 'rounded-2xl' : 'rounded-2xl'
        }`}
        style={{ width: markSize, height: markSize }}
      >
        <Image
          src={brandAssets.logo}
          alt="Cardiocentro"
          fill
          sizes={`${markSize}px`}
          className="object-cover"
          priority={isHeader}
        />
      </div>
      {variant === 'full' && (
        <div className="min-w-0 leading-tight">
          <div
            className={`whitespace-nowrap font-serif font-bold tracking-tight ${title} ${
              isHeader ? 'text-[1.55rem] leading-none xl:text-[1.7rem]' : 'text-[19px]'
            }`}
          >
            Cardio<span className="text-cardio">centro</span>
          </div>
          <div
            className={`whitespace-nowrap font-semibold uppercase ${sub} ${
              isHeader
                ? 'mt-1 text-[10px] tracking-[0.12em] xl:text-[11px]'
                : 'text-[9px] tracking-[0.16em]'
            }`}
          >
            Métodos diagnósticos em cardiologia
          </div>
        </div>
      )}
    </div>
  );
}
