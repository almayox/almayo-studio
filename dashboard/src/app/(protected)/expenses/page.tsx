import { ExpensesManager } from "@/components/ExpensesManager";
import { createClient } from "@/lib/supabase/server";
import type { Expense } from "@/lib/types";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });

  return <ExpensesManager initialExpenses={(data as Expense[]) ?? []} />;
}
