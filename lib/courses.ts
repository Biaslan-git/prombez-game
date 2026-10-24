/**
 * Сферы (направления подготовки): на главной области сгруппированы по ним, у каждой есть своя страница /kurs/{slug}.
 * Область ссылается на сферу полем areas.course_slug; порядок сфер — здесь, порядок областей внутри — sort_order.
 */
export type Course = {
  slug: string;
  title: string;
  /** Для карточки на главной и meta description страницы сферы. */
  description: string;
};

export const COURSES: readonly Course[] = [
  {
    slug: "prombez",
    title: "Промышленная безопасность",
    description: "Области аттестации А.1 и Б.1–Б.12: общие требования и специальные по отраслям и видам объектов.",
  },
  {
    slug: "energo",
    title: "Энергетическая безопасность",
    description: "Области Г.1 и Г.2 и тепловые энергоустановки.",
  },
  {
    slug: "elektro",
    title: "Электробезопасность",
    description: "II–V группы до и выше 1000 В: потребители, электросетевые организации, электростанции, спецработы.",
  },
  {
    slug: "gts",
    title: "Безопасность гидротехнических сооружений",
    description: "Области В.1–В.5: ГТС промышленности, энергетики, водохозяйственного комплекса, судоходные.",
  },
  {
    slug: "okhrana-truda",
    title: "Охрана труда",
    description: "ЕИСОТ, программы А, Б и В, первая помощь, СИЗ, работы на высоте и в ограниченных пространствах.",
  },
  {
    slug: "pozharnaya",
    title: "Пожарная безопасность",
    description: "Противопожарные инструктажи и программы ДПО.",
  },
  {
    slug: "ekologiya",
    title: "Экологическая безопасность",
    description: "Экологическая безопасность в организации, обращение с отходами, дезинфекционное дело.",
  },
  {
    slug: "radiatsionnaya",
    title: "Радиационная безопасность",
    description: "Работа с источниками ионизирующего излучения, радиационный контроль, учёт радиоактивных веществ.",
  },
  {
    slug: "gochs",
    title: "ГО и ЧС",
    description: "Гражданская оборона и защита от чрезвычайных ситуаций.",
  },
  {
    slug: "antiterror",
    title: "Антитеррористическая безопасность",
    description: "Антитеррористическая защищённость объектов, противодействие терроризму и экстремизму.",
  },
  {
    slug: "bdd",
    title: "Безопасность дорожного движения",
    description: "Обеспечение БДД, эксплуатация автомобильного транспорта, проверка знаний водителей.",
  },
  {
    slug: "informatsionnaya",
    title: "Информационная безопасность",
    description: "Базовая информационная безопасность, защита информации и персональных данных в организации.",
  },
  {
    slug: "sout",
    title: "Эксперты по СОУТ",
    description: "Аттестация экспертов на право проведения специальной оценки условий труда.",
  },
  {
    slug: "rabochie",
    title: "Рабочие профессии",
    description: "Тесты для сварщиков, крановщиков, стропальщиков, операторов котельных, АЗС и других профессий.",
  },
];

const BY_SLUG = new Map(COURSES.map((c) => [c.slug, c]));

/** Сфера области; области без сферы (загруженные до их появления) относятся к промбезопасности. */
export function courseOf(courseSlug: string): Course {
  return BY_SLUG.get(courseSlug || "prombez") ?? { slug: courseSlug, title: courseSlug, description: "" };
}

export function getCourse(slug: string): Course | null {
  return BY_SLUG.get(slug) ?? null;
}

export function courseOrder(courseSlug: string): number {
  const i = COURSES.findIndex((c) => c.slug === (courseSlug || "prombez"));
  return i < 0 ? COURSES.length : i;
}

/** Области подряд по разделам (порядок — как пришли): [{ section, items }]. Области без раздела идут группой с null. */
export function groupBySection<A extends { sectionTitle: string | null }>(
  items: readonly A[],
): { section: string | null; items: A[] }[] {
  const out: { section: string | null; items: A[] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.section === it.sectionTitle) last.items.push(it);
    else out.push({ section: it.sectionTitle, items: [it] });
  }
  return out;
}
