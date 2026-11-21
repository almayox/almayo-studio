"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  fieldClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui/PageChrome";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { PlatformPicker } from "@/components/campaigns/PlatformPicker";
import {
  PLATFORM_OPTIONS,
  newReviewToken,
  parsePlatforms,
  type CampaignRow,
} from "@/lib/campaigns";
import { hashPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleDateString(undefined, { month: "long" }),
);

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Month and year pickers that store "YYYY-MM". */
function MonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const year = match ? Number(match[1]) : new Date().getFullYear();
  const month = match ? Number(match[2]) : new Date().getMonth() + 1;
  const thisYear = new Date().getFullYear();
  const years = Array.from(new Set([year, thisYear - 1, thisYear, thisYear + 1])).sort();
  const set = (nextYear: number, nextMonth: number) =>
    onChange(`${nextYear}-${String(nextMonth).padStart(2, "0")}`);

  return (
    <div className="grid grid-cols-[1fr_7rem] gap-2">
      <select
        aria-label="Month"
        value={month}
        onChange={(e) => set(year, Number(e.target.value))}
        className={fieldClass}
      >
        {MONTH_NAMES.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        value={year}
        onChange={(e) => set(Number(e.target.value), month)}
        className={fieldClass}
      >
        {years.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The create / edit dialog. Mount it to open it; it starts from `editing`. */
export function CampaignForm({
  editing,
  clients,
  onClose,
  onSaved,
}: {
  /** The campaign being edited, or null for a new one. */
  editing: CampaignRow | null;
  clients: Pick<Client, "id" | "name">[];
  onClose: () => void;
  /** Called after a successful save, with the id of a newly created campaign. */
  onSaved: (createdId: string | null) => void;
}) {
  const [title, setTitle] = useState(editing?.title || "");
  const [clientId, setClientId] = useState(editing?.client_id || "");
  const [month, setMonth] = useState(editing?.month || currentMonth());
  const [platforms, setPlatforms] = useState(
    editing ? parsePlatforms(editing.platforms) : ["Instagram"],
  );
  const [note, setNote] = useState(editing?.objectives || "");
  const [reviewPassword, setReviewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(): Promise<{ error: string } | { createdId: string | null }> {
    if (!clientId) return { error: "Choose the client this campaign is for." };
    const supabase = createClient();
    const password = reviewPassword.trim();
    const payload = {
      title: title.trim(),
      client_id: clientId,
      month,
      platforms: platforms.join(", ") || null,
      objectives: note.trim() || null,
    };

    if (editing) {
      const { error: updateError } = await supabase
        .from("campaigns")
        .update(
          password ? { ...payload, review_password_hash: await hashPassword(password) } : payload,
        )
        .eq("id", editing.id);
      return updateError ? { error: updateError.message } : { createdId: null };
    }

    const { data: created, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        ...payload,
        status: "draft",
        review_token: newReviewToken(),
        review_password_hash: password ? await hashPassword(password) : null,
        review_disabled: false,
      })
      .select("id")
      .single();
    if (insertError) return { error: insertError.message };
    return { createdId: created?.id ?? null };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await save();
    setSaving(false);
    if ("error" in result) return setError(result.error);
    onSaved(result.createdId);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit campaign" : "New campaign"}
      description="A month of content for one client."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className={labelClass}>
          Client
          <SearchSelect
            value={clientId}
            onChange={setClientId}
            placeholder="Search clients…"
            emptyLabel="Select client"
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
          />
        </label>
        <label className={labelClass}>
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="December content"
            className={fieldClass}
          />
        </label>
        <div className={labelClass}>
          Month
          <MonthPicker value={month} onChange={setMonth} />
        </div>
        <div className={labelClass}>
          Platforms
          <PlatformPicker options={PLATFORM_OPTIONS} value={platforms} onChange={setPlatforms} />
        </div>
        <label className={labelClass}>
          Note for the client (optional)
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Shown at the top of the review page."
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Review password {editing ? "(leave blank to keep)" : "(optional)"}
          <input
            type="password"
            autoComplete="new-password"
            value={reviewPassword}
            onChange={(e) => setReviewPassword(e.target.value)}
            className={fieldClass}
          />
        </label>
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryBtnClass}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
            {saving ? "Saving…" : editing ? "Save campaign" : "Create campaign"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
