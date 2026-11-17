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
import { newReviewToken, type CampaignRow } from "@/lib/campaigns";
import { hashPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

/** The create / edit dialog. Mount it to open it; it starts from `editing`. */
export function CampaignForm({
  editing,
  clients,
  projects,
  onClose,
  onSaved,
}: {
  /** The campaign being edited, or null for a new one. */
  editing: CampaignRow | null;
  clients: Client[];
  projects: { id: string; title: string }[];
  onClose: () => void;
  /** Called after a successful save, with the id of a newly created campaign. */
  onSaved: (createdId: string | null) => void;
}) {
  const [title, setTitle] = useState(editing?.title || "");
  const [clientId, setClientId] = useState(editing?.client_id || "");
  const [projectId, setProjectId] = useState(editing?.project_id || "");
  const [month, setMonth] = useState(editing?.month || "");
  const [objectives, setObjectives] = useState(editing?.objectives || "");
  const [platforms, setPlatforms] = useState(editing ? editing.platforms || "" : "Instagram, TikTok");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [reviewPassword, setReviewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Returns an error message, or the id of the created campaign (null when editing). */
  async function save(): Promise<{ error: string } | { createdId: string | null }> {
    const supabase = createClient();
    const password = reviewPassword.trim();
    const payload = {
      title,
      client_id: clientId || null,
      project_id: projectId || null,
      month: month || null,
      objectives: objectives || null,
      platforms: platforms || null,
      notes: notes || null,
    };

    if (editing) {
      const { error: updateError } = await supabase
        .from("campaigns")
        .update(payload)
        .eq("id", editing.id);
      if (updateError) return { error: updateError.message };
      if (password) {
        const { error: passwordError } = await supabase
          .from("campaigns")
          .update({ review_password_hash: await hashPassword(password) })
          .eq("id", editing.id);
        if (passwordError) {
          return {
            error: `Details saved, but the review password was not: ${passwordError.message}`,
          };
        }
      }
      return { createdId: null };
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
      description="Campaign details and optional review password."
      wide
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className={labelClass}>
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClass}
          />
        </label>
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
          Project
          <SearchSelect
            value={projectId}
            onChange={setProjectId}
            placeholder="Search projects…"
            emptyLabel="Select project"
            options={projects.map((project) => ({ value: project.id, label: project.title }))}
          />
        </label>
        <label className={labelClass}>
          Month
          <input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="2026-07"
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Platforms
          <input
            value={platforms}
            onChange={(e) => setPlatforms(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Objectives
          <textarea
            rows={3}
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Internal notes
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Review password {editing ? "(leave blank to keep)" : "(optional)"}
          <input
            type="password"
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
        <p className="text-xs text-fg/50">
          After creating, click <strong>Manage</strong> on the row to add posts, carousels, or
          reels. Set status to <strong>review</strong>, then copy the review link.
        </p>
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
