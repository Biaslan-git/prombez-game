import type { Metadata } from "next";
import { FEEDBACK_EMAIL, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-bold">Политика конфиденциальности</h1>
      <p className="text-sm text-muted">Редакция от 11 октября 2026 года</p>

      <h2 className="text-xl font-semibold">1. Какие данные мы собираем</h2>
      <p>
        Сайт {SITE_URL} работает без регистрации и не запрашивает имя, телефон или адрес электронной почты. Ваш прогресс
        (ответы, результаты экзаменов, серия дней) хранится только в браузере на вашем устройстве (localStorage) и не
        передаётся на наш сервер.
      </p>

      <h2 className="text-xl font-semibold">2. Cookies и сервисы Яндекса</h2>
      <p>На сайте используются сервисы, которые могут сохранять cookies и собирать обезличенные технические данные:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b>Яндекс Метрика</b> — статистика посещений: страницы, время на сайте, тип устройства и браузера,
          приблизительный регион. Данные обрабатываются ООО «Яндекс» по его{" "}
          <a href="https://yandex.ru/legal/confidential/" className="underline" rel="noopener" target="_blank">
            политике конфиденциальности
          </a>
          .
        </li>
        <li>
          <b>Рекламная сеть Яндекса (РСЯ)</b> — показ рекламы. Яндекс может использовать cookies для подбора объявлений.
        </li>
      </ul>
      <p>
        Продолжая пользоваться сайтом, вы соглашаетесь на использование cookies. Отключить их можно в настройках
        браузера; тренажёр при этом продолжит работать.
      </p>

      <h2 className="text-xl font-semibold">3. Как удалить данные</h2>
      <p>
        Прогресс удаляется вместе с данными сайта в настройках браузера («Очистить данные сайта» / «Удалить cookies и
        данные сайтов»).
      </p>

      <h2 className="text-xl font-semibold">4. Контакты</h2>
      <p>
        Вопросы о данных:{" "}
        <a href={`mailto:${FEEDBACK_EMAIL}`} className="underline">
          {FEEDBACK_EMAIL}
        </a>
        .
      </p>
    </article>
  );
}
