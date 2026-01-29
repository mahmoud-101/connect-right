export type PostTemplate = {
  id: string;
  name: string;
  /** Human-friendly helper; used only for UI */
  hint?: string;
  /**
   * Use placeholders:
   * {title} {price} {description} {points} {hashtags}
   */
  body: string;
};

export const POST_TEMPLATES: PostTemplate[] = [
  {
    id: "offer",
    name: "عرض خاص ⚡",
    body:
      "{title}\n\n🔥 عرض خاص لفترة محدودة!\n\n{description}\n\n{points}\n\n💰 السعر: {price}\n\n{hashtags}",
  },
  {
    id: "new",
    name: "وصل حديثاً ✨",
    body:
      "{title}\n\n✨ وصل حديثاً!\n\n{description}\n\n{points}\n\n💰 السعر: {price}\n\n{hashtags}",
  },
  {
    id: "gift",
    name: "هدية مثالية 🎁",
    body:
      "{title}\n\n🎁 هدية مثالية لأي مناسبة!\n\n{description}\n\n{points}\n\n💰 السعر: {price}\n\n{hashtags}",
  },
  {
    id: "bestseller",
    name: "الأكثر مبيعاً 🔥",
    body:
      "{title}\n\n🔥 من الأكثر مبيعاً حالياً!\n\n{description}\n\n{points}\n\n💰 السعر: {price}\n\n{hashtags}",
  },
  {
    id: "bundle",
    name: "عرض الحزمة 📦",
    body:
      "{title}\n\n📦 عرض الحزمة — وفر أكتر!\n\n{description}\n\n{points}\n\n💰 السعر: {price}\n\n{hashtags}",
  },
  {
    id: "premium",
    name: "جودة فاخرة ⭐",
    body:
      "{title}\n\n⭐ جودة فاخرة وتفاصيل على أعلى مستوى\n\n{description}\n\n{points}\n\n💰 السعر: {price}\n\n{hashtags}",
  },
  {
    id: "limited",
    name: "كمية محدودة ⚠️",
    body:
      "{title}\n\n⚠️ كمية محدودة — الحق/ي قبل ما تخلص\n\n{description}\n\n{points}\n\n💰 السعر: {price}\n\n{hashtags}",
  },
  {
    id: "compare",
    name: "قارن ووفر 💡",
    body:
      "{title}\n\n💡 قارن ووفر — اختيار ذكي بسعر قوي\n\n{description}\n\n{points}\n\n💰 السعر: {price}\n\n{hashtags}",
  },
];

export function applyTemplate(params: {
  templateId: string;
  title?: string | null;
  price?: string | null;
  description?: string | null;
  sellingPoints?: string[] | null;
  hashtags?: string[] | null;
}) {
  const tpl = POST_TEMPLATES.find((t) => t.id === params.templateId);
  if (!tpl) return "";

  const points = (params.sellingPoints ?? []).filter(Boolean);
  const pointsText = points.length ? points.map((p) => `✓ ${String(p).trim()}`).join("\n") : "";
  const tags = (params.hashtags ?? []).filter(Boolean);
  const tagsText = tags.length ? tags.map((t) => String(t).trim()).join(" ") : "";

  const safe = (v?: string | null) => (v ?? "").toString().trim();

  return tpl.body
    .replace(/\{title\}/g, safe(params.title) || "—")
    .replace(/\{price\}/g, safe(params.price) || "—")
    .replace(/\{description\}/g, safe(params.description))
    .replace(/\{points\}/g, pointsText)
    .replace(/\{hashtags\}/g, tagsText)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
