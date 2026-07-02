import Image from 'next/image';

/** Logo oficial da Cardiocentro (imagem vetorizada/raster da marca). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="relative flex-none overflow-hidden rounded-xl" style={{ width: size, height: size }}>
      <Image
        src="/img/CardiocentroLogo.jpeg"
        alt="Cardiocentro"
        fill
        sizes={`${size}px`}
        className="object-cover"
      />
    </div>
  );
}

export function LogoLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={36} />
      <div className="leading-tight">
        <div className="font-serif text-[18px] font-bold tracking-tight text-navy-900">
          Cardio<span className="text-brand-red">centro</span>
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
          Métodos diagnósticos em cardiologia
        </div>
      </div>
    </div>
  );
}
