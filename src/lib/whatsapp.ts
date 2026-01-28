export type WhatsAppSharePayload = {
  title?: string | null;
  description?: string | null;
  sellingPoints?: string[] | null;
  price?: string | null;
  hashtags?: string[] | null;
  orderLink?: string | null;
};

export function buildWhatsAppText(p: WhatsAppSharePayload) {
  const lines: string[] = [];

  if (p.title) lines.push(String(p.title).trim());
  lines.push("");

  if (p.description) {
    lines.push(String(p.description).trim());
    lines.push("");
  }

  const selling = (p.sellingPoints ?? []).filter(Boolean);
  if (selling.length) {
    lines.push(...selling.map((x) => `✓ ${String(x).trim()}`));
    lines.push("");
  }

  if (p.price) {
    lines.push(`💰 السعر: ${String(p.price).trim()}`);
    lines.push("");
  }

  if (p.orderLink) {
    lines.push(`📲 للطلب: ${String(p.orderLink).trim()}`);
    lines.push("");
  }

  const tags = (p.hashtags ?? []).filter(Boolean);
  if (tags.length) lines.push(tags.map((x) => String(x).trim()).join(" "));

  return lines
    .map((l) => l.replace(/\s+$/g, ""))
    .join("\n")
    .trim();
}

export function openWhatsAppShare(text: string) {
  const safe = (text ?? "").slice(0, 3500); // keep URL reasonably sized
  const url = `https://wa.me/?text=${encodeURIComponent(safe)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
