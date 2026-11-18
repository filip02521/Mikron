/**
 * Kolejne produkty pytania na Tablicy (migracja 216). Pierwszy produkt siedzi w kolumnach wątku.
 * Odczyt jest odporny na brak migracji — wtedy pytanie pokazuje tylko pierwszy produkt.
 */

import { isUndefinedTableError, query } from "@/lib/db/pool";
import type { BoardQuestionProductFields } from "@/lib/department-board/question-product";

export async function fetchBoardQuestionExtraProducts(
  threadIds: readonly string[]
): Promise<Map<string, BoardQuestionProductFields[]>> {
  const byThread = new Map<string, BoardQuestionProductFields[]>();
  if (!threadIds.length) return byThread;
  try {
    const { rows } = await query<BoardQuestionProductFields & { thread_id: string }>(
      `SELECT thread_id, product_symbol, product_name, subiekt_tw_id, mikran_code
         FROM public.department_board_thread_products
        WHERE thread_id = ANY($1::uuid[])
        ORDER BY thread_id, position`,
      [threadIds]
    );
    for (const { thread_id, ...fields } of rows) {
      const list = byThread.get(thread_id) ?? [];
      list.push(fields);
      byThread.set(thread_id, list);
    }
  } catch (e) {
    if (!isUndefinedTableError(e)) throw e;
  }
  return byThread;
}

/** Zapisuje produkty 2…n w kolejności z formularza. */
export async function insertBoardQuestionExtraProducts(
  threadId: string,
  extras: readonly BoardQuestionProductFields[]
): Promise<void> {
  if (!extras.length) return;
  const values: unknown[] = [threadId];
  const tuples = extras.map((p, i) => {
    const base = values.length;
    values.push(i + 2, p.product_symbol, p.product_name, p.subiekt_tw_id, p.mikran_code);
    return `($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });
  await query(
    `INSERT INTO public.department_board_thread_products
       (thread_id, position, product_symbol, product_name, subiekt_tw_id, mikran_code)
     VALUES ${tuples.join(", ")}`,
    values
  );
}
