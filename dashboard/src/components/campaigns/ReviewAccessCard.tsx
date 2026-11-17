"use client";

import { useState } from "react";
import {
  controlRowClass,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui/PageChrome";
import { newReviewToken, reviewUrl, type CampaignRow } from "@/lib/campaigns";
import { hashPassword } from "@/lib/password";
import type { CampaignWrite } from "@/components/campaigns/hooks";

function expiryDate(campaign: CampaignRow) {
  return campaign.review_token_expires_at ? campaign.review_token_expires_at.slice(0, 10) : "";
}

/** The client review link of a campaign: copy, disable, password and expiry. */
export function ReviewAccessCard({
  campaign,
  write,
  copied,
  onCopyLink,
}: {
  campaign: CampaignRow;
  write: CampaignWrite;
  /** True right after this campaign's link was copied. */
  copied: boolean;
  onCopyLink: (reviewToken: string) => void;
}) {
  const [passwordDraft, setPasswordDraft] = useState("");
  const [expiryDraft, setExpiryDraft] = useState(expiryDate(campaign));

  // Keep the expiry draft in sync with the campaign (also after a refresh
  // delivers new data). Adjusted during render instead of in an effect.
  const [expirySource, setExpirySource] = useState(campaign);
  if (expirySource !== campaign) {
    setExpirySource(campaign);
    setExpiryDraft(expiryDate(campaign));
  }

  const update = (values: Record<string, unknown>) =>
    write((supabase) => supabase.from("campaigns").update(values).eq("id", campaign.id));

  async function savePassword() {
    const password = passwordDraft.trim();
    const saved = await update({
      review_password_hash: password ? await hashPassword(password) : null,
    });
    if (saved) setPasswordDraft("");
  }

  async function clearPassword() {
    if (!window.confirm("Remove review password?")) return;
    if (await update({ review_password_hash: null })) setPasswordDraft("");
  }

  function regenerateLink() {
    if (!window.confirm("Regenerate review link? The old link will stop working.")) return;
    update({ review_token: newReviewToken() });
  }

  function saveExpiry() {
    update({
      review_token_expires_at: expiryDraft
        ? new Date(`${expiryDraft}T23:59:59`).toISOString()
        : null,
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-medium text-fg">Client review link</p>
      <code className="mt-2 block overflow-x-auto rounded-lg bg-subtle px-3 py-2 text-xs text-fg/80">
        {reviewUrl(campaign.review_token)}
      </code>
      <div className={`mt-3 ${controlRowClass}`}>
        <button
          type="button"
          onClick={() => onCopyLink(campaign.review_token)}
          className={secondaryBtnClass}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={reviewUrl(campaign.review_token)}
          target="_blank"
          rel="noopener noreferrer"
          className={secondaryBtnClass}
        >
          Open
        </a>
        <button
          type="button"
          onClick={() => update({ review_disabled: !campaign.review_disabled })}
          className={secondaryBtnClass}
        >
          {campaign.review_disabled ? "Enable review" : "Disable review"}
        </button>
        <button type="button" onClick={regenerateLink} className={secondaryBtnClass}>
          New link
        </button>
      </div>
      {campaign.review_disabled ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Review link is disabled. Clients cannot access this campaign.
        </p>
      ) : null}

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-sm font-medium text-fg">
          Review password{" "}
          <span className="font-normal text-fg/50">
            {campaign.review_password_hash ? "(set)" : "(none)"}
          </span>
        </p>
        <div className={`mt-2 ${controlRowClass}`}>
          <input
            type="password"
            value={passwordDraft}
            onChange={(e) => setPasswordDraft(e.target.value)}
            placeholder="New password"
            className={`min-w-0 flex-1 ${fieldClass}`}
          />
          <button type="button" onClick={savePassword} className={primaryBtnClass}>
            Save
          </button>
          {campaign.review_password_hash ? (
            <button type="button" onClick={clearPassword} className={secondaryBtnClass}>
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-sm font-medium text-fg">Link expiry</p>
        <div className={`mt-2 ${controlRowClass}`}>
          <input
            type="date"
            value={expiryDraft}
            onChange={(e) => setExpiryDraft(e.target.value)}
            className={`min-w-0 flex-1 ${fieldClass}`}
          />
          <button type="button" onClick={saveExpiry} className={secondaryBtnClass}>
            {expiryDraft ? "Set expiry" : "Clear expiry"}
          </button>
        </div>
        {campaign.review_token_expires_at ? (
          <p className="mt-2 text-xs text-amber-700">
            Expires {new Date(campaign.review_token_expires_at).toLocaleDateString()}
          </p>
        ) : null}
      </div>
    </div>
  );
}
