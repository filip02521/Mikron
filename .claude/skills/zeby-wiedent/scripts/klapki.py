#!/usr/bin/env python3
"""Rozbicie faktur Wiedent na przody/boki i klapki.

Wejście (plik lub stdin): nagłówek faktury w linii bez cyfr na początku,
potem linie "<ilość> <kolor>". Opcja --mag P B: klapki "6" i "8" z magazynu.
"""
import sys

PRICE = 1.47
VAT = 1.08


def is_front(qty: int) -> bool:
    # Przód pakowany po 18 klapek (108 zębów); każda inna ilość to bok.
    return qty % 108 == 0


def parse(lines):
    invoices, cur = [], None
    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        if s[0].isdigit():
            qty, _, color = s.partition(" ")
            if cur is None:
                cur = ["(bez nazwy)", []]
                invoices.append(cur)
            cur[1].append((int(qty), color.strip() or "?"))
        else:
            cur = [s, []]
            invoices.append(cur)
    return invoices


def pl(x: float) -> str:
    return f"{x:,.2f}".replace(",", " ").replace(".", ",")


def main(argv):
    mag = None
    if "--mag" in argv:
        i = argv.index("--mag")
        mag = (int(argv[i + 1]), int(argv[i + 2]))
        argv = argv[:i] + argv[i + 3:]
    src = open(argv[0], encoding="utf-8") if argv else sys.stdin
    invoices = parse(src.readlines())

    tot_f = tot_b = 0
    for name, rows in invoices:
        print(f"\n**{name}**\n")
        print("| LP | Kolor | Klapki | Cena netto | Wartość netto |")
        print("|---|---|---|---|---|")
        net = kf = kb = 0
        for lp, (qty, color) in enumerate(rows, 1):
            front = is_front(qty)
            per = 6 if front else 8
            if qty % per:
                print(f"| {lp} | {color} ?? | {qty} szt nie dzieli się przez {per} | | |")
                continue
            k = qty // per
            v = qty * PRICE
            net += v
            if front:
                kf += k
            else:
                kb += k
            print(f"| {lp} | {color} {'przód' if front else 'bok'} | {k} | {pl(per * PRICE)} | {pl(v)} |")
        print(f"\nKlapki: przód {kf}, bok {kb}. Zęby {sum(q for q, _ in rows)}. "
              f"Netto {pl(net)}, brutto {pl(net * VAT)}.")
        tot_f += kf
        tot_b += kb

    if len(invoices) > 1:
        print(f"\nRazem klapki: przód {tot_f}, bok {tot_b}.")
    if mag:
        ok = (tot_f, tot_b) == mag
        print(f"Magazyn: przód {mag[0]}, bok {mag[1]}. "
              f"{'ZGODNE' if ok else f'RÓŻNICA przód {tot_f - mag[0]:+d}, bok {tot_b - mag[1]:+d}'}")


if __name__ == "__main__":
    main(sys.argv[1:])
