export function JsonLd({ data }: { data: unknown }) {
  // Экранируем «<», чтобы текст вопросов не мог закрыть тег script.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
