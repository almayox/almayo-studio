export function parseUserAgent(ua: string) {
  const browser =
    /Edg\//.test(ua)
      ? `Edge ${ua.match(/Edg\/([\d]+)/)?.[1] ?? ""}`
      : /OPR\//.test(ua)
        ? `Opera ${ua.match(/OPR\/([\d]+)/)?.[1] ?? ""}`
        : /Chrome\//.test(ua)
          ? `Chrome ${ua.match(/Chrome\/([\d]+)/)?.[1] ?? ""}`
          : /Firefox\//.test(ua)
            ? `Firefox ${ua.match(/Firefox\/([\d]+)/)?.[1] ?? ""}`
            : /Version\//.test(ua) && /Safari\//.test(ua)
              ? `Safari ${ua.match(/Version\/([\d]+)/)?.[1] ?? ""}`
              : "Unknown";

  const os =
    /iPhone/.test(ua)
      ? "iOS (iPhone)"
      : /iPad/.test(ua)
        ? "iPadOS"
        : /Android/.test(ua)
          ? `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ""}`.trim()
          : /Windows NT ([\d.]+)/.test(ua)
            ? `Windows (NT ${ua.match(/Windows NT ([\d.]+)/)?.[1] ?? ""})`
            : /Mac OS X/.test(ua)
              ? `macOS ${(ua.match(/Mac OS X ([\d_]+)/)?.[1] ?? "").replace(/_/g, ".")}`.trim()
              : /Linux/.test(ua)
                ? "Linux"
                : "Unknown";

  const device =
    /iPhone/.test(ua) || (/Mobile/.test(ua) && !/iPad/.test(ua))
      ? "Mobile"
      : /iPad/.test(ua)
        ? "Tablet"
        : "Desktop";

  return { browser: browser.trim(), os: os.trim(), device };
}

export type SignerDevicePayload = {
  timezone?: string;
  language?: string;
  screenResolution?: string;
  platform?: string;
  vendor?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  cookieEnabled?: boolean;
  pdfViewerEnabled?: boolean;
  maxTouchPoints?: number;
};

export function buildSignerDeviceInfo(
  ip: string | null,
  ua: string,
  client: SignerDevicePayload,
) {
  const parsed = parseUserAgent(ua);
  return JSON.stringify({
    ip,
    browser: parsed.browser,
    os: parsed.os,
    device: parsed.device,
    timezone: client.timezone ?? null,
    language: client.language ?? null,
    screenResolution: client.screenResolution ?? null,
    platform: client.platform ?? null,
    vendor: client.vendor ?? null,
    hardwareConcurrency: client.hardwareConcurrency ?? null,
    deviceMemory: client.deviceMemory ?? null,
    cookieEnabled: client.cookieEnabled ?? null,
    pdfViewerEnabled: client.pdfViewerEnabled ?? null,
    maxTouchPoints: client.maxTouchPoints ?? null,
    userAgent: ua,
    capturedAt: new Date().toISOString(),
  });
}

export function clientSignerPayload(): SignerDevicePayload {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    pdfViewerEnabled?: boolean;
  };
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    platform: navigator.platform,
    vendor: navigator.vendor,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    cookieEnabled: navigator.cookieEnabled,
    pdfViewerEnabled: nav.pdfViewerEnabled,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}
