// Детерминированный ГПСЧ (mulberry32) и перемешивание — без зависимостей, чтобы модуль работал и в Node (тесты).
export function seededRng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Варианты вроде «Все перечисленное» ссылаются на остальные и должны идти последними.
const PINNED_LAST =
  /^(вс(е|еми|ей|ех)|ни один|ничего|никакие)\s+(из\s+)?(перечисленн|вышеперечисленн|указанн|приведенн)/i;

export function shuffleAnswers(answers, rng = Math.random) {
  const pinned = answers.filter((a) => PINNED_LAST.test(a.text.trim()));
  const free = answers.filter((a) => !PINNED_LAST.test(a.text.trim()));
  return [...shuffle(free, rng), ...pinned];
}
