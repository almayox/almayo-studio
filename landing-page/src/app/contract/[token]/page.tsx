import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContractByToken } from "@/lib/contractServer";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { ContractSignForm } from "./ContractSignForm";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Sign contract",
  robots: { index: false, follow: false },
};

export default async function ContractPage({ params }: Props) {
  const { token } = await params;
  if (!hasSupabaseEnv()) notFound();

  const contract = await getContractByToken(token);
  if (!contract) notFound();

  const milestones = (contract.contract_milestones || []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
  );

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:px-6">
      <ContractSignForm
        token={token}
        title={contract.title}
        terms={contract.terms}
        termsAr={contract.terms_ar}
        milestones={milestones}
        alreadySigned={contract.status === "signed"}
        signedByName={contract.signed_by_name}
        developerSignedName={contract.developer_signed_name}
        developerSignedAt={contract.developer_signed_at}
        signerIp={contract.signer_ip}
        signerDeviceInfo={contract.signer_device_info}
      />
    </div>
  );
}
