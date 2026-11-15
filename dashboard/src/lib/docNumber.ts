/**
 * Document numbering shared by invoices (INV-…) and quotations (QUO-…).
 */
import type { createClient } from "@/lib/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

/** Postgres error code for a unique constraint violation. */
export const UNIQUE_VIOLATION = "23505";

/**
 * Next document number: highest numeric suffix of all existing numbers + 1,
 * in the <PREFIX>-<year>-<3+ digits> format. Never derived from the row count,
 * so deleting a document cannot produce a number that is already taken.
 */
export function nextDocNumber(prefix: string, existing: string[]): string {
  let highest = 0;
  for (const value of existing) {
    const match = /(\d+)\s*$/.exec(value || "");
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isSafeInteger(n) && n > highest) highest = n;
  }
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(highest + 1).padStart(3, "0")}`;
}

export type NumberedInsertResult =
  | { ok: true; id: string; number: string }
  | { ok: false; message: string; duplicate: boolean };

/**
 * Inserts a row with a freshly computed document number. The number is
 * computed from what is in the database right now; a duplicate (someone else
 * created a document meanwhile, Postgres 23505) is retried once with a newly
 * computed number.
 */
export async function insertWithNextNumber(
  supabase: SupabaseBrowserClient,
  options: {
    table: string;
    numberColumn: string;
    prefix: string;
    values: Record<string, unknown>;
  },
): Promise<NumberedInsertResult> {
  const { table, numberColumn, prefix, values } = options;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: rows, error: numbersError } = await supabase
      .from(table)
      .select(numberColumn);
    if (numbersError) {
      return { ok: false, message: numbersError.message, duplicate: false };
    }

    const number = nextDocNumber(
      prefix,
      ((rows ?? []) as unknown as Record<string, unknown>[]).map((row) =>
        String(row[numberColumn] ?? ""),
      ),
    );
    const { data, error } = await supabase
      .from(table)
      .insert({ ...values, [numberColumn]: number })
      .select("id")
      .single();

    if (!error) return { ok: true, id: String(data.id), number };
    if (error.code === UNIQUE_VIOLATION && attempt === 0) continue;
    return {
      ok: false,
      message: error.message,
      duplicate: error.code === UNIQUE_VIOLATION,
    };
  }
  return { ok: false, message: "The number was just taken.", duplicate: true };
}
