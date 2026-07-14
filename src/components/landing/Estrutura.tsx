'use client';

import Image from 'next/image';
import { Reveal } from './Reveal';
import { structurePhotos } from './content';

const tiles = [
  { ...structurePhotos.patio, span: 'lg:col-span-2 lg:row-span-2', aspect: 'aspect-[16/10] lg:aspect-auto' },
  { ...structurePhotos.fachada, span: 'lg:col-span-1 lg:row-span-1', aspect: 'aspect-square' },
  { ...structurePhotos.ecocardiograma, span: 'lg:col-span-1 lg:row-span-1', aspect: 'aspect-square' },
  { ...structurePhotos.ergometrico, span: 'lg:col-span-1 lg:row-span-1', aspect: 'aspect-square' },
  { ...structurePhotos.salaExame, span: 'lg:col-span-1 lg:row-span-1', aspect: 'aspect-square' },
];

export function Estrutura() {
  return (
    <section id="estrutura" className="scroll-mt-24 bg-canvas py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Nossa estrutura
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:grid-rows-2 lg:gap-4">
            {tiles.map((tile, i) => (
              <div
                key={tile.label}
                className={`group relative overflow-hidden rounded-[1.5rem] shadow-card ring-1 ring-navyblue-100/80 ${tile.span} ${tile.aspect} ${
                  i === 0 ? 'col-span-2' : ''
                }`}
              >
                <Image
                  src={tile.src}
                  alt={tile.alt}
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.06]"
                />
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
