#!/usr/bin/env python3
"""Выгрузка prombez24 (questions.json + catalog.json) -> JSON-файлы импорта, по одному на тест (область).

Иерархия источника: курс -> раздел -> тест. Тест становится областью; коды, slug, сфера и параметры экзамена
берутся из карты областей data/prombez24/areas.json (её создаёт --init-map и дальше правят руками: slug после
первой загрузки менять нельзя). Вопросы — банк теста (bank_question_ids) в его порядке; билеты источника
пересобираются при каждой загрузке и не используются, кроме размера билета для параметров экзамена.

Что делается с вопросами:
  - status ok и fixed_from_twin берутся; answer_unknown, image_missing, incomplete пропускаются (нет ответа или
    текста); fixed_by_claude_unverified пропускается, пока не передан --include-unverified (ответ не подтверждён);
  - все варианты верные и пронумерованы «1.», «2.»… -> вопрос на порядок (kind=order): номера убираются, варианты
    встают по номерам; все верные и вида «левое --- правое» -> вопрос на соответствие (kind=match);
  - картинка (data URI) передаётся как есть; если текста нет, вопрос называется «Вопрос по рисунку»;
  - хвост «Выберите правильный вариант ответа.» убирается (страница вопроса добавляет его сама).

Использование:
    python3 -I scripts/parsers/prombez24.py --questions questions.json --catalog catalog.json \\
        --map data/prombez24/areas.json --out data/raw/prombez24 [--init-map] [--include-unverified]
"""
import argparse
import collections
import json
import math
import os
import re
import sys

BANK_VERSION = "2026-10"
BANK_UPDATED_AT = "2026-10-24"
SKIP_STATUSES = {"answer_unknown", "image_missing", "incomplete"}
UNVERIFIED = "fixed_by_claude_unverified"
NO_TEXT = "Вопрос по рисунку"

NUM_RE = re.compile(r"^\s*(\d+)\s*[.)]\s*(.+)$", re.S)
PAIR_STRICT_RE = re.compile(r"\s*-{3,}\s*")
PAIR_LOOSE_RE = re.compile(r"\s*-{3,}\s*|\s+[-–—]\s+")
# Хвост билета убираем, как и в остальных парсерах: страница вопроса возвращает его сама (lib/text.ts, questionHint).
SINGLE_SUFFIX = re.compile(r"(\s*Выберите правильный вариант ответа\.?)+\s*$")

# Курсы источника по номеру в course_url -> сфера на нашем сайте и правило кодов.
COURSES = {
    "86": {"course": "prombez"},
    "87": {"course": "energo"},
    "88": {"course": "elektro", "prefix": "ЭБ", "slug": "eb"},
    "91": {"course": "gts"},
    "93": {"course": "okhrana-truda", "prefix": "ОТ", "slug": "ot"},
    "90": {"course": "ekologiya", "prefix": "ЭКО", "slug": "eko"},
    "94": {"course": "pozharnaya", "prefix": "ПОЖ", "slug": "pozh"},
    "96": {"course": "gochs", "prefix": "ГОЧС", "slug": "gochs"},
    "104": {"course": "radiatsionnaya", "prefix": "РБ", "slug": "rb"},
    "105": {"course": "antiterror", "prefix": "АТ", "slug": "at"},
    "98": {"course": "bdd", "prefix": "БДД", "slug": "bdd"},
    "101": {"course": "rabochie", "prefix": "РП", "slug": "rp"},
    "102": {"course": "sout", "prefix": "СОУТ", "slug": "sout"},
    "106": {"course": "informatsionnaya", "prefix": "ИБ", "slug": "ib"},
}
ROSTEKHNADZOR = {"prombez", "energo", "elektro", "gts"}

# Области Б.8.1.1–Б.8.1.5 (котлы по видам) в источнике идут сразу за Б.8.1, а не отдельным разделом.
B81_SUB = [451, 452, 453, 454, 455]

LATIN = {"А": "a", "Б": "b", "В": "v", "Г": "g"}


def course_key(entry):
    return entry["course_url"].rstrip("/").rsplit("/", 1)[-1]


def code_slug(code):
    """«Б.8.1.1» -> «b8-1-1», «А.1» -> «a1» (как у областей, загруженных раньше)."""
    letter, *parts = code.split(".")
    return LATIN[letter] + "-".join(parts)


def ticket_size(entry):
    sizes = collections.Counter(len(t["question_ids"]) for t in entry["tickets"])
    return sizes.most_common(1)[0][0] if sizes else 20


def exam_params(size, authority):
    # Регламенты по сферам разные и не опубликованы в источнике: это значения по умолчанию, их стоит сверить.
    if authority == "Ростехнадзора":
        return {"questions_count": size, "time_limit_min": max(10, size), "pass_threshold": math.ceil(size * 0.9)}
    return {"questions_count": size, "time_limit_min": max(10, size), "pass_threshold": math.ceil(size * 0.8)}


def init_map(catalog):
    """Коды и slug по порядку тестов в источнике. Совпадение с уже опубликованными областями сверено вручную."""
    out = []
    counters = collections.Counter()
    for i, e in enumerate(catalog):
        cfg = COURSES[course_key(e)]
        course = cfg["course"]
        section = e["section"]
        if course == "prombez":
            m = re.match(r"^([АБ])\.?\s*(\d+)?", section)
            letter, num = m.group(1), m.group(2)
            if letter == "А":
                code = "А.1"
            elif num == "8" and e["test_id"] in B81_SUB:
                code = f"Б.8.1.{B81_SUB.index(e['test_id']) + 1}"
            else:
                counters[("Б", num)] += 1
                code = f"Б.{num}.{counters[('Б', num)]}"
        elif course == "energo":
            m = re.match(r"^Г\s*(\d)\.", section)
            if m:
                counters[("Г", m.group(1))] += 1
                code = f"Г.{m.group(1)}.{counters[('Г', m.group(1))]}"
            else:
                counters["ТЭУ"] += 1
                code = f"ТЭУ.{counters['ТЭУ']}"
        elif course == "gts":
            counters["В"] += 1
            code = f"В.{counters['В']}"
        else:
            counters[course] += 1
            code = f"{cfg['prefix']}.{counters[course]}"
        if code.startswith("ТЭУ"):
            slug = "teu-" + code.split(".")[1]
        elif "slug" in cfg:
            slug = f"{cfg['slug']}-{counters[course]}"
        else:
            slug = code_slug(code)
        if course in ROSTEKHNADZOR:
            authority = "Ростехнадзора"
        elif course == "sout" or (course == "okhrana-truda" and section.startswith("ЕИСОТ")):
            authority = "Минтруда"
        else:
            authority = None
        title = e["title"]
        if code == "А.1":
            title = "Основы промышленной безопасности"
        sec = None if (section is None or section == e["title"]) else section
        out.append(
            {
                "test_id": e["test_id"],
                "code": code,
                "slug": slug,
                "course": course,
                "title": title,
                "section": sec,
                "authority": authority,
                "sort_order": (i + 1) * 10,
                "exam": exam_params(ticket_size(e), authority),
            }
        )
    return out


def detect_kind(answers):
    """(kind, answers) — answers переписаны для order (без номеров, по порядку) и как есть для остальных."""
    if len(answers) < 2 or not all(a["correct"] for a in answers):
        return "choice", answers
    texts = [a["text"] for a in answers]
    if all(PAIR_STRICT_RE.search(t) for t in texts):
        return "match", answers
    nums = [NUM_RE.match(t) for t in texts]
    if all(nums) and sorted(int(m.group(1)) for m in nums) == list(range(1, len(answers) + 1)):
        ordered = sorted(zip(nums, answers), key=lambda p: int(p[0].group(1)))
        return "order", [{**a, "text": m.group(2).strip()} for m, a in ordered]
    if all(PAIR_LOOSE_RE.search(t) for t in texts):
        return "match", answers
    return "choice", answers


def convert_question(q, number):
    kind, answers = detect_kind(q["answers"])
    text = SINGLE_SUFFIX.sub("", (q["title"] or "").strip()) or (NO_TEXT if q.get("image") else "")
    out = {
        "number": number,
        "source_id": q["id"],
        "text": text,
        "answers": [{"text": a["text"], "is_correct": bool(a["correct"])} for a in answers],
        "norm_ref": (q.get("ntd_link") or "").strip() or None,
    }
    if kind != "choice":
        out["kind"] = kind
    if q.get("image"):
        out["image"] = q["image"]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", required=True)
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--map", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--init-map", action="store_true", help="создать карту областей, если её нет")
    ap.add_argument("--include-unverified", action="store_true")
    args = ap.parse_args()

    with open(args.catalog, encoding="utf-8") as f:
        catalog = json.load(f)
    with open(args.questions, encoding="utf-8") as f:
        questions = {q["id"]: q for q in json.load(f)}

    if args.init_map and not os.path.exists(args.map):
        with open(args.map, "w", encoding="utf-8") as f:
            json.dump(init_map(catalog), f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"Карта областей записана: {args.map}")
    with open(args.map, encoding="utf-8") as f:
        area_map = {a["test_id"]: a for a in json.load(f)}

    missing = [e["test_id"] for e in catalog if e["test_id"] not in area_map]
    if missing:
        sys.exit(f"Тестов нет в карте областей: {missing}. Добавьте их в {args.map} (slug после загрузки не меняется).")
    for key in ("code", "slug"):
        dup = [v for v, n in collections.Counter(a[key] for a in area_map.values()).items() if n > 1]
        if dup:
            sys.exit(f"В карте областей повторяется {key}: {dup}")

    os.makedirs(args.out, exist_ok=True)
    skip = SKIP_STATUSES | (set() if args.include_unverified else {UNVERIFIED})
    report = []
    totals = collections.Counter()
    for e in catalog:
        a = area_map[e["test_id"]]
        qs = []
        for pos, qid in enumerate(e["bank_question_ids"], start=1):
            q = questions.get(qid)
            if q is None:
                totals["missing"] += 1
                continue
            if q["status"] in skip:
                totals["skip:" + q["status"]] += 1
                continue
            cq = convert_question(q, pos)
            totals["kind:" + cq.get("kind", "choice")] += 1
            if "image" in cq:
                totals["images"] += 1
            qs.append(cq)
        area = {
            "code": a["code"],
            "title": a["title"],
            "course": a["course"],
            "section": a["section"],
            "authority": a["authority"],
            "bank_version": BANK_VERSION,
            "bank_updated_at": BANK_UPDATED_AT,
            "exam": a["exam"],
            "sort_order": a["sort_order"],
        }
        path = os.path.join(args.out, f"{a['slug']}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"area": area, "questions": qs}, f, ensure_ascii=False)
        report.append((a["slug"], a["code"], len(qs), os.path.getsize(path)))
        totals["questions"] += len(qs)
        totals["areas"] += 1

    with open(os.path.join(args.out, "_report.json"), "w", encoding="utf-8") as f:
        json.dump({"totals": totals, "areas": report}, f, ensure_ascii=False, indent=1)
    for k, v in sorted(totals.items()):
        print(f"  {k}: {v}")
    big = max(report, key=lambda r: r[3])
    print(f"Самый большой файл: {big[0]} ({big[3] / 1e6:.1f} МБ)")


if __name__ == "__main__":
    main()
