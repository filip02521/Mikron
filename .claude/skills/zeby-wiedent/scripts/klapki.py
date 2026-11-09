#!/usr/bin/env python3
"""Rozbicie faktur Wiedent na klapki "6" (przód) i "8" (bok).

Wejście (plik lub stdin): nagłówek faktury w linii bez cyfr na początku,
potem linie "<ilość> <kolor>". Opcja --mag P B: klapki "6" i "8" z magazynu
na całą dostawę. Z --mag skrypt dopasowuje podział do magazynu i rozpisuje
go na faktury tak, żeby każda zgadzała się co do zęba (a więc co do grosza).
Opcja --cena X: cena za ząb z ZD, porównywana z ceną z faktury (1,47).
"""
import sys

PRICE = 1.47
VAT = 1.08
P6, P8 = round(6 * PRICE, 2), round(8 * PRICE, 2)


def classify(qty: int) -> tuple[str, bool]:
    """Zwraca ("6"|"8", czy_pewne)."""
    if qty % 108 == 0:
        return "6", True
    if qty % 8 == 0:
        return "8", True
    if qty % 6 == 0:
        # nie da się z tego zrobić klapek "8", więc musi być przód
        return "6", False
    return "?", False


def parse(lines):
    invoices, cur = [], None
    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        if s[0].isdigit():
            qty, _, color = s.partition(" ")
            if cur is None:
                cur = {"name": "(bez nazwy)", "rows": []}
                invoices.append(cur)
            cur["rows"].append((int(qty), color.strip() or "?"))
        else:
            cur = {"name": s, "rows": []}
            invoices.append(cur)
    return invoices


def pl(x: float) -> str:
    return f"{x:,.2f}".replace(",", " ").replace(".", ",")


def main(argv):
    mag = cena = None
    if "--mag" in argv:
        i = argv.index("--mag")
        mag = (int(argv[i + 1]), int(argv[i + 2]))
        argv = argv[:i] + argv[i + 3:]
    if "--cena" in argv:
        i = argv.index("--cena")
        cena = float(argv[i + 1].replace(",", "."))
        argv = argv[:i] + argv[i + 2:]
    src = open(argv[0], encoding="utf-8") if argv else sys.stdin
    invoices = parse(src.readlines())

    bad = False
    for inv in invoices:
        inv["teeth"] = sum(q for q, _ in inv["rows"])
        k6 = k8 = 0
        inv["unsure"] = []
        for lp, (qty, color) in enumerate(inv["rows"], 1):
            kind, sure = classify(qty)
            if kind == "?":
                print(f"BŁĄD {inv['name']} LP {lp}: {qty} szt {color} nie dzieli się ani przez 6, ani przez 8")
                bad = True
                continue
            if kind == "6":
                k6 += qty // 6
            else:
                k8 += qty // 8
            if not sure:
                inv["unsure"].append(f"LP {lp}: {qty} {color}")
        inv["k6"], inv["k8"] = k6, k8
    if bad:
        sys.exit(1)

    rule6 = sum(i["k6"] for i in invoices)
    rule8 = sum(i["k8"] for i in invoices)
    note = "wg reguły (wielokrotność 108 = przód)"
    if mag:
        if mag[0] * 6 + mag[1] * 8 != sum(i["teeth"] for i in invoices):
            print(f"UWAGA: magazyn {mag[0]}×6 + {mag[1]}×8 = {mag[0] * 6 + mag[1] * 8} zębów, "
                  f"faktury {sum(i['teeth'] for i in invoices)} – magazyn albo faktury niekompletne.")
            sys.exit(1)
        d6 = mag[0] - rule6  # >0: część "8" to w rzeczywistości "6"
        if d6:
            # 4 klapki "6" = 3 klapki "8" = 24 zęby; przesuwamy grupy 24 zębów
            groups = d6 // 4
            # najpierw faktury z nietypowymi liniami, potem największe
            order = sorted(invoices, key=lambda i: (not i["unsure"], -i["teeth"]))
            for inv in order:
                if groups == 0:
                    break
                cap = inv["k8"] // 3 if groups > 0 else inv["k6"] // 4
                move = min(abs(groups), cap) * (1 if groups > 0 else -1)
                inv["k6"] += 4 * move
                inv["k8"] -= 3 * move
                inv["moved"] = move
                groups -= move
            note = (f"dopasowane do magazynu (reguła dała {rule6}/{rule8}, "
                    f"przesunięto {abs(d6)} klapek „6” ↔ {abs(d6) // 4 * 3} „8”)")
        else:
            note = "wg reguły – zgodne z magazynem"

    print(f"Podział: {note}\n")
    print("| Faktura | Klapki „6” × " + pl(P6) + " | Klapki „8” × " + pl(P8) + " | Netto | VAT | Brutto |")
    print("|---|---|---|---|---|---|")
    t6 = t8 = tn = 0
    for inv in invoices:
        net = round(inv["k6"] * P6 + inv["k8"] * P8, 2)
        check = round(inv["teeth"] * PRICE, 2)
        vat = round(net * (VAT - 1), 2)
        flag = "" if abs(net - check) < 0.005 else f" ≠ {pl(check)}!"
        print(f"| {inv['name']} | {inv['k6']} | {inv['k8']} | {pl(net)}{flag} | {pl(vat)} | {pl(net + vat)} |")
        t6, t8, tn = t6 + inv["k6"], t8 + inv["k8"], tn + net
    print(f"| **Razem** | **{t6}** | **{t8}** | **{pl(tn)}** | | |")
    print(f"\nZęby: {sum(i['teeth'] for i in invoices)}. Netto = zęby × {pl(PRICE)} – porównaj z tabelą VAT faktur.")
    for inv in invoices:
        if inv["unsure"]:
            print(f"{inv['name']} – linie nietypowe (liczone jako „6”): {', '.join(inv['unsure'])}")
        if inv.get("moved"):
            print(f"{inv['name']} – tu przesunięto różnicę z magazynem ({4 * abs(inv['moved'])} klapek „6”).")
    if cena is not None and abs(cena - PRICE) > 0.0001:
        print(f"\nUWAGA: cena w ZD {pl(cena)} ≠ cena z faktury {pl(PRICE)} za ząb – popraw ZD przed wpisaniem.")


if __name__ == "__main__":
    main(sys.argv[1:])
