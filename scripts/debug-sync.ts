import { createAdminClient } from "../src/lib/supabase/admin";
import {
  parseDateOnly,
  formatDateString,
  resolveSupplierInterval,
} from "../src/lib/orders/dates";
import { recalcScheduleRow } from "../src/lib/orders/recalc";

async function main() {
  const supabase = createAdminClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*, supplier_schedules(*)")
    .order("name");

  for (const s of suppliers ?? []) {
    const sch = Array.isArray(s.supplier_schedules)
      ? s.supplier_schedules[0]
      : s.supplier_schedules;

    const orderDate = parseDateOnly(sch?.order_date ?? null);
    const shiftDate = parseDateOnly(sch?.shift_date ?? null);
    const interval = resolveSupplierInterval(
      s.interval_raw as string | null,
      s.interval_weeks != null ? Number(s.interval_weeks) : null
    );

    try {
      const recalc = recalcScheduleRow({
        orderDate,
        shiftDate,
        interval,
        location: s.location,
        vacations: [],
      });
      if (recalc.computedNextDate) {
        formatDateString(recalc.computedNextDate);
      }
    } catch (e) {
      console.log("FAIL:", s.name, {
        order_date: sch?.order_date,
        shift_date: sch?.shift_date,
        computed_next_date: sch?.computed_next_date,
        interval_weeks: s.interval_weeks,
      });
    }
  }
}

main().catch(console.error);
