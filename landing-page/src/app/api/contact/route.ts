import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import {
  isHoneypotTriggered,
  validateContactForm,
  type ContactFormInput,
} from "@/lib/contactValidation";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limit = await checkRateLimit({
      key: `contact:${ip}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: "Too many messages sent. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSec ?? 3600) },
        },
      );
    }

    const body = (await request.json()) as ContactFormInput;

    if (isHoneypotTriggered(body.companyWebsite)) {
      return NextResponse.json({ success: true });
    }

    const result = validateContactForm(body);
    if (!result.ok) {
      const firstError = Object.values(result.errors)[0] ?? "Invalid form data.";
      return NextResponse.json(
        { message: firstError, fieldErrors: result.errors },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("leads").insert({
      full_name: result.data.fullName,
      email: result.data.email,
      phone: result.data.phone,
      service_interested: result.data.service,
      message: result.data.message,
      stage: "new",
      source: "contact_form",
    });

    if (error) {
      return NextResponse.json(
        { message: "Could not send message. Please try again later." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: "Could not send message. Please try again later." },
      { status: 500 },
    );
  }
}
