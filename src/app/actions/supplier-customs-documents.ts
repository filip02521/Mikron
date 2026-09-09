"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { getSessionUser, getSessionUserForMutation } from "@/lib/auth";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

const CUSTOMS_BUCKET = "customs-documents";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_DESCRIPTION = 1000;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/msword",
  "text/plain",
  "text/csv",
]);

export type SupplierCustomsDocumentRow = {
  id: string;
  supplier_id: string;
  file_name: string;
  description: string;
  mime_type: string;
  byte_size: number | null;
  created_at: string;
  created_by_email: string | null;
};

function revalidateSupplierPaths() {
  revalidatePath("/admin/dostawcy");
  revalidatePath("/zakupy/dostawcy");
}

/**
 * Sprawdza, że dokument istnieje i jego dostawca jest typu IMPORT.
 * Zwraca rekord dokumentu lub null + komunikat błędu.
 */
async function fetchCustomsDocumentForImportSupplier(
  supabase: ReturnType<typeof createAdminClient>,
  documentId: string
): Promise<{ doc: { id: string; storage_path: string; file_name: string } | null; error?: string }> {
  const { data: doc, error } = await supabase
    .from("supplier_customs_documents")
    .select("id, storage_path, file_name, supplier_id")
    .eq("id", documentId)
    .single();

  if (error || !doc) {
    return { doc: null, error: "Dokument nie istnieje." };
  }

  const { data: supplier, error: supplierError } = await supabase
    .from("suppliers")
    .select("location")
    .eq("id", (doc as { supplier_id: string }).supplier_id)
    .single();

  if (supplierError || !supplier) {
    return { doc: null, error: "Dostawca nie istnieje." };
  }
  if (supplier.location !== "IMPORT") {
    return { doc: null, error: "Dokumenty odpraw są dostępne tylko dla dostawców typu Import." };
  }

  return { doc: doc as { id: string; storage_path: string; file_name: string } };
}

/** Lista dokumentów odpraw dla dostawcy — dostęp dla każdego zalogowanego. */
export async function actionListCustomsDocuments(
  supplierId: string
): Promise<{ documents: SupplierCustomsDocumentRow[]; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { documents: [], error: "Brak sesji." };

  if (!hasSupabaseConfig()) return { documents: [] };

  try {
    const supabase = createAdminClient();

    // Weryfikuj, że dostawca istnieje i jest typu IMPORT
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("location")
      .eq("id", supplierId)
      .single();

    if (supplierError || !supplier) {
      return { documents: [], error: "Dostawca nie istnieje." };
    }
    if (supplier.location !== "IMPORT") {
      return { documents: [] };
    }

    const { data, error } = await supabase
      .from("supplier_customs_documents")
      .select(
        "id, supplier_id, file_name, description, mime_type, byte_size, created_at, created_by"
      )
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });

    if (error) {
      return { documents: [], error: error.message };
    }

    const rows = (data ?? []) as Array<
      Omit<SupplierCustomsDocumentRow, "created_by_email"> & { created_by: string | null }
    >;

    // Dociągnij e-maile twórców (created_by może być NULL po ON DELETE SET NULL)
    const creatorIds = [...new Set(rows.map((r) => r.created_by).filter((id): id is string => Boolean(id)))];
    const emailMap = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", creatorIds);
      for (const p of (profiles ?? []) as Array<{ id: string; email: string | null }>) {
        if (p.email) emailMap.set(p.id, p.email);
      }
    }

    const documents: SupplierCustomsDocumentRow[] = rows.map((r) => ({
      id: r.id,
      supplier_id: r.supplier_id,
      file_name: r.file_name,
      description: r.description,
      mime_type: r.mime_type,
      byte_size: r.byte_size,
      created_at: r.created_at,
      created_by_email: (r.created_by && emailMap.get(r.created_by)) ?? null,
    }));

    return { documents };
  } catch (e) {
    return {
      documents: [],
      error: e instanceof Error ? e.message : "Nie udało się pobrać dokumentów.",
    };
  }
}

/** Upload dokumentu odprawy z opisem — dostęp dla każdego zalogowanego. */
export async function actionUploadCustomsDocument(
  supplierId: string,
  file: File,
  description: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getSessionUserForMutation();

  if (!hasSupabaseConfig()) {
    return { success: false, error: "Brak konfiguracji Storage." };
  }

  if (!supplierId.trim()) {
    return { success: false, error: "Brak ID dostawcy." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "Plik przekracza 20 MB." };
  }

  if (file.size === 0) {
    return { success: false, error: "Plik jest pusty." };
  }

  const mime = file.type?.trim() || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return { success: false, error: "Nieobsługiwany typ pliku." };
  }

  const desc = description.trim().slice(0, MAX_DESCRIPTION);

  // Sprawdź, że dostawca istnieje i jest typu IMPORT
  const supabase = createAdminClient();
  const { data: supplier, error: supplierError } = await supabase
    .from("suppliers")
    .select("location")
    .eq("id", supplierId)
    .single();

  if (supplierError || !supplier) {
    return { success: false, error: "Dostawca nie istnieje." };
  }
  if (supplier.location !== "IMPORT") {
    return {
      success: false,
      error: "Dokumenty odpraw można dodawać tylko do dostawców typu Import.",
    };
  }

  const { randomUUID } = await import("crypto");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `customs-documents/${supplierId}/${randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(CUSTOMS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    console.error("[actionUploadCustomsDocument] Upload error:", uploadError.message);
    return { success: false, error: "Nie udało się wgrać pliku." };
  }

  try {
    const { error: insertError } = await supabase
      .from("supplier_customs_documents")
      .insert({
        supplier_id: supplierId,
        created_by: user.id,
        storage_path: storagePath,
        file_name: file.name.slice(0, 255),
        description: desc,
        mime_type: mime,
        byte_size: file.size,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }
  } catch (updateError) {
    console.error(
      "[actionUploadCustomsDocument] DB insert error:",
      updateError instanceof Error ? updateError.message : updateError
    );
    await supabase.storage.from(CUSTOMS_BUCKET).remove([storagePath]).catch(() => {});
    return { success: false, error: "Nie udało się zapisać informacji o pliku." };
  }

  revalidateSupplierPaths();
  return { success: true };
}

/** Usunięcie dokumentu odprawy (plik + rekord) — dostęp dla każdego zalogowanego. */
export async function actionRemoveCustomsDocument(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  await getSessionUserForMutation();

  if (!hasSupabaseConfig()) {
    return { success: false, error: "Brak konfiguracji Storage." };
  }

  const supabase = createAdminClient();

  const { doc, error: verifyError } = await fetchCustomsDocumentForImportSupplier(supabase, documentId);
  if (verifyError || !doc) {
    return { success: false, error: verifyError ?? "Dokument nie istnieje." };
  }

  const storagePath = doc.storage_path;

  const { error: deleteError } = await supabase
    .from("supplier_customs_documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    return { success: false, error: "Nie udało się usunąć dokumentu." };
  }

  await supabase.storage.from(CUSTOMS_BUCKET).remove([storagePath]).catch(() => {});

  revalidateSupplierPaths();
  return { success: true };
}

/** Aktualizacja opisu dokumentu — dostęp dla każdego zalogowanego. */
export async function actionUpdateCustomsDocumentDescription(
  documentId: string,
  description: string
): Promise<{ success: boolean; error?: string }> {
  await getSessionUserForMutation();

  if (!hasSupabaseConfig()) {
    return { success: false, error: "Brak konfiguracji bazy." };
  }

  const supabase = createAdminClient();

  const { doc, error: verifyError } = await fetchCustomsDocumentForImportSupplier(supabase, documentId);
  if (verifyError || !doc) {
    return { success: false, error: verifyError ?? "Dokument nie istnieje." };
  }

  const desc = description.trim().slice(0, MAX_DESCRIPTION);

  const { error } = await supabase
    .from("supplier_customs_documents")
    .update({ description: desc, updated_at: new Date().toISOString() })
    .eq("id", documentId);

  if (error) {
    return { success: false, error: "Nie udało się zaktualizować opisu." };
  }

  revalidateSupplierPaths();
  return { success: true };
}

/** Signed URL do pobrania pliku — dostęp dla każdego zalogowanego. */
export async function actionGetCustomsDocumentUrl(
  documentId: string
): Promise<{ url: string | null; fileName: string | null; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { url: null, fileName: null, error: "Brak sesji." };

  if (!hasSupabaseConfig()) {
    return { url: null, fileName: null, error: "Brak konfiguracji Storage." };
  }

  const supabase = createAdminClient();

  const { doc, error: verifyError } = await fetchCustomsDocumentForImportSupplier(supabase, documentId);
  if (verifyError || !doc) {
    return { url: null, fileName: null, error: verifyError ?? "Dokument nie istnieje." };
  }

  const { data: urlData, error: urlError } = await supabase.storage
    .from(CUSTOMS_BUCKET)
    .createSignedUrl(doc.storage_path, 3600, user.id);

  if (urlError) {
    return { url: null, fileName: doc.file_name, error: "Nie udało się przygotować pobierania." };
  }

  return { url: urlData?.signedUrl ?? null, fileName: doc.file_name };
}
