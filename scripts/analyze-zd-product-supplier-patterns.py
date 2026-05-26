#!/usr/bin/env python3
"""
Analiza: czy wyszukiwanie ZD po towarze z łącznikiem w nazwie (Marka-Produkt)
działa tylko po tokenie marki, nie po pełnym prefiksie z łącznikiem.

Uruchom w LAN: python3 scripts/analyze-zd-product-supplier-patterns.py
Opcjonalnie z Supabase (lista powiązanych dostawców):
  set -a && source .env.local && set +a && python3 scripts/analyze-zd-product-supplier-patterns.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

BASE = os.environ.get("SUBIEKT_API_BASE_URL", "http://192.168.0.140:5080/api/v1").rstrip("/")

STOP_WORDS = {
    "dla", "the", "and", "z", "do", "na", "w", "i", "or", "mm", "cm", "szt", "kpl", "kg", "ml",
}

GENERIC = re.compile(r"^(viva|dental|pro|plus|max|mini|new|light)$", re.I)


def get(path: str) -> dict:
    url = f"{BASE}{path}"
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.load(r)


def brand_tokens(name: str) -> list[str]:
    trimmed = name.strip()
    if not trimmed:
        return []
    out: list[str] = []
    before = trimmed.split("-")[0].strip()
    if before and len(before) >= 3 and before.lower() not in STOP_WORDS:
        out.append(before)
    first = re.split(r"[\s,;/]+", trimmed)[0]
    first = re.sub(r"^[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+|[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$", "", first)
    if first and len(first) >= 3 and first.lower() not in STOP_WORDS:
        if not out or first.lower() != out[0].lower():
            out.append(first)
    return out


def legacy_tokens(name: str, symbol: str, max_tokens: int = 6) -> list[str]:
    """Tokeny BEZ wyciągania marki przed łącznikiem (stara logika)."""
    tokens: list[str] = []
    words = [
        re.sub(r"^[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+|[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$", "", w)
        for w in re.split(r"[\s,;/]+", name.replace('"', " "))
        if len(w) >= 3 and w.lower() not in STOP_WORDS
    ]
    if len(words) >= 2:
        tokens.append(f"{words[0]} {words[1]}")
    sorted_words = sorted(
        words,
        key=lambda w: (1 if GENERIC.match(w) else 0, -len(w)),
    )
    tokens.extend(sorted_words)
    if symbol and re.search(r"[a-zA-Ząćęłńóśźż]", symbol) and len(symbol) >= 3:
        tokens.append(symbol)
    seen: set[str] = set()
    out: list[str] = []
    for t in tokens:
        k = t.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(t)
    return out[:max_tokens]


def new_tokens(name: str, symbol: str, max_tokens: int = 8) -> list[str]:
    tokens: list[str] = []
    tokens.extend(brand_tokens(name))
    tokens.extend(legacy_tokens(name, symbol, max_tokens))
    seen: set[str] = set()
    out: list[str] = []
    for t in tokens:
        k = t.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(t)
    return out[:max_tokens]


def zd_count(search: str, kh_id: int | None = None, data_od: str = "2024-01-01") -> int:
    q = {"search": search, "pageSize": 1, "page": 1, "dataOd": data_od}
    if kh_id is not None:
        q["khId"] = kh_id
    path = "/documents/zd?" + urllib.parse.urlencode(q)
    try:
        d = get(path)
        return int(d.get("pagination", {}).get("totalCount", 0))
    except Exception:
        return -1


def hyphen_prefix_token(name: str) -> str | None:
    """Pierwszy token ze starej logiki, który zawiera łącznik (typowy problem)."""
    for t in legacy_tokens(name, "", 6):
        if "-" in t:
            return t
    return None


def load_linked_suppliers() -> list[dict]:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return []
    try:
        from urllib.request import Request

        req = Request(
            f"{url.rstrip('/')}/rest/v1/suppliers?select=id,name,subiekt_kh_id&subiekt_kh_id=not.is.null&order=name.asc",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)
    except Exception as e:
        print(f"Supabase: brak listy dostawców ({e})", file=sys.stderr)
        return []


def main() -> None:
    print("Subiekt API:", BASE)
    linked = load_linked_suppliers()
    linked_kh = {s["subiekt_kh_id"]: s["name"] for s in linked if s.get("subiekt_kh_id")}
    print(f"Powiązani dostawcy w aplikacji (Supabase): {len(linked_kh)}")
    if linked_kh:
        for kh, name in sorted(linked_kh.items(), key=lambda x: x[1].lower())[:30]:
            print(f"  kh {kh}: {name}")
        if len(linked_kh) > 30:
            print(f"  ... i {len(linked_kh) - 30} więcej")

    # Zbierz towary z łącznikiem — szukaj po nazwach powiązanych dostawców + ogólne marki
    search_queries = list({n.split(" - ")[0].split("(")[0].strip()[:20] for n in linked_kh.values()})
    search_queries += [
        "renfert", "ivoclar", "viva", "dentsply", "kulzer", "heraeus", "bego", "gc",
        "kerr", "coltene", "voco", "dmg", "kettenbach", "bisco", "tokuyama", "shofu",
        "kuraray", "micerium", "zhermack", "detax", "mectron", "w&h", "komet",
    ]

    products: list[dict] = []
    seen_ids: set[int] = set()
    for q in search_queries:
        if len(q) < 3:
            continue
        try:
            d = get(f"/products?search={urllib.parse.quote(q)}&pageSize=12")
        except Exception:
            continue
        for p in d.get("data", []):
            tid = p.get("tw_Id")
            name = (p.get("tw_Nazwa") or "").strip()
            if tid in seen_ids or "-" not in name:
                continue
            seen_ids.add(tid)
            products.append(
                {
                    "tw_Id": tid,
                    "symbol": (p.get("tw_Symbol") or "").strip(),
                    "name": name,
                }
            )

    print(f"\nPróbka towarów z '-' w nazwie: {len(products)}")

    stats = {
        "hyphen_token_zero_zd": 0,
        "brand_token_has_zd": 0,
        "fixed_by_brand_only": 0,
        "both_work": 0,
        "neither_work": 0,
        "linked_kh_match": 0,
    }
    by_brand: dict[str, dict] = defaultdict(lambda: defaultdict(int))
    examples_fail: list[tuple] = []
    examples_ok: list[tuple] = []

    for p in products[:120]:  # limit API load
        name = p["name"]
        symbol = p["symbol"]
        brands = brand_tokens(name)
        brand = brands[0] if brands else None
        hyphen_tok = hyphen_prefix_token(name)

        legacy_first_counts = []
        for t in legacy_tokens(name, symbol, 3):
            legacy_first_counts.append((t, zd_count(t)))

        hyphen_zd = zd_count(hyphen_tok) if hyphen_tok else 0
        brand_zd = zd_count(brand) if brand else 0

        # kh_Id z pierwszego ZD po marce (symulacja: jaki dostawca ma te towary)
        kh_from_zd = None
        if brand and brand_zd > 0:
            d = get(
                "/documents/zd?"
                + urllib.parse.urlencode(
                    {"search": brand, "pageSize": 1, "page": 1, "dataOd": "2024-01-01"}
                )
            )
            if d.get("data"):
                kh_from_zd = d["data"][0].get("dok_OdbiorcaId")

        brand_kh_zd = zd_count(brand, kh_from_zd) if brand and kh_from_zd else 0
        linked_name = linked_kh.get(kh_from_zd) if kh_from_zd else None

        if hyphen_tok and hyphen_zd == 0:
            stats["hyphen_token_zero_zd"] += 1
        if brand and brand_zd > 0:
            stats["brand_token_has_zd"] += 1
        if hyphen_tok and hyphen_zd == 0 and brand and brand_zd > 0:
            stats["fixed_by_brand_only"] += 1
            key = brand.lower()
            by_brand[key]["fail_hyphen"] += 1
            if len(examples_fail) < 15:
                examples_fail.append((name[:55], hyphen_tok, brand, kh_from_zd, linked_name))
        elif hyphen_tok and hyphen_zd > 0 and brand and brand_zd > 0:
            stats["both_work"] += 1
        elif (not hyphen_tok or hyphen_zd == 0) and (not brand or brand_zd == 0):
            stats["neither_work"] += 1
        if linked_name:
            stats["linked_kh_match"] += 1

        if brand and brand_kh_zd > 0 and linked_name and len(examples_ok) < 8:
            examples_ok.append((name[:55], brand, kh_from_zd, linked_name))

    print("\n=== Wyniki (max 120 towarów) ===")
    total = min(len(products), 120)
    for k, v in stats.items():
        print(f"  {k}: {v} ({100*v/total:.0f}%)" if total else f"  {k}: {v}")

    print("\n=== Problem jak u Renfert (łącznik=0 ZD, marka>0 ZD) ===")
    pct = 100 * stats["fixed_by_brand_only"] / total if total else 0
    print(f"  Towary: {stats['fixed_by_brand_only']}/{total} ({pct:.0f}%)")
    for row in examples_fail[:12]:
        print(f"  • {row[0]}")
        print(f"      stary token: «{row[1]}» → 0 ZD | marka «{row[2]}» → OK | kh {row[3]} → {row[4] or 'brak w app'}")

    print("\n=== Marki najczęściej dotknięte ===")
    for brand, counts in sorted(by_brand.items(), key=lambda x: -x[1]["fail_hyphen"])[:15]:
        print(f"  {brand}: {counts['fail_hyphen']} towarów")

    # Analiza per powiązany dostawca: czy ZD odpowiada na search=fragment nazwy dostawcy
    if linked_kh:
        print("\n=== Powiązani dostawcy: test frazy wyszukiwania ZD ===")
        for kh, sname in sorted(linked_kh.items(), key=lambda x: x[1].lower()):
            fragments = [
                sname.split(" - ")[0].strip(),
                sname.split("(")[0].strip(),
                sname.split()[0] if sname.split() else sname,
            ]
            best = 0
            best_q = ""
            for frag in fragments:
                if len(frag) < 3:
                    continue
                c = zd_count(frag[:24], kh_id=kh)
                if c > best:
                    best = c
                    best_q = frag[:24]
            status = "OK" if best > 0 else "SŁABE — ZD może nie znaleźć po nazwie dostawcy"
            print(f"  kh {kh:5} {sname[:40]:40}  search«{best_q}»+khId → {best} ZD  [{status}]")

    print("\nDone.")


if __name__ == "__main__":
    main()
