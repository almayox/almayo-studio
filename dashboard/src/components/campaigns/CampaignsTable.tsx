"use client";

import { Copy, Eye, EyeOff, Pencil, Settings2, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ActionGroup, inlineSelectClass } from "@/components/ui/PageChrome";
import { CAMPAIGN_STATUS_OPTIONS, type CampaignRow } from "@/lib/campaigns";

export function CampaignsTable({
  rows,
  selectedId,
  copiedToken,
  onManage,
  onEdit,
  onCopyLink,
  onToggleReview,
  onDelete,
  onStatusChange,
}: {
  rows: CampaignRow[];
  /** The campaign open in the manage panel, if any. */
  selectedId: string | null;
  /** Review token whose link was just copied. */
  copiedToken: string | null;
  onManage: (row: CampaignRow) => void;
  onEdit: (row: CampaignRow) => void;
  onCopyLink: (reviewToken: string) => void;
  onToggleReview: (row: CampaignRow) => void;
  onDelete: (row: CampaignRow) => void;
  onStatusChange: (row: CampaignRow, status: string) => void;
}) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-fg/60">
        <tr>
          <th className="px-4 py-3 font-medium">Campaign</th>
          <th className="px-4 py-3 font-medium">Status</th>
          <th className="px-4 py-3 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => (
          <tr
            key={row.id}
            className={`align-middle hover:bg-subtle/40 ${
              selectedId === row.id ? "bg-subtle/70" : ""
            }`}
          >
            <td className="px-4 py-3">
              <p className="font-medium text-fg">{row.title}</p>
              <p className="text-xs text-fg/50">
                {row.clients?.name || "No client"} · {row.campaign_assets?.length || 0} assets
                {row.review_password_hash ? " · password" : ""}
                {row.review_disabled ? " · review off" : ""}
              </p>
              {row.client_decision ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Decision: {row.client_decision}
                  {row.client_approved_by_name ? ` by ${row.client_approved_by_name}` : ""}
                </p>
              ) : null}
            </td>
            <td className="px-4 py-3">
              <select
                value={row.status}
                onChange={(e) => onStatusChange(row, e.target.value)}
                aria-label={`Status of ${row.title}`}
                className={inlineSelectClass}
              >
                {CAMPAIGN_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.value}
                  </option>
                ))}
              </select>
            </td>
            <td className="px-4 py-3">
              <ActionGroup>
                <ActionButton icon={Settings2} label="Manage" onClick={() => onManage(row)} />
                <ActionButton icon={Pencil} label="Edit" onClick={() => onEdit(row)} />
                <ActionButton
                  icon={Copy}
                  label="Copy review link"
                  title={copiedToken === row.review_token ? "Copied!" : "Copy review link"}
                  onClick={() => onCopyLink(row.review_token)}
                  disabled={row.review_disabled}
                />
                <ActionButton
                  icon={row.review_disabled ? Eye : EyeOff}
                  label={row.review_disabled ? "Enable review" : "Disable review"}
                  onClick={() => onToggleReview(row)}
                />
                <ActionButton icon={Trash2} label="Delete" danger onClick={() => onDelete(row)} />
              </ActionGroup>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
