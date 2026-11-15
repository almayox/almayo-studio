import { NextResponse } from "next/server";
import {
  buildSignerDeviceInfo,
  type SignerDevicePayload,
} from "@/lib/deviceFingerprint";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp, readJsonObject, stringField } from "@/lib/rateLimit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = clientIp(request);
  const limit = await checkRateLimit({
    key: `contract-sign:${ip}:${token}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const trimmedName = stringField(body.signedByName, 120);
  if (!trimmedName) {
    return NextResponse.json({ message: "Full name is required to sign" }, { status: 400 });
  }
  if (trimmedName.length < 5) {
    return NextResponse.json(
      { message: "Full name must be at least 5 characters" },
      { status: 400 },
    );
  }
  if (!/^[a-zA-Z ]+$/.test(trimmedName)) {
    return NextResponse.json(
      { message: "Name may only contain letters and spaces" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: contract, error: fetchError } = await supabase
    .from("contracts")
    .select("id, status, developer_signed_at")
    .eq("token", token)
    .maybeSingle();

  if (fetchError || !contract) {
    return NextResponse.json({ message: "Contract not found" }, { status: 404 });
  }
  if (contract.status === "signed") {
    return NextResponse.json({ message: "Contract already signed" }, { status: 409 });
  }
  if (contract.status !== "sent") {
    return NextResponse.json(
      { message: "Contract is not available for signing" },
      { status: 400 },
    );
  }

  if (!contract.developer_signed_at) {
    return NextResponse.json(
      { message: "This contract is not ready for signing yet." },
      { status: 409 },
    );
  }

  const signerIp = ip === "unknown" ? null : ip;
  const ua = request.headers.get("user-agent") || "";
  const signerDeviceInfo = buildSignerDeviceInfo(signerIp, ua, body as SignerDevicePayload);

  const { data: updated, error: updateError } = await supabase
    .from("contracts")
    .update({
      status: "signed",
      signed_by_name: trimmedName,
      signed_at: new Date().toISOString(),
      signer_ip: signerIp,
      signer_device_info: signerDeviceInfo,
    })
    .eq("id", contract.id)
    .eq("status", "sent")
    .not("developer_signed_at", "is", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("contract sign failed", updateError.message);
    return NextResponse.json(
      { message: "Could not sign the contract. Please try again." },
      { status: 500 },
    );
  }
  if (!updated) {
    return NextResponse.json(
      { message: "Contract is no longer available for signing" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, message: "Contract signed successfully" });
}
