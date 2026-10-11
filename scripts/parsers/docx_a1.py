#!/usr/bin/env python3
"""Парсер DOCX-сборника вопросов с вариантами ответов -> JSON для scripts/import-questions.ts.

Формат источника: вопрос «N. текст» (жирным), варианты «А) …» (правильные — жирным),
затем строка со ссылкой на норму. Использование:
    python3 -I scripts/parsers/docx_a1.py in.docx out.json
"""
import json
import re
import sys
import zipfile

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def paragraphs(path):
    import xml.etree.ElementTree as ET

    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    for p in root.iter(W + "p"):
        runs = []
        for r in p.iter(W + "r"):
            t = "".join(x.text or "" for x in r.iter(W + "t"))
            if not t:
                continue
            rpr = r.find(W + "rPr")
            bold = False
            hl = None
            if rpr is not None:
                b = rpr.find(W + "b")
                bold = b is not None and b.get(W + "val") not in ("0", "false")
                h = rpr.find(W + "highlight")
                hl = h.get(W + "val") if h is not None else None
            runs.append((t, bold, hl))
        text = "".join(t for t, _, _ in runs).replace("\xa0", " ")
        yield text.strip(), runs


Q_RE = re.compile(r"^(\d+)\.\s*(.+)$", re.S)
O_RE = re.compile(r"^([А-ЯA-Z])\)\s*(.+)$", re.S)


NOTE_RE = re.compile(r"^(Исправлено[^(]*\([^)]*\))\s*(\d+\..*)$", re.S)
JUNK_RE = re.compile(r"блог-инженера|инженера\.рф|Локализация:", re.I)


def parse(path):
    """Возвращает (вопросы, предупреждения). Новый вопрос — абзац «N. …», где N = предыдущий номер + 1."""
    questions, cur, warnings = [], None, []
    for text, runs in paragraphs(path):
        if not text or JUNK_RE.search(text):
            continue
        note = None
        m = NOTE_RE.match(text)
        if m:  # пометка автора сборника, приклеенная к началу вопроса
            note, text = m.group(1).strip(), m.group(2)
            runs = []
        expected = (cur["number"] if cur else 0) + 1
        q = Q_RE.match(text)
        o = O_RE.match(text)
        if q and int(q.group(1)) == expected:
            cur = {"number": expected, "text": q.group(2).strip(), "answers": [], "norm_ref": None}
            if note:
                cur["source_note"] = note
            questions.append(cur)
        elif o and cur is not None:
            letter = o.group(1)
            # Вариант правильный, если жирным набрано его содержимое (не только «Б)»).
            body_bold = "".join(t for t, b, _ in runs if b and t.strip() not in (f"{letter})", "")).strip()
            cur["answers"].append({"text": o.group(2).strip(), "is_correct": bool(body_bold)})
        elif cur is not None and cur["answers"] and cur["norm_ref"] is None:
            cur["norm_ref"] = text
        elif cur is not None:
            warnings.append(f"вопрос {cur['number']}: непонятная строка: {text[:70]!r}")
    return questions, warnings


# Исправления формулировок, где сборник сократил официальный текст вопроса (сверено с официальным перечнем).
TEXT_OVERRIDES = {
    6: "На какие организации распространяются положения Федерального закона от 21.07.1997 № 116-ФЗ "
    "«О промышленной безопасности опасных производственных объектов»? Выберите правильный вариант ответа.",
}

SINGLE_SUFFIX = re.compile(r"\s*Выберите правильный вариант ответа\.?\s*$")


def to_import(questions):
    out = []
    for q in questions:
        text = TEXT_OVERRIDES.get(q["number"], q["text"])
        # «Выберите 2 варианта ответа» оставляем (подсказка для многоответных), общий хвост убираем.
        text = SINGLE_SUFFIX.sub("", text).strip()
        out.append({"number": q["number"], "text": text, "answers": q["answers"], "norm_ref": q["norm_ref"]})
    return out


if __name__ == "__main__":
    # python3 -I docx_a1.py in.docx out.json
    qs, warns = parse(sys.argv[1])
    area = {
        "code": "А.1",
        "title": "Основы промышленной безопасности",
        "short_description": "Тренажёр по области А.1: вопросы официального банка Ростехнадзора "
        "(распоряжение № 47-рп от 24.06.2024) с вариантами ответов.",
        "bank_version": "47-рп от 24.06.2024",
        "bank_updated_at": "2024-09-01",
        # Параметры экзамена нужно сверить с регламентом ЕПТ.
        "exam": {"questions_count": 20, "time_limit_min": 20, "pass_threshold": 18},
        "sort_order": 1,
    }
    json.dump({"area": area, "questions": to_import(qs)}, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"вопросов: {len(qs)}, предупреждений: {len(warns)}")
    for q in qs:
        if "source_note" in q:
            print(f"  пометка источника у вопроса {q['number']}: {q['source_note']}")
    for w in warns[:20]:
        print(" ", w)
