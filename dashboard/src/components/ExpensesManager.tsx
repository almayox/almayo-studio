"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { Modal } from "@/components/ui/Modal";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import {
  EmptyState,
  PageHeader,
  SummaryCards,
  fieldClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
  ActionGroup,
} from "@/components/ui/PageChrome";
import { ActionButton } from "@/components/ui/ActionButton";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";
import type { Expense } from "@/lib/types";

const emptyForm = {
  title: "",
  amount: "",
  currency: "KWD",
  category: "",
  merchantName: "",
  paymentMethod: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
  receiptUrl: "",
};

export function ExpensesManager({ initialExpenses }: { initialExpenses: Expense[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const [saving, setSaving] = useState(false);
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of initialExpenses) {
      if (item.category) set.add(item.category);
    }
    return [...set].sort();
  }, [initialExpenses]);

  const totals = useMemo(() => {
    return initialExpenses.reduce<Record<string, number>>((acc, item) => {
      const key = item.currency || "KWD";
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
  }, [initialExpenses]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialExpenses) {
      if (currencyFilter !== "all" && item.currency !== currencyFilter) continue;
      const key = item.category || "Uncategorized";
      map.set(key, (map.get(key) || 0) + Number(item.amount || 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [initialExpenses, currencyFilter]);

  const filtered = useMemo(() => {
    let rows = initialExpenses;
    if (currencyFilter !== "all") {
      rows = rows.filter((e) => e.currency === currencyFilter);
    }
    if (categoryFilter !== "all") {
      rows = rows.filter((e) => (e.category || "Uncategorized") === categoryFilter);
    }
    return filterBySearch(rows, search, (e) =>
      [e.title, e.category, e.merchant_name, e.payment_method, e.notes]
        .filter(Boolean)
        .join(" "),
    );
  }, [initialExpenses, currencyFilter, categoryFilter, search]);

  const pagination = usePagination(filtered, 10);

  function close() {
    setOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setError(null);
  }

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setError(null);
    setOpen(true);
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      title: expense.title,
      amount: String(expense.amount),
      currency: expense.currency || "KWD",
      category: expense.category || "",
      merchantName: expense.merchant_name || "",
      paymentMethod: expense.payment_method || "",
      date: expense.date,
      notes: expense.notes || "",
      receiptUrl: expense.receipt_url || "",
    });
    setError(null);
    setOpen(true);
  }

  async function uploadReceipt(files: FileList) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setUploadPhase("uploading");
    setError(null);
    try {
      const publicUrl = await uploadStudioFile(file, {
        folder: "expenses",
        onPhase: setUploadPhase,
      });
      setForm((p) => ({ ...p, receiptUrl: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadPhase(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      title: form.title,
      amount: Number(form.amount),
      currency: form.currency,
      category: form.category || null,
      merchant_name: form.merchantName || null,
      payment_method: form.paymentMethod || null,
      date: form.date,
      notes: form.notes || null,
      receipt_url: form.receiptUrl || null,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", editingId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("expenses").insert(payload);
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    close();
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track business spending by currency and category."
        action={
          <button type="button" onClick={startCreate} className={primaryBtnClass}>
            Add expense
          </button>
        }
      />

      <SummaryCards
        items={[
          { label: "Total expenses", value: initialExpenses.length, tone: "blue" },
          ...Object.entries(totals).map(([cur, total]) => ({
            label: `Total ${cur}`,
            value: total.toFixed(2),
            tone: "slate" as const,
          })),
        ]}
      />

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title, merchant, category…"
        status={categoryFilter}
        onStatusChange={setCategoryFilter}
        statusLabel="Category"
        statusOptions={categories.map((c) => ({ value: c, label: c }))}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["all", ...Object.keys(totals)].map((cur) => (
          <button
            key={cur}
            type="button"
            onClick={() => setCurrencyFilter(cur)}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              currencyFilter === cur
                ? "border-navy bg-navy text-white"
                : "border-mist bg-white text-navy/65"
            }`}
          >
            {cur}
          </button>
        ))}
      </div>

      {byCategory.length ? (
        <div className="mb-5 rounded-2xl border border-mist bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-navy/45">
            By category
          </p>
          <ul className="mt-3 space-y-2">
            {byCategory.map(([cat, amount]) => (
              <li key={cat} className="flex items-center justify-between text-sm">
                <span className="text-navy/70">{cat}</span>
                <span className="font-medium text-navy">{amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState message="No expenses yet." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-mist bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-mist bg-foam text-xs uppercase tracking-wide text-navy/60">
              <tr>
                <th className="px-4 py-3 font-medium">Expense</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {pagination.pageItems.map((expense) => (
                <tr key={expense.id} className="hover:bg-foam/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{expense.title}</p>
                    <p className="text-xs text-navy/45">
                      {[expense.category, expense.merchant_name, expense.payment_method]
                        .filter(Boolean)
                        .join(" · ") || "-"}
                    </p>
                    {expense.receipt_url ? (
                      <a
                        href={expense.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-navy underline"
                      >
                        Receipt
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-navy/80">
                    {Number(expense.amount).toFixed(2)} {expense.currency}
                  </td>
                  <td className="hidden px-4 py-3 text-navy/70 sm:table-cell">
                    {expense.date}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionGroup>
                      <ActionButton
                        icon={Pencil}
                        label="Edit"
                        onClick={() => startEdit(expense)}
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Delete"
                        danger
                        onClick={() => remove(expense.id)}
                      />
                    </ActionGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            onPageChange={pagination.goTo}
            onPageSizeChange={pagination.changePageSize}
          />
        </div>
      )}

      <Modal
        open={open}
        onClose={close}
        title={editingId ? "Edit expense" : "Add expense"}
        description="Amount, merchant, payment method, and receipt."
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <label className={labelClass}>
            Title
            <input
              required
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Amount
              <input
                required
                type="number"
                step="0.001"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Currency
              <select
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                className={fieldClass}
              >
                {["KWD", "USD", "EUR", "ETB", "PLN"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Category
              <input
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Merchant
              <input
                value={form.merchantName}
                onChange={(e) => setForm((p) => ({ ...p, merchantName: e.target.value }))}
                className={fieldClass}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Payment method
              <input
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm((p) => ({ ...p, paymentMethod: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Date
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className={fieldClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Notes
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <DropUpload
            onFiles={uploadReceipt}
            accept="image/*,.pdf"
            disabled={uploading}
            className="flex flex-col items-center rounded-xl border-2 border-dashed border-mist bg-foam px-3 py-5 text-center text-sm text-navy/70"
          >
            {uploading
              ? uploadStatusLabel(uploadPhase)
              : form.receiptUrl
                ? "Replace receipt"
                : "Drop receipt"}
          </DropUpload>
          {form.receiptUrl ? (
            <a
              href={form.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-navy underline"
            >
              View current receipt
            </a>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={close} className={`flex-1 ${secondaryBtnClass}`}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className={`flex-1 ${primaryBtnClass}`}
            >
              {saving ? "Saving…" : editingId ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
