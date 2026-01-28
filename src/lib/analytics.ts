type GtagFn = (
  command: "event" | "config" | "js",
  eventNameOrDate: string | Date,
  params?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

export function track(eventName: string, params?: Record<string, unknown>) {
  try {
    if (typeof window === "undefined") return;
    if (typeof window.gtag !== "function") return;
    window.gtag("event", eventName, params ?? {});
  } catch {
    // no-op
  }
}
