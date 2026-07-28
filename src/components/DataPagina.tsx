import { fmtDataExtenso, hojeJF } from '@/lib/format';

/** Data do dia em destaque sob o título das páginas da área restrita. */
export function DataPagina({ data }: { data?: string }) {
  return (
    <p className="mt-0.5 text-lg font-medium capitalize tracking-tight text-navy-700">
      {fmtDataExtenso(data ?? hojeJF())}
    </p>
  );
}
