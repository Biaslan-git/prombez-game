#!/usr/bin/env python3
"""Универсальный разбор DOCX-сборников «вопрос + варианты + правильный ответ» в JSON для импорта.

Поддерживаются форматы, где варианты ответа перечислены, а верные выделены форматированием (жирный, маркер или цвет):
  - «N. вопрос» / «А) вариант» / «А. вариант» / «1. вариант», затем строка со ссылкой на норму;
  - вопросы без номеров (нумеруются по порядку).
Не поддерживаются (область помечается unsupported и не импортируется): файлы только с «Ответ: …» без вариантов,
таблицы. Каждая область проходит строгую проверку; импортировать можно только области со статусом ok.

Использование:
    python3 -I scripts/parsers/docx_bank.py <файл.docx> <код области, напр. Б.1.1> <вывод.json> [--title ...] [--sort N]
Функции parse_docx(path) -> (questions, report) используются сборщиком банка (build_all).
"""
import collections
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
LETTERS = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ"  # без Ё, Й, Ъ, Ы, Ь — не используются как буквы вариантов
NOTE_RE = re.compile(r"^(Исправлено[^(]*\([^)]*\))\s*(\d+\..*)$", re.S)
JUNK_RE = re.compile(r"блог-инженера|инженера\.рф|Локализация:|bi-file|Блог—Инженера", re.I)
SINGLE_SUFFIX = re.compile(r"\s*Выберите правильный вариант ответа\.?\s*$")
Q_RE = re.compile(r"^(\d+)\s*[.)]\s*(.+)$", re.S)
OPT_LETTER_RE = re.compile(r"^([А-ЯA-Z])\s*[.)]\s*(.+)$", re.S)
OPT_DIGIT_RE = re.compile(r"^(\d+)\s*[.)]\s*(.+)$", re.S)


def read_paragraphs(path):
    """Абзацы документа с признаками форматирования по фрагментам: (текст, [(текст, bold, hl, color)])."""
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    tables = len(list(root.iter(W + "tbl")))
    out = []
    for p in root.iter(W + "p"):
        runs = []
        for r in p.iter(W + "r"):
            t = "".join(x.text or "" for x in r.iter(W + "t"))
            if not t:
                continue
            bold = hl = color = False
            rpr = r.find(W + "rPr")
            if rpr is not None:
                b = rpr.find(W + "b")
                bold = b is not None and b.get(W + "val") not in ("0", "false")
                hl = rpr.find(W + "highlight") is not None
                c = rpr.find(W + "color")
                color = c is not None and c.get(W + "val") not in (None, "000000", "auto")
            runs.append((t, bold, hl, color))
        text = "".join(t for t, *_ in runs).replace("\xa0", " ").strip()
        if text:
            out.append((text, runs))
    return out, tables


def marked(runs, prefix_len, feature):
    """Выделено ли форматированием содержимое варианта (без буквы/номера в начале)."""
    idx = {"bold": 1, "hl": 2, "color": 3}[feature]
    seen = 0
    body = ""
    for r in runs:
        t = r[0]
        take = t[max(0, prefix_len - seen):] if seen < prefix_len else t
        seen += len(t)
        if take.strip() and r[idx]:
            body += take
    return bool(body.strip())


def detect_feature(paras):
    """Чем отмечены верные ответы: признак, который выделяет заметную, но не всю часть вариантов."""
    stats = {f: [0, 0] for f in ("bold", "hl", "color")}
    letter = 0
    for text, runs in paras:
        m = OPT_LETTER_RE.match(text)
        if not m or m.group(1) not in LETTERS:
            continue
        letter += 1
        for f in stats:
            stats[f][1] += 1
            if marked(runs, len(text) - len(m.group(2)), f):
                stats[f][0] += 1
    best, best_score = None, 0
    for f, (k, n) in stats.items():
        if n and 0.12 <= k / n <= 0.6 and k > best_score:
            best, best_score = f, k
    return best


def parse_docx(path):
    paras, tables = read_paragraphs(path)
    report = {"status": "ok", "reasons": [], "notes": []}
    letter_opts = sum(1 for t, _ in paras if (m := OPT_LETTER_RE.match(t)) and m.group(1) == "А")
    digit_style = False
    numbered_q = sum(1 for t, _ in paras if re.match(r"^\d+\s*[.)]\s", t))
    if tables and numbered_q < 10:
        report.update(status="unsupported")
        report["reasons"].append("варианты в таблице")
        return [], report
    if sum(1 for t, _ in paras if re.match(r"^\s*Ответ\s*:", t)) > 10 and letter_opts < 5:
        report.update(status="unsupported")
        report["reasons"].append("только «Ответ:» без вариантов")
        return [], report

    feature = detect_feature(paras)
    # Формат с цифровыми вариантами: «1. вопрос» затем «1. вариант», «2. вариант»…
    digit_style = letter_opts < 5
    if digit_style:
        feature = feature or None
    if feature is None:
        # Для цифровых вариантов признак определяем по строкам «k. текст», идущим подряд с 1.
        stats = {f: [0, 0] for f in ("bold", "hl", "color")}
        for t, runs in paras:
            m = OPT_DIGIT_RE.match(t)
            if m and int(m.group(1)) <= 9:
                for f in stats:
                    stats[f][1] += 1
                    if marked(runs, len(t) - len(m.group(2)), f):
                        stats[f][0] += 1
        for f, (k, n) in stats.items():
            if n and 0.1 <= k / n <= 0.5:
                feature = f
                break
    if feature is None:
        report.update(status="unsupported")
        report["reasons"].append("не удалось определить, чем отмечены верные ответы")
        return [], report

    questions, cur = [], None
    after_norm = True  # перед первым вопросом ждём вопрос
    extras = 0
    unnumbered = numbered_q < 5
    for text, runs in paras:
        if JUNK_RE.search(text):
            continue
        note = None
        m = NOTE_RE.match(text)
        if m:
            note, text = m.group(1).strip(), m.group(2)
            runs = []
        expected = (cur["number"] if cur else 0) + 1
        opt = None
        if cur is not None and not after_norm:
            if digit_style:
                m = OPT_DIGIT_RE.match(text)
                if m and int(m.group(1)) == len(cur["answers"]) + 1:
                    opt = m
            else:
                m = OPT_LETTER_RE.match(text)
                if m and LETTERS.find(m.group(1)) == len(cur["answers"]):
                    opt = m
        if opt is not None:
            body = opt.group(2).strip()
            cur["answers"].append({"text": body, "is_correct": marked(runs, len(text) - len(opt.group(2)), feature)})
            continue
        q = Q_RE.match(text)
        is_new_q = False
        if not unnumbered:
            if q and int(q.group(1)) == expected and (after_norm or len(cur["answers"]) >= 2):
                is_new_q = True
        else:
            # без номеров: вопрос — абзац, идущий после ссылки на норму/начала, не являющийся вариантом
            is_new_q = (after_norm or (cur and len(cur["answers"]) >= 2 and cur["norm_ref"] is not None)) and not OPT_LETTER_RE.match(text)
            if cur is not None and cur["answers"] == [] and not after_norm:
                is_new_q = False
        if is_new_q:
            if cur is not None and not cur["answers"] and not unnumbered:
                pass
            qtext = q.group(2) if (q and not unnumbered) else text
            cur = {"number": expected, "text": qtext.strip(), "answers": [], "norm_ref": None}
            if note:
                cur["source_note"] = note
            questions.append(cur)
            after_norm = False
            continue
        if cur is not None and cur["answers"] and cur["norm_ref"] is None:
            cur["norm_ref"] = text
            after_norm = True
        elif cur is not None and cur["answers"] and after_norm:
            extras += 1
        elif cur is not None and not cur["answers"]:
            # продолжение текста вопроса в следующем абзаце
            cur["text"] += " " + text
        elif cur is None:
            report["notes"].append(f"заголовок: {text[:60]}")
    # строгая проверка
    problems = []
    for q in questions:
        k = sum(a["is_correct"] for a in q["answers"])
        mm = re.search(r"Выберите (\d+) вариант", q["text"])
        exp = int(mm.group(1)) if mm else 1
        if not 2 <= len(q["answers"]) <= 9:
            problems.append(f"№{q['number']}: вариантов {len(q['answers'])}")
        elif k == 0:
            problems.append(f"№{q['number']}: нет верного")
        elif k != exp:
            problems.append(f"№{q['number']}: верных {k}, ждали {exp}")
        elif k == len(q["answers"]):
            problems.append(f"№{q['number']}: верны все варианты")
    if not questions:
        report.update(status="unsupported")
        report["reasons"].append("вопросы не найдены")
    elif problems:
        report.update(status="review")
        report["reasons"] = problems[:6] + ([f"… всего {len(problems)}"] if len(problems) > 6 else [])
    if questions and extras > len(questions) * 0.1:
        report["status"] = "review"
        report["reasons"].append(f"много лишних строк: {extras}")
    report.update(feature=feature, style="цифры" if digit_style else ("буквы" if letter_opts >= 5 else "?"), questions=len(questions), problems=len(problems))
    return questions, report


# Исправления формулировок вопросов, где сборник сократил официальный текст.
TEXT_OVERRIDES = {("А.1", 6): "На какие организации распространяются положения Федерального закона от 21.07.1997 № 116-ФЗ "
                  "«О промышленной безопасности опасных производственных объектов»? Выберите правильный вариант ответа."}


def to_import(questions, code):
    out = []
    for q in questions:
        text = TEXT_OVERRIDES.get((code, q["number"]), q["text"])
        text = SINGLE_SUFFIX.sub("", text).strip()
        out.append({"number": q["number"], "text": text, "answers": q["answers"], "norm_ref": q["norm_ref"]})
    return out


if __name__ == "__main__":
    path, code, outpath = sys.argv[1:4]
    qs, rep = parse_docx(path)
    print(json.dumps({k: v for k, v in rep.items() if k != "notes"}, ensure_ascii=False))
    if rep["status"] == "ok":
        json.dump(to_import(qs, code), open(outpath, "w", encoding="utf8"), ensure_ascii=False, indent=1)
