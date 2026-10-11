import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-10 text-center">
      <h1 className="text-2xl font-bold">Страница не найдена</h1>
      <p className="mt-2 text-muted">Возможно, вопрос переехал. Попробуйте найти его по тексту.</p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href="/search" className="btn-primary">
          Поиск по вопросам
        </Link>
        <Link href="/" className="btn-secondary">
          На главную
        </Link>
      </div>
    </div>
  );
}
