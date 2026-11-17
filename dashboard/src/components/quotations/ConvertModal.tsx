"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui/PageChrome";
import {
  convertQuotationToInvoice,
  effectiveStatus,
  type QuotationRow,
} from "@/lib/quotations";
import { createClient } from "@/lib/supabase/client";

/** Confirms and runs the one-way conversion of a quotation into an invoice. */
export function ConvertModal({
  quotationId,
  quotation,
  today,
  onClose,
  onConverted,
}: {
  quotationId: string;
  /** Null when the quotation is no longer in the list. */
  quotation: QuotationRow | null;
  today: string;
  onClose: () => void;
  onConverted: (invoiceNumber: string) => void;
}) {
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (!converting) onClose();
  }

  async function convert() {
    if (converting) return;
    setConverting(true);
    setError(null);
    const result = await convertQuotationToInvoice(createClient(), quotationId);
    setConverting(false);

    if (result.ok) {
      onConverted(result.invoiceNumber);
      router.refresh();
      return;
    }
    setError(result.message);
    if (result.refresh) router.refresh();
  }

  return (
    <Modal
      open
      onClose={close}
      title="Convert to invoice"
      description={quotation ? quotation.quote_number : undefined}
    >
      <div className="space-y-3">
        {quotation ? (
          <p className="text-sm text-fg/80">
            A draft invoice for{" "}
            <span className="font-semibold text-fg">
              {Number(quotation.total).toFixed(2)} {quotation.currency}
            </span>{" "}
            will be created for {quotation.client_name}, with the same line items, discount and
            tax. The quotation is marked as accepted and locked.
          </p>
        ) : null}
        {quotation && effectiveStatus(quotation, today) === "expired" ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This quotation is past its validity date ({quotation.valid_until}).
          </p>
        ) : null}
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          This cannot be undone. A quotation can be converted only once, and an invoice can never
          be turned back into a quotation.
        </p>
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            disabled={converting}
            className={`flex-1 ${secondaryBtnClass}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={convert}
            disabled={converting}
            className={`flex-1 ${primaryBtnClass}`}
          >
            {converting ? "Converting…" : "Convert to invoice"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
