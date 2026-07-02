import Image from 'next/image';
import { brandAssets } from './content';

/**
 * Lockup oficial da marca para a landing.
 * `variant="full"` exibe logo + texto; `variant="mark"` só o ícone circular.
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
        className="relative flex-none overflow-hidden rounded-full shadow-soft ring-2 ring-white/80"
        style={{ width: markSize, height: markSize }}
      >
        <Image
          src={brandAssets.logo}
          alt="Cardiocentro"
          fill
          sizes={`${markSize}px`}
          className="object-cover object-center scale-[1.55]"
          priority={isHeader}
        />
      </div>
      {variant === 'full' && (
        <div className="min-w-0 leading-tight">
          <div
            className={`whitespace-nowrap font-brand font-extrabold tracking-tight ${title} ${
              isHeader ? 'text-[1.65rem] leading-none xl:text-[1.85rem]' : 'text-[20px]'
            }`}
          >
            Cardio<span className="text-cardio">centro</span>
          </div>
          <div
            className={`whitespace-nowrap font-semibold uppercase ${sub} ${
              isHeader
                ? 'mt-1 text-[9px] tracking-[0.14em] xl:text-[10px]'
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
