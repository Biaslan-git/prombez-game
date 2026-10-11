/** Поисковая форма без JS: GET /search?q=… */
export function SearchForm({
  placeholder = "Поиск по вопросам",
  defaultValue,
}: {
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <form action="/search" method="get" role="search" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-12 w-full min-w-0 rounded-xl border-2 border-line bg-surface px-4 outline-none focus:border-brand"
      />
      <button type="submit" className="btn-secondary shrink-0 px-4">
        Найти
      </button>
    </form>
  );
}
