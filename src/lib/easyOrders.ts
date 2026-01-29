export type EasyOrdersRow = {
  name: string;
  description: string;
  price: string;
  images: string;
  category: string;
  stock: string;
};

const DEFAULT_CATEGORY = "Electronics";
const DEFAULT_STOCK = "100";

export function buildEasyOrdersRow(input: {
  name?: string | null;
  description?: string | null;
  price?: string | null;
  imageUrls?: string[] | null;
  category?: string | null;
  stock?: string | null;
}): EasyOrdersRow {
  const images = (input.imageUrls ?? []).filter(Boolean);
  const imagesCell = images.join(",");

  return {
    name: (input.name ?? "").trim() || "(بدون اسم)",
    description: (input.description ?? "").trim(),
    price: (input.price ?? "").trim(),
    images: imagesCell,
    category: (input.category ?? "").trim() || DEFAULT_CATEGORY,
    stock: (input.stock ?? "").trim() || DEFAULT_STOCK,
  };
}

export function toEasyOrdersCsv(rows: EasyOrdersRow[]) {
  const header = ["name", "description", "price", "images", "category", "stock"].join(",");
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows
    .map((r) => [r.name, r.description, r.price, r.images, r.category, r.stock].map(esc).join(","))
    .join("\n");
  return `${header}\n${body}`;
}
