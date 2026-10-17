/**
 * Тематические подборки вопросов. Темы определяются по ключевым словам в тексте вопроса,
 * поэтому не требуют ни миграций, ни ручной разметки банка: подборка появляется сама, когда в ней набирается
 * достаточно вопросов (иначе страница была бы «тонкой»).
 */
export type Topic = {
  slug: string;
  title: string;
  /** Короткая фраза для вводного абзаца: «…про {about}». */
  about: string;
  pattern: RegExp;
};

// \w в JS не знает кириллицу, поэтому окончания слов — через [а-яё]*.
export const TOPICS: readonly Topic[] = [
  {
    slug: "deklaratsiya",
    title: "Декларация промышленной безопасности",
    about: "декларацию промышленной безопасности",
    pattern: /деклараци/i,
  },
  {
    slug: "proizvodstvennyy-kontrol",
    title: "Производственный контроль",
    about: "производственный контроль",
    pattern: /производственн[а-яё]*\s+контрол/i,
  },
  {
    slug: "klassy-opasnosti",
    title: "Классы опасности ОПО",
    about: "классы опасности опасных производственных объектов",
    pattern: /класс[а-яё]*\s+опасност/i,
  },
  {
    slug: "avarii",
    title: "Аварии, инциденты и их расследование",
    about: "аварии, инциденты и их расследование",
    pattern: /авари|инцидент|расследован/i,
  },
  {
    slug: "ekspertiza",
    title: "Экспертиза промышленной безопасности",
    about: "экспертизу промышленной безопасности",
    pattern: /экспертиз/i,
  },
  { slug: "litsenzirovanie", title: "Лицензирование", about: "лицензирование видов деятельности", pattern: /лицензи/i },
  {
    slug: "strakhovanie",
    title: "Страхование ответственности",
    about: "страхование ответственности владельцев опасных объектов",
    pattern: /страхов/i,
  },
  {
    slug: "reestr-opo",
    title: "Реестр и регистрация ОПО",
    about: "реестр и регистрацию опасных производственных объектов",
    pattern: /реестр|регистрац/i,
  },
  {
    slug: "stroitelstvo",
    title: "Проектирование и строительство",
    about: "проектирование, строительство и реконструкцию",
    pattern: /строител|проектн|реконструкц/i,
  },
  {
    slug: "tekhnicheskie-ustroystva",
    title: "Технические устройства и оборудование",
    about: "технические устройства, оборудование и технические регламенты",
    pattern: /технически[а-яё]*\s+устройств|оборудован|регламент/i,
  },
  {
    slug: "normativnye-akty",
    title: "Законы и нормативные акты",
    about: "федеральные законы и нормативные правовые акты",
    pattern: /федеральн[а-яё]*\s+закон|постановлени|приказ/i,
  },
];

/** Подборка показывается и попадает в sitemap, только если в ней достаточно вопросов. */
export const MIN_TOPIC_QUESTIONS = 8;

export function topicsFor(text: string): Topic[] {
  return TOPICS.filter((t) => t.pattern.test(text));
}

export function getTopic(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

export type TopicSummary = { slug: string; title: string; count: number };

/** Сколько вопросов в каждой теме; темы меньше порога отбрасываются. Порядок как в TOPICS. */
export function summarizeTopics(items: { text: string }[]): TopicSummary[] {
  return TOPICS.map((t) => ({
    slug: t.slug,
    title: t.title,
    count: items.filter((q) => t.pattern.test(q.text)).length,
  })).filter((t) => t.count >= MIN_TOPIC_QUESTIONS);
}
