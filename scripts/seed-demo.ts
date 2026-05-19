import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, key);

async function main() {
  const { data: sales } = await supabase
    .from("sales_people")
    .upsert(
      { name: "Jan Kowalski", email: "jan.kowalski@example.com" },
      { onConflict: "email" }
    )
    .select()
    .single();

  const suppliers = [
    { name: "Dentaur Polska", location: "POLSKA", interval_weeks: 2 },
    { name: "Euro Dental", location: "ZAGRANICA", interval_weeks: 3 },
    { name: "Import Med", location: "IMPORT", interval_weeks: 4 },
  ] as const;

  for (const s of suppliers) {
    const { data } = await supabase
      .from("suppliers")
      .upsert(
        {
          name: s.name,
          location: s.location,
          interval_weeks: s.interval_weeks,
          pickup_mikran: true,
          notes: "MAILOWO",
          mails: "orders@example.com",
        },
        { onConflict: "name" }
      )
      .select("id")
      .single();
    if (data) {
      await supabase
        .from("supplier_schedules")
        .upsert({ supplier_id: data.id }, { onConflict: "supplier_id" });
    }
  }

  if (sales) {
    const { data: sup } = await supabase.from("suppliers").select("id").limit(1).single();
    if (sup) {
      await supabase.from("individual_orders").insert({
        supplier_id: sup.id,
        sales_person_id: sales.id,
        products: "Produkt demo",
        quantity: "2",
        status: "Nowe",
      });
    }
  }

  console.log("Seed demo OK");
}

main().catch(console.error);
