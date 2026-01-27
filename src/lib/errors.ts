/**
 * Prevent leaking internal implementation details (DB/RLS/table names) to end-users.
 */
export function sanitizeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  const lower = msg.toLowerCase();

  if (!msg) return "حصل خطأ. جرّب تاني.";

  // Auth / session
  if (lower.includes("unauthorized") || lower.includes("jwt") || lower.includes("not authenticated")) {
    return "محتاج تسجّل دخول الأول.";
  }

  // Networking
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("cors")) {
    return "في مشكلة اتصال. جرّب تاني أو بدّل الشبكة.";
  }

  // Rate limits / billing
  if (lower.includes("rate") && lower.includes("limit")) {
    return "في ضغط عالي دلوقتي. جرّب بعد دقيقة.";
  }
  if (lower.includes("payment required") || lower.includes("402")) {
    return "خدمة الذكاء الاصطناعي محتاجة تفعيل الرصيد.";
  }

  // Database-ish / policy leakage
  if (lower.includes("rls") || lower.includes("policy") || lower.includes("permission")) {
    return "مش مسموح بالعملية دي.";
  }
  if (lower.includes("foreign key") || lower.includes("constraint") || lower.includes("duplicate")) {
    return "في مشكلة في البيانات. جرّب تاني.";
  }

  // Default
  return "حصل خطأ. جرّب تاني.";
}
