import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSalesPersonEmailById } from "@/lib/orders/resolve-sales-person-email";
import { sendBoardQuestionReplyEmail } from "@/lib/services/email";
import type { ResolvedSalesPersonContact } from "@/lib/orders/resolve-sales-person-email";
import type { SupabaseClient } from "@/lib/db/admin";

export type NotifyBoardQuestionReplyResult = {
  emailSent: boolean;
  skippedReason?: string;
  error?: string;
};

/**
 * Adresat: sales_person_id wątku, a gdy brak — profil autora pytania.
 */
async function resolveBoardReplyRecipient(
  supabase: SupabaseClient,
  salesPersonId: string | null | undefined,
  createdByProfileId: string | null | undefined
): Promise<ResolvedSalesPersonContact | null> {
  const bySalesPerson = await resolveSalesPersonEmailById(supabase, salesPersonId);
  if (bySalesPerson) return bySalesPerson;

  const profileId = createdByProfileId?.trim();
  if (!profileId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("sales_person_id")
    .eq("id", profileId)
    .maybeSingle();

  return resolveSalesPersonEmailById(supabase, profile?.sales_person_id);
}

/**
 * Powiadamia handlowca e-mailem o odpowiedzi zakupów na jego pytanie na Tablicy.
 * Nie rzuca — błąd maila nie powinien cofać zapisu odpowiedzi.
 */
export async function notifyBoardQuestionReplyToSales(input: {
  threadId: string;
  salesPersonId: string | null | undefined;
  /** Fallback, gdy wątek nie ma sales_person_id. */
  createdByProfileId?: string | null;
  questionTitle: string;
  questionBody?: string | null;
  productSymbol?: string | null;
  productName?: string | null;
  replyBody: string;
}): Promise<NotifyBoardQuestionReplyResult> {
  const replyBody = input.replyBody.trim();
  if (!replyBody) {
    return { emailSent: false, skippedReason: "empty_reply" };
  }

  const supabase = createAdminClient();
  const person = await resolveBoardReplyRecipient(
    supabase,
    input.salesPersonId,
    input.createdByProfileId
  );
  if (!person) {
    console.warn(
      "[board-reply-email] missing recipient",
      input.threadId,
      "salesPersonId=",
      input.salesPersonId ?? "(null)",
      "createdBy=",
      input.createdByProfileId ?? "(null)"
    );
    return { emailSent: false, skippedReason: "missing_sales_email" };
  }

  const send = await sendBoardQuestionReplyEmail({
    to: person.email,
    recipientName: person.name,
    threadId: input.threadId,
    questionTitle: input.questionTitle,
    questionBody: input.questionBody,
    productSymbol: input.productSymbol,
    productName: input.productName,
    replyBody,
  });

  if (!send.ok) {
    console.error("[board-reply-email]", send.to, send.error);
    return { emailSent: false, error: send.error };
  }

  console.info(
    "[board-reply-email] delivered",
    input.threadId,
    "→",
    person.email,
    "id=",
    send.id
  );
  return { emailSent: true };
}
