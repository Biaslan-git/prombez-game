import { HL_END, HL_START } from "@/lib/highlight";

/** Рендерит текст с маркерами ⟦…⟧ как <mark>, без dangerouslySetInnerHTML. */
export function Highlight({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length) {
    const s = rest.indexOf(HL_START);
    if (s < 0) {
      parts.push(rest);
      break;
    }
    const e = rest.indexOf(HL_END, s + 1);
    if (e < 0) {
      parts.push(rest.replaceAll(HL_START, ""));
      break;
    }
    if (s > 0) parts.push(rest.slice(0, s));
    parts.push(<mark key={key++}>{rest.slice(s + HL_START.length, e)}</mark>);
    rest = rest.slice(e + HL_END.length);
  }
  return <>{parts}</>;
}
