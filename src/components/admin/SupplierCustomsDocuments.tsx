"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { fieldControlClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SupplierFormSection } from "@/components/admin/SupplierFormSection";
import type { ToastNotice } from "@/lib/ui/notice-copy";
import {
  actionListCustomsDocuments,
  actionUploadCustomsDocument,
  actionRemoveCustomsDocument,
  actionUpdateCustomsDocumentDescription,
  actionGetCustomsDocumentUrl,
  type SupplierCustomsDocumentRow,
} from "@/app/actions/supplier-customs-documents";
import { IconFilePlus, IconTrash2, IconDownload, IconPencil, IconCircleCheck, IconX } from "@/components/icons/StrokeIcons";

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function DocumentRow({
  doc,
  disabled,
  onRemove,
  onUpdateDescription,
  onDownload,
}: {
  doc: SupplierCustomsDocumentRow;
  disabled: boolean;
  onRemove: (doc: SupplierCustomsDocumentRow) => void;
  onUpdateDescription: (doc: SupplierCustomsDocumentRow, description: string) => void;
  onDownload: (doc: SupplierCustomsDocumentRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.description);

  const startEditing = () => {
    setDraft(doc.description);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(doc.description);
    setEditing(false);
  };

  const save = () => {
    if (draft.trim() === doc.description.trim()) {
      setEditing(false);
      return;
    }
    setEditing(false);
    onUpdateDescription(doc, draft);
  };

  return (
    <li className="rounded-lg border border-slate-100 bg-white p-3 transition-colors hover:border-slate-200">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
          <IconFilePlus size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium text-slate-900">{doc.file_name}</p>
            <span className="text-xs text-slate-400">
              {formatBytes(doc.byte_size)}
              {doc.created_by_email ? ` · ${doc.created_by_email}` : ""}
              {doc.created_at ? ` · ${formatDate(doc.created_at)}` : ""}
            </span>
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                className={cn(fieldControlClass(), "min-h-[60px] resize-y")}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Opis dokumentu (np. Deklaracja celna SAD, Faktura VAT…)"
                maxLength={1000}
                disabled={disabled}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={save}
                >
                  <IconCircleCheck size={13} />
                  Zapisz opis
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={cancelEditing}
                >
                  <IconX size={13} />
                  Anuluj
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600">
                {doc.description || (
                  <span className="italic text-slate-400">Brak opisu</span>
                )}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                  title="Pobierz plik"
                  disabled={disabled}
                  onClick={() => onDownload(doc)}
                >
                  <IconDownload size={15} />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                  title="Edytuj opis"
                  disabled={disabled}
                  onClick={() => startEditing()}
                >
                  <IconPencil size={14} />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  title="Usuń dokument"
                  disabled={disabled}
                  onClick={() => onRemove(doc)}
                >
                  <IconTrash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function SupplierCustomsDocuments({
  supplierId,
  disabled,
  onToast,
}: {
  supplierId: string;
  disabled: boolean;
  onToast: (notice: ToastNotice) => void;
}) {
  const [documents, setDocuments] = useState<SupplierCustomsDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SupplierCustomsDocumentRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onToastRef = useRef(onToast);
  useEffect(() => {
    onToastRef.current = onToast;
  });

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const result = await actionListCustomsDocuments(supplierId);
    setDocuments(result.documents);
    if (result.error) {
      onToastRef.current({ text: result.error, tone: "error" });
    }
    setLoading(false);
  }, [supplierId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void loadDocuments();
    });
    return () => {
      cancelled = true;
    };
  }, [loadDocuments]);

  const handleUpload = () => {
    if (!file || uploading) return;
    setUploading(true);
    startTransition(async () => {
      const result = await actionUploadCustomsDocument(supplierId, file, description);
      setUploading(false);
      if (result.success) {
        setFile(null);
        setDescription("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        onToastRef.current({ text: "Dodano dokument odprawy", tone: "success" });
        await loadDocuments();
      } else {
        onToastRef.current({ text: result.error ?? "Nie udało się wgrać pliku.", tone: "error" });
      }
    });
  };

  const handleRemove = (doc: SupplierCustomsDocumentRow) => {
    startTransition(async () => {
      const result = await actionRemoveCustomsDocument(doc.id);
      if (result.success) {
        setRemoveTarget(null);
        onToastRef.current({ text: "Usunięto dokument", tone: "success" });
        await loadDocuments();
      } else {
        onToastRef.current({ text: result.error ?? "Nie udało się usunąć.", tone: "error" });
      }
    });
  };

  const handleUpdateDescription = (doc: SupplierCustomsDocumentRow, desc: string) => {
    startTransition(async () => {
      const result = await actionUpdateCustomsDocumentDescription(doc.id, desc);
      if (result.success) {
        onToastRef.current({ text: "Zaktualizowano opis", tone: "success" });
        await loadDocuments();
      } else {
        onToastRef.current({ text: result.error ?? "Nie udało się zaktualizować opisu.", tone: "error" });
      }
    });
  };

  const handleDownload = (doc: SupplierCustomsDocumentRow) => {
    startTransition(async () => {
      const result = await actionGetCustomsDocumentUrl(doc.id);
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        onToastRef.current({ text: result.error ?? "Nie udało się pobrać pliku.", tone: "error" });
      }
    });
  };

  const busy = disabled || pending || uploading;

  return (
    <>
      <SupplierFormSection
        title="Dokumenty do odprawy celnej"
        description="Faktury, deklaracje celne SAD, świadectwa pochodzenia i inne dokumenty wymagane przy imporcie"
        defaultOpen
      >
        <div className="space-y-3 sm:col-span-2">
          {/* Formularz uploadu */}
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-4">
            <div className="space-y-3">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xls,.doc,.txt,.csv"
                  disabled={busy}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  PDF, JPG, PNG, WebP, DOCX, XLSX — max 20 MB
                </p>
              </div>
              <textarea
                className={cn(fieldControlClass(), "min-h-[60px] resize-y")}
                placeholder="Opis / komentarz do dokumentu (np. Deklaracja celna SAD — dostawa 09/2026)"
                value={description}
                maxLength={1000}
                disabled={busy}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!file || busy}
                  onClick={handleUpload}
                >
                  <IconFilePlus size={14} />
                  {uploading ? "Wgrywanie…" : "Dodaj dokument"}
                </Button>
              </div>
            </div>
          </div>

          {/* Lista dokumentów */}
          {loading ? (
            <p className="py-4 text-center text-sm text-slate-400">Wczytywanie dokumentów…</p>
          ) : documents.length === 0 ? (
            <div className="py-6 text-center">
              <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <IconFilePlus size={18} />
              </span>
              <p className="text-sm text-slate-500">
                Brak dokumentów. Dodaj pierwszy plik powyżej.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  disabled={busy}
                  onRemove={setRemoveTarget}
                  onUpdateDescription={handleUpdateDescription}
                  onDownload={handleDownload}
                />
              ))}
            </ul>
          )}
        </div>
      </SupplierFormSection>

      <ConfirmDialog
        open={!!removeTarget}
        title="Usunąć dokument?"
        message={
          removeTarget
            ? `„${removeTarget.file_name}" zostanie trwale usunięty. Tej operacji nie można cofnąć.`
            : ""
        }
        confirmLabel="Usuń"
        danger
        pending={pending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) handleRemove(removeTarget);
        }}
      />
    </>
  );
}
