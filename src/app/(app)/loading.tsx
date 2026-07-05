// Skeleton exibido enquanto as páginas da área restrita carregam dados.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Carregando" role="status">
      <div className="h-9 w-56 rounded-xl bg-navy-100/60" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-24 border-none bg-navy-100/40" />
        ))}
      </div>
      <div className="card h-72 border-none bg-navy-100/40" />
    </div>
  );
}
