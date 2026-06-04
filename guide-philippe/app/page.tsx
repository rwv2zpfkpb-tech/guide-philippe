import { createClient } from "@/utils/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, cuisine, price_level, spoon_rating")
    .order("created_at", { ascending: false })
    .limit(12);

  return (
    <ul>
      {restaurants?.map((r) => (
        <li key={r.id}>
          {r.name} — {r.cuisine}
        </li>
      ))}
    </ul>
  );
}
