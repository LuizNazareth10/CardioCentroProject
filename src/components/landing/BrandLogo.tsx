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
  const markSize = isHeader ? Math.max(size, 64) : size;

  return (
    <div className={`flex items-center ${isHeader ? 'gap-2 sm:gap-3.5' : 'gap-3'}`}>
      <div
        className={`relative flex-none overflow-hidden rounded-full shadow-soft ring-2 ring-white/80 ${
          isHeader ? 'h-12 w-12 sm:h-16 sm:w-16 lg:h-[68px] lg:w-[68px]' : ''
        }`}
        style={isHeader ? undefined : { width: markSize, height: markSize }}
      >
        <Image
          src={brandAssets.logo}
          alt="Cardiocentro"
          fill
          sizes={isHeader ? '(max-width: 639px) 48px, 68px' : `${markSize}px`}
          className="object-cover object-center scale-[1.55]"
          priority={isHeader}
        />
      </div>
      {variant === 'full' && (
        <div className="min-w-0 leading-tight">
          <div
            className={`whitespace-nowrap font-brand font-extrabold tracking-normal ${title} ${
              isHeader ? 'text-[1.55rem] leading-none sm:text-[2rem] xl:text-[2.25rem]' : 'text-[20px]'
            }`}
          >
            Cardio<span className="text-cardio">centro</span>
          </div>
          <div
            className={`whitespace-nowrap font-semibold uppercase tracking-normal ${sub} ${
              isHeader
                ? 'mt-1 text-[7px] sm:text-[10px] xl:text-[11px]'
                : 'text-[9px]'
            }`}
          >
            Métodos diagnósticos em cardiologia
          </div>
        </div>
      )}
    </div>
  );
}
