function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      reqHeaders ??
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-affiliate-signature, x-affiliate-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

import { createClient } from "npm:@supabase/supabase-js@2";

type Tone = "casual" | "professional" | "luxury" | "friendly";

type WebhookPayload = {
  // Optional convenience fields
  source?: string;
  url?: string;
  tone?: Tone;
  user_id?: string;

  product?: {
    title?: string;
    price?: string;
    specs?: string;
    image_urls?: string[];
  };
};

function normalizeTone(t?: string): Tone {
  const v = (t ?? "").toLowerCase();
  if (v === "professional" || v === "luxury" || v === "friendly") return v;
  return "casual";
}

function cleanText(s?: string) {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return hex(sig);
}

async function verifyWebhook(req: Request, rawBody: string) {
  const secret = Deno.env.get("AFFILIATE_WEBHOOK_SECRET") ?? "";
  if (!secret) return false;

  // Option A (simplest): x-affiliate-secret == secret
  const direct = req.headers.get("x-affiliate-secret");
  if (direct && direct === secret) return true;

  // Option B: HMAC signature of raw JSON (recommended)
  const sig = req.headers.get("x-affiliate-signature");
  if (!sig) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return sig === expected;
}

async function generateMarketingContent(args: {
  apiKey: string;
  title: string;
  price: string;
  specs: string;
  tone: Tone;
}) {
  const { apiKey, title, price, specs, tone } = args;

  const prompt = `
أنت كاتب تسويق عربي محترف لمتاجر السوشيال.

عايز منك تولّد محتوى عربي جاهز للبيع لمنتج واحد.
النبرة (Tone): ${tone}

بيانات المنتج:
- الاسم: ${title || "(غير متوفر)"}
- السعر: ${price || "(غير متوفر)"}
- المواصفات/وصف مختصر: ${specs || "(غير متوفر)"}

المطلوب (JSON فقط بدون أي نص إضافي):
{
  "description": "وصف تسويقي عربي من 120-180 كلمة",
  "shortPost": "بوست سوشيال من 2-4 سطور + CTA واضح",
  "sellingPoints": ["نقطة 1", "نقطة 2", "نقطة 3", "نقطة 4"],
  "hashtags": ["#...", "#...", "#..."]
}
`; 

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("AI generation failed", resp.status, text);
    throw new Error("AI generation failed");
  }

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Invalid AI response");

  // The model returns JSON as text; parse defensively
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  const sliced = start >= 0 && end >= 0 ? content.slice(start, end + 1) : content;
  const parsed = JSON.parse(sliced);

  return {
    description: typeof parsed?.description === "string" ? parsed.description : "",
    shortPost: typeof parsed?.shortPost === "string" ? parsed.shortPost : "",
    sellingPoints: Array.isArray(parsed?.sellingPoints) ? parsed.sellingPoints.filter((x: any) => typeof x === "string") : [],
    hashtags: Array.isArray(parsed?.hashtags) ? parsed.hashtags.filter((x: any) => typeof x === "string") : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  const cors = corsHeaders(req);
  try {
    const rawBody = await req.text();

    // Auth path 1: JWT (if caller is our frontend)
    const authHeader = req.headers.get("Authorization") ?? "";
    const hasJwt = authHeader.startsWith("Bearer ");

    // Auth path 2: webhook secret/signature (for external systems)
    const okWebhook = await verifyWebhook(req, rawBody);

    if (!hasJwt && !okWebhook) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const payload = (rawBody ? JSON.parse(rawBody) : {}) as WebhookPayload;
    const tone = normalizeTone(payload.tone);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const client = createClient(supabaseUrl, supabaseAnon, {
      global: hasJwt ? { headers: { Authorization: authHeader } } : undefined,
    });

    let userId = payload.user_id ?? "";
    if (hasJwt) {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await client.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const title = cleanText(payload.product?.title);
    const price = cleanText(payload.product?.price);
    const specs = cleanText(payload.product?.specs);
    const imageUrls = Array.isArray(payload.product?.image_urls)
      ? payload.product!.image_urls!.filter((x) => typeof x === "string" && x.trim()).slice(0, 20)
      : [];

    if (!title && !specs && imageUrls.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "لازم تبعت على الأقل title أو specs أو image_urls عشان نقدر نطلع محتوى صحيح بدون scraping.",
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const generated = await generateMarketingContent({
      apiKey: LOVABLE_API_KEY,
      title,
      price,
      specs,
      tone,
    });

    const cover = imageUrls[0] ?? null;
    const sourceUrl = payload.url ? cleanText(payload.url) : "webhook";

    const { data: row, error: insertError } = await client
      .from("extracted_products")
      .insert({
        user_id: userId,
        source_url: sourceUrl,
        product_title: title || null,
        product_image_urls: imageUrls,
        generated_image_urls: [],
        original_price: price || null,
        specs: specs || null,
        tone,
        generated_description: generated.description || null,
        generated_short_post: generated.shortPost || null,
        generated_selling_points: generated.sellingPoints,
        generated_hashtags: generated.hashtags,
        suggested_pricing: null,
        is_saved: true,
        cover_image_url: cover,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error("Insert failed", insertError);
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    try {
      await client.from("usage_logs").insert({ user_id: userId, action: "webhook" });
    } catch {
      // best-effort
    }

    return new Response(
      JSON.stringify({
        ok: true,
        id: row?.id ?? null,
        content: generated,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("affiliate-webhook error", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});