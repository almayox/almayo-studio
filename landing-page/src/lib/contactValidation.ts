export type ContactFormInput = {
  fullName: string;
  email: string;
  phone: string;
  service?: string;
  message: string;
  companyWebsite?: string;
};

export type ContactFormErrors = Partial<
  Record<"fullName" | "email" | "phone" | "service" | "message", string>
>;

export type SanitizedContactForm = {
  fullName: string;
  email: string;
  phone: string;
  service: string | null;
  message: string;
};

const EMAIL_RE =
  /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'.\-\s]*[\p{L}\p{M}.]?$/u;

function hasEnoughLetters(name: string): boolean {
  const letters = name.match(/[\p{L}\p{M}]/gu);
  return (letters?.length ?? 0) >= 2;
}

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function isValidEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  if (value.length > 254 || !EMAIL_RE.test(value)) return false;
  const domain = value.split("@")[1];
  if (!domain || domain.length < 4) return false;
  const tld = domain.split(".").pop();
  return Boolean(tld && tld.length >= 2);
}

export function validateContactForm(
  input: ContactFormInput,
): { ok: true; data: SanitizedContactForm } | { ok: false; errors: ContactFormErrors } {
  const errors: ContactFormErrors = {};

  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2) {
    errors.fullName = "Enter your full name (at least 2 characters).";
  } else if (fullName.length > 100) {
    errors.fullName = "Name is too long.";
  } else if (!NAME_RE.test(fullName) || !hasEnoughLetters(fullName)) {
    errors.fullName = "Use letters for your name.";
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(email)) {
    errors.email = "Enter a valid email address (example: name@company.com).";
  }

  const phone = input.phone.trim();
  const digits = phoneDigits(phone);
  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (digits.length < 7 || digits.length > 15) {
    errors.phone = "Enter a valid phone number (7 to 15 digits).";
  }

  const serviceRaw = (input.service ?? "").trim();
  if (serviceRaw.length > 200) {
    errors.service = "Service description is too long.";
  } else if (serviceRaw && serviceRaw.length < 2) {
    errors.service = "Describe the service in a few words.";
  }

  const message = input.message.trim().replace(/\s+/g, " ");
  if (message.length < 15) {
    errors.message = "Message must be at least 15 characters.";
  } else if (message.length > 5000) {
    errors.message = "Message is too long.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      fullName,
      email,
      phone: digits,
      service: serviceRaw || null,
      message,
    },
  };
}

export function isHoneypotTriggered(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}
