"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Modal } from "@/components/ui/Modal";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import {
  EmptyState,
  PageHeader,
  SummaryCards,
  fieldClass,
  inlineSelectClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
  ActionGroup,
} from "@/components/ui/PageChrome";
import { ActionButton } from "@/components/ui/ActionButton";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import { Copy, Pencil, PenLine, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildSignerDeviceInfo, clientSignerPayload } from "@/lib/deviceFingerprint";
import { publicSiteUrl } from "@/lib/siteUrl";
import type { Client, Contract, ContractMilestone, Project } from "@/lib/types";

type ContractRow = Contract & {
  clients?: Pick<Client, "name"> | null;
  contract_milestones?: ContractMilestone[];
};

type MilestoneDraft = {
  id?: string;
  name: string;
  amount: string;
  discount_amount: string;
  currency: string;
  duration: string;
  due_date: string;
};

function token() {
  return crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
}

function emptyMilestone(currency = "KWD"): MilestoneDraft {
  return {
    name: "Milestone 1",
    amount: "",
    discount_amount: "",
    currency,
    duration: "",
    due_date: "",
  };
}

export function ContractsManager({
  initialContracts,
  clients,
  projects,
  prefill,
}: {
  initialContracts: ContractRow[];
  clients: Client[];
  projects: Project[];
  /** Opened from a project: start a new contract for that client and project. */
  prefill?: { clientId: string; projectId: string; open: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(prefill?.open));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState(() => {
    const project = prefill?.open ? projects.find((p) => p.id === prefill.projectId) : null;
    return project ? `${project.title} contract` : "";
  });
  const [clientId, setClientId] = useState(prefill?.clientId ?? "");
  const [projectId, setProjectId] = useState(prefill?.projectId ?? "");
  const [terms, setTerms] = useState("");
  const [termsAr, setTermsAr] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([emptyMilestone()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredContracts = useMemo(() => {
    let rows = filterBySearch(initialContracts, search, (row) =>
      [row.title, row.clients?.name, row.status, row.signed_by_name]
        .filter(Boolean)
        .join(" "),
    );
    if (statusFilter !== "all") {
      rows = rows.filter((row) => row.status === statusFilter);
    }
    return rows;
  }, [initialContracts, search, statusFilter]);

  const pagination = usePagination(filteredContracts, 10);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setClientId("");
    setProjectId("");
    setTerms("");
    setTermsAr("");
    setMilestones([emptyMilestone()]);
    setError(null);
  }

  function close() {
    setOpen(false);
    resetForm();
  }

  function startCreate() {
    resetForm();
    setOpen(true);
  }

  function startEdit(contract: ContractRow) {
    setEditingId(contract.id);
    setTitle(contract.title);
    setClientId(contract.client_id || "");
    setProjectId(contract.project_id || "");
    setTerms(contract.terms || "");
    setTermsAr(contract.terms_ar || "");
    const rows = (contract.contract_milestones || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    setMilestones(
      rows.length
        ? rows.map((m) => ({
            id: m.id,
            name: m.name,
            amount: String(m.amount),
            discount_amount:
              m.discount_amount != null ? String(m.discount_amount) : "",
            currency: m.currency || "KWD",
            duration: m.duration || "",
            due_date: m.due_date || "",
          }))
        : [emptyMilestone()],
    );
    setError(null);
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      title,
      client_id: clientId || null,
      project_id: projectId || null,
      terms: terms || null,
      terms_ar: termsAr || null,
    };

    let contractId = editingId;
    let oldMilestoneIds: string[] = [];

    if (editingId) {
      const { error: updateError } = await supabase
        .from("contracts")
        .update(payload)
        .eq("id", editingId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      // Remember the current milestones; they are only removed after the
      // replacement rows are safely inserted.
      const { data: oldMilestones, error: oldMilestonesError } = await supabase
        .from("contract_milestones")
        .select("id")
        .eq("contract_id", editingId);
      if (oldMilestonesError) {
        setError(oldMilestonesError.message);
        setSaving(false);
        return;
      }
      oldMilestoneIds = (oldMilestones || []).map((m) => m.id as string);
    } else {
      const { data: contract, error: contractError } = await supabase
        .from("contracts")
        .insert({
          ...payload,
          status: "draft",
          token: token(),
        })
        .select("id")
        .single();

      if (contractError) {
        setError(contractError.message);
        setSaving(false);
        return;
      }
      contractId = contract.id;
    }

    const validMilestones = milestones.filter((m) => m.name && m.amount !== "");
    if (validMilestones.length && contractId) {
      const { error: milestoneError } = await supabase.from("contract_milestones").insert(
        validMilestones.map((m, index) => ({
          contract_id: contractId,
          name: m.name,
          amount: Number(m.amount),
          discount_amount: m.discount_amount === "" ? null : Number(m.discount_amount),
          currency: m.currency || "KWD",
          duration: m.duration || null,
          due_date: m.due_date || null,
          sort_order: index,
        })),
      );
      if (milestoneError) {
        setError(milestoneError.message);
        setSaving(false);
        return;
      }
    }

    if (oldMilestoneIds.length) {
      const { error: deleteError } = await supabase
        .from("contract_milestones")
        .delete()
        .in("id", oldMilestoneIds);
      if (deleteError) {
        setError(
          `Contract saved, but the previous milestones could not be removed: ${deleteError.message}. Save again to retry.`,
        );
        setSaving(false);
        router.refresh();
        return;
      }
    }

    setSaving(false);
    close();
    router.refresh();
  }

  async function updateStatus(id: string, status: string) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("contracts")
      .update({ status })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this contract?")) return;
    setError(null);
    const supabase = createClient();
    const { error: milestoneError } = await supabase
      .from("contract_milestones")
      .delete()
      .eq("contract_id", id);
    if (milestoneError) {
      setError(milestoneError.message);
      return;
    }
    const { error: deleteError } = await supabase.from("contracts").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      router.refresh();
      return;
    }
    if (editingId === id) close();
    router.refresh();
  }

  async function copyLink(contractToken: string) {
    const link = `${publicSiteUrl()}/contract/${contractToken}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setError(`Could not copy automatically. Sign link: ${link}`);
      return;
    }
    setCopied(contractToken);
    setTimeout(() => setCopied(null), 1500);
  }

  async function signAsDeveloper(contract: ContractRow) {
    const name = window.prompt(
      "Your full legal name for the developer signature:",
      contract.developer_signed_name || "Almayo Yahya Ibrahim",
    );
    if (!name?.trim()) return;
    setError(null);
    const supabase = createClient();
    const ua = navigator.userAgent;
    const deviceInfo = buildSignerDeviceInfo(null, ua, clientSignerPayload());
    const { error: updateError } = await supabase
      .from("contracts")
      .update({
        developer_signed_name: name.trim(),
        developer_signed_at: new Date().toISOString(),
        developer_signer_device_info: deviceInfo,
      })
      .eq("id", contract.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Create agreements, send a sign link, track client signatures."
        action={
          <button type="button" onClick={startCreate} className={primaryBtnClass}>
            New contract
          </button>
        }
      />

      <SummaryCards
        items={[
          { label: "Total", value: initialContracts.length, tone: "blue" },
          {
            label: "Draft",
            value: initialContracts.filter((c) => c.status === "draft").length,
            tone: "slate",
          },
          {
            label: "Sent",
            value: initialContracts.filter((c) => c.status === "sent").length,
            tone: "yellow",
          },
          {
            label: "Signed",
            value: initialContracts.filter((c) => c.status === "signed").length,
            tone: "green",
          },
        ]}
      />

      {error && !open ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search contracts, client…"
        status={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={[
          { value: "draft", label: "Draft" },
          { value: "sent", label: "Sent" },
          { value: "signed", label: "Signed" },
          { value: "voided", label: "Voided" },
        ]}
      />

      {filteredContracts.length === 0 ? (
        <EmptyState
          message={
            initialContracts.length === 0
              ? "No contracts yet. Create your first agreement."
              : "No contracts match your filters."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-fg/60">
              <tr>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pagination.pageItems.map((contract) => (
                <tr key={contract.id} className="align-top hover:bg-subtle/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-fg">{contract.title}</p>
                    <p className="text-xs text-fg/50">
                      {contract.clients?.name || "No client"} ·{" "}
                      {contract.contract_milestones?.length || 0} milestone(s)
                    </p>
                    {contract.signed_by_name ? (
                      <p className="mt-1 text-xs text-emerald-700">
                        Client: {contract.signed_by_name}
                      </p>
                    ) : null}
                    {contract.developer_signed_at ? (
                      <p className="text-xs text-fg/50">
                        Developer: {contract.developer_signed_name || "Signed"}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700">Developer signature pending</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={contract.status}
                      onChange={(e) => updateStatus(contract.id, e.target.value)}
                      className={inlineSelectClass}
                    >
                      {["draft", "sent", "signed", "voided"].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <ActionGroup>
                      {!contract.developer_signed_at ? (
                        <ActionButton
                          icon={PenLine}
                          label="Sign as developer"
                          onClick={() => signAsDeveloper(contract)}
                        />
                      ) : null}
                      <ActionButton
                        icon={Pencil}
                        label="Edit"
                        onClick={() => startEdit(contract)}
                      />
                      <ActionButton
                        icon={Copy}
                        label={copied === contract.token ? "Copied" : "Copy sign link"}
                        onClick={() => copyLink(contract.token)}
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Delete"
                        danger
                        onClick={() => remove(contract.id)}
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
        title={editingId ? "Edit contract" : "New contract"}
        description="Terms, milestones, and client details for the agreement."
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
              options={clients.map((client) => ({
                value: client.id,
                label: client.name,
              }))}
            />
          </label>
          <label className={labelClass}>
            Project (optional)
            <SearchSelect
              value={projectId}
              onChange={setProjectId}
              placeholder="Search projects…"
              emptyLabel="No project"
              options={projects.map((project) => ({
                value: project.id,
                label: project.title,
              }))}
            />
          </label>
          <label className={labelClass}>
            Terms (English)
            <div className="mt-1.5">
              <RichTextEditor
                value={terms}
                onChange={setTerms}
                placeholder="Project scope, payment terms, timeline…"
              />
            </div>
          </label>
          <label className={labelClass}>
            Terms (Arabic)
            <div className="mt-1.5" dir="rtl">
              <RichTextEditor
                value={termsAr}
                onChange={setTermsAr}
                placeholder="الشروط والأحكام…"
              />
            </div>
          </label>

          <div className="space-y-3 rounded-xl border border-line bg-subtle/40 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-fg">Milestones</p>
              <button
                type="button"
                onClick={() =>
                  setMilestones((prev) => [
                    ...prev,
                    {
                      ...emptyMilestone(prev[0]?.currency || "KWD"),
                      name: `Milestone ${prev.length + 1}`,
                    },
                  ])
                }
                className="text-xs font-medium text-fg underline"
              >
                + Add
              </button>
            </div>
            {milestones.map((m, index) => (
              <div key={index} className="space-y-2 rounded-xl bg-surface p-2 ring-1 ring-line">
                <input
                  value={m.name}
                  onChange={(e) =>
                    setMilestones((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, name: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="Name"
                  className="w-full rounded-xl border border-line bg-subtle px-3 py-2 text-sm outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.001"
                    value={m.amount}
                    onChange={(e) =>
                      setMilestones((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, amount: e.target.value } : row,
                        ),
                      )
                    }
                    placeholder="Amount"
                    className="rounded-xl border border-line bg-subtle px-3 py-2 text-sm outline-none"
                  />
                  <input
                    type="number"
                    step="0.001"
                    value={m.discount_amount}
                    onChange={(e) =>
                      setMilestones((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, discount_amount: e.target.value } : row,
                        ),
                      )
                    }
                    placeholder="Discount"
                    className="rounded-xl border border-line bg-subtle px-3 py-2 text-sm outline-none"
                  />
                  <select
                    value={m.currency}
                    onChange={(e) =>
                      setMilestones((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, currency: e.target.value } : row,
                        ),
                      )
                    }
                    className="rounded-xl border border-line bg-subtle px-3 py-2 text-sm outline-none"
                  >
                    {["KWD", "USD", "EUR", "ETB", "PLN"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    value={m.duration}
                    onChange={(e) =>
                      setMilestones((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, duration: e.target.value } : row,
                        ),
                      )
                    }
                    placeholder="Duration"
                    className="rounded-xl border border-line bg-subtle px-3 py-2 text-sm outline-none"
                  />
                  <input
                    type="date"
                    value={m.due_date}
                    onChange={(e) =>
                      setMilestones((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, due_date: e.target.value } : row,
                        ),
                      )
                    }
                    className="col-span-2 rounded-xl border border-line bg-subtle px-3 py-2 text-sm outline-none"
                  />
                </div>
                {milestones.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setMilestones((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="text-xs text-red-700"
                  >
                    Remove milestone
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <p className="text-xs text-fg/50">
            Sign as developer first, then set status to <strong>sent</strong> and copy the sign
            link for the client.
          </p>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={close} className={`flex-1 ${secondaryBtnClass}`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
              {saving ? "Saving…" : editingId ? "Save contract" : "Create contract"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
