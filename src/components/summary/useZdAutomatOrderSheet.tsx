"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { actionListZdAutoProposals } from "@/app/actions/zd-estimate";
import { useDailyZdProposalMap } from "@/components/summary/DailyZdProposals";
import { ZdAutoProposalSheet } from "@/components/zakupy/ZdAutoProposalSheet";
import type { ZdAutoProposal } from "@/lib/data/zd-auto-proposals";
import type { ZdAutomatTodayOrder } from "@/lib/orders/zd-automat-daily";
import { buildZdPostCreateSessionFromLink, type ZdPostCreateSession } from "@/lib/orders/zd-estimate-post-create";

/** ZD z tej propozycji już jest — sesja panelu wysyłki jak po „Powiąż” w Kreatorze (bez ponownego zapisu). */
function resumeSessionFor(p: ZdAutoProposal, supplierName: string, dokNr: string | null): ZdPostCreateSession {
  return buildZdPostCreateSessionFromLink({
    supplierId: p.supplierId,
    supplierName,
    fromDaily: true,
    dokId: p.dokId,
    dokNrPelny: dokNr ?? "",
    lineCount: p.finalLines ? Object.keys(p.finalLines).length : p.lineCount,
    previewLines: p.lines.map((l) => ({
      twId: l.twId,
      symbol: l.symbol,
      nazwa: l.nazwa,
      ilosc: l.zdUnits,
      packagingHint: l.unitLabel !== "szt" ? l.unitLabel : null,
      individualExtraPieces: l.prosbaPieces,
      piecesArriving: l.pieces,
    })),
    createdLines: p.finalLines ? Object.entries(p.finalLines).map(([twId, ilosc]) => ({ twId: Number(twId), ilosc })) : null,
  });
}

type Open = { supplierId: string; supplierName: string; proposal: ZdAutoProposal; resume: ZdPostCreateSession | null };

/**
 * Panel „Sprawdź i wyślij” dla zamówienia automatu: jeden na listę. `start` dociąga pełną propozycję, gdy nie ma jej
 * wśród czekających; `startProposal` otwiera panel wprost z czekającej propozycji. `sheet` renderuj raz obok listy.
 */
export function useZdAutomatOrderSheet(): {
  start: (o: ZdAutomatTodayOrder) => Promise<void>;
  startProposal: (p: ZdAutoProposal & { supplierName: string }) => void;
  loadingId: string | null;
  error: { id: string; message: string } | null;
  sheet: ReactNode;
} {
  const router = useRouter();
  const pendingMap = useDailyZdProposalMap();
  const [open, setOpen] = useState<Open | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const start = async (o: ZdAutomatTodayOrder) => {
    if (loadingId === o.proposal.id) return; // drugi klik w to samo zamówienie w trakcie wczytywania nic nie zmienia
    setError(null);
    const known = pendingMap.get(o.supplierId);
    let proposal: ZdAutoProposal | null = known?.id === o.proposal.id ? known : null;
    if (!proposal) {
      setLoadingId(o.proposal.id);
      const r = await actionListZdAutoProposals({ supplierId: o.supplierId }).catch(() => null);
      setLoadingId(null);
      proposal = r?.ok ? (r.proposals.find((p) => p.id === o.proposal.id) ?? null) : null;
      if (!proposal) {
        setError({ id: o.proposal.id, message: r && !r.ok ? r.message : "Nie udało się wczytać zamówienia - odśwież stronę." });
        return;
      }
    }
    const resume = o.stage === "send" && proposal.dokId ? resumeSessionFor(proposal, o.supplierName, o.proposal.dokNr) : null;
    setOpen({ supplierId: o.supplierId, supplierName: o.supplierName, proposal, resume });
  };

  const startProposal = (p: ZdAutoProposal & { supplierName: string }) => {
    setError(null);
    setOpen({ supplierId: p.supplierId, supplierName: p.supplierName, proposal: p, resume: null });
  };

  const sheet = open ? (
    <ZdAutoProposalSheet
      supplierId={open.supplierId}
      supplierName={open.supplierName}
      morning={open.proposal}
      resumeSession={open.resume}
      onClose={() => {
        setOpen(null);
        // Etap w wierszu (ZD, mail) pochodzi z serwera.
        router.refresh();
      }}
    />
  ) : null;

  return { start, startProposal, loadingId, error, sheet };
}
