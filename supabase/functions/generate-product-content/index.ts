function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    // Echo requested headers to avoid mobile/webview CORS mismatches (e.g. x-supabase-client-platform)
    "Access-Control-Allow-Headers": reqHeaders ?? "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

import { createClient } from "npm:@supabase/supabase-js@2";

type Tone = "casual" | "professional" | "luxury" | "friendly";

type FirecrawlScrapeResult = {
  html?: string;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    statusCode?: number;
    language?: string;
  };
};

function isHtmlUsable(html: string) {
  const s = (html ?? "").trim();
  if (!s) return false;
  // Very small pages are often bot blocks, redirects, or JS shells.
  if (s.length < 2500) return false;
  // Simple block heuristics
  const lower = s.toLowerCase();
  if (lower.includes("enable javascript") || lower.includes("access denied") || lower.includes("captcha")) return false;
  return true;
}

async function resolveFinalUrl(inputUrl: string): Promise<string> {
  // Follow redirects to the final destination (affiliate/tracking links).
  // Use GET (some platforms block HEAD) and keep a short timeout.
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const resp = await fetch(inputUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    // Deno fetch exposes final URL after redirects.
    return resp.url || inputUrl;
  } catch (e) {
    console.error("resolveFinalUrl failed", e);
    return inputUrl;
  } finally {
    clearTimeout(t);
  }
}

async function firecrawlScrape(args: {
  apiKey: string;
  url: string;
  formats?: ("html" | "markdown")[];
}): Promise<FirecrawlScrapeResult> {
  const { apiKey, url } = args;
  const formats = args.formats ?? ["html", "markdown"];

  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats,
      onlyMainContent: true,
      // A small wait helps on dynamic storefronts.
      waitFor: 1200,
    }),
  });

  const json = await resp.json().catch(() => null);
  if (!resp.ok) {
    console.error("Firecrawl scrape error", resp.status, json);
    throw new Error("Firecrawl scrape failed");
  }

  // Firecrawl may return fields either at top-level or nested under data.
  const data = (json?.data ?? json) as any;
  return {
    html: typeof data?.html === "string" ? data.html : undefined,
    markdown: typeof data?.markdown === "string" ? data.markdown : undefined,
    metadata: typeof data?.metadata === "object" ? data.metadata : undefined,
  };
}

function pickMeta(content: string, name: string) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const m = content.match(re);
  return m?.[1]?.trim();
}

function pickTitle(html: string) {
  return pickMeta(html, "og:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
}

function pickImages(html: string, limit = 10) {
  const urls = new Set<string>();
  const og = pickMeta(html, "og:image");
  if (og) urls.add(og);
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) && urls.size < limit) {
    const u = m[1];
    if (!u) continue;
    if (u.startsWith("data:")) continue;
    urls.add(u);
  }
  return Array.from(urls).slice(0, limit);
}

function pickPrice(html: string) {
  const priceMeta = pickMeta(html, "product:price:amount") || pickMeta(html, "og:price:amount");
  if (priceMeta) return priceMeta;
  const m = html.match(/(\d+[\d,\.]*)\s?(EGP|ج\.م|SAR|AED|USD|\$|ر\.س|د\.إ)/i);
  return m ? `${m[1]} ${m[2]}` : undefined;
}

function cleanText(s?: string) {
  if (!s) return undefined;
  return s.replace(/\s+/g, " ").trim();
}

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function looksLikeAuthOrLanding(html: string, url: string): boolean {
  const host = getHost(url);
  const lower = (html || "").toLowerCase();

  // Generic auth wall / login page signals
  const authSignals = [
    "login",
    "sign in",
    "signin",
    "sign-in",
    "log in",
    "register",
    "create account",
    "forgot password",
    "تسجيل الدخول",
    "تسجيل حساب",
    "انشاء حساب",
    "إنشاء حساب",
    "كلمة المرور",
  ];
  if (authSignals.some((s) => lower.includes(s.toLowerCase()))) return true;

  // Affiliate platforms often have internal product pages behind auth.
  // If we land on their public marketing page (og:title == brand, no price, tracking image), treat as not a product.
  const brandHosts = new Set(["taager.com", "engezny.com", "vendor.com", "safqa.com"]);
  if (brandHosts.has(host)) {
    const title = (pickTitle(html) || "").trim();
    const ogSiteName = (pickMeta(html, "og:site_name") || "").trim();
    const price = pickPrice(html);
    const imgs = pickImages(html, 5);

    const brandishTitle = /^(taager|engezny|vendor|safqa)$/i.test(title) ||
      /^(taager|engezny|vendor|safqa)$/i.test(ogSiteName);
    const onlyTrackingImages = imgs.length > 0 && imgs.every((u) => /mc\.yandex\.ru|google-analytics|doubleclick|pixel/i.test(u));

    // When URL looks like a product path but page is brand/landing, it's almost certainly gated.
    const looksLikeProductPath = /\/products\//i.test(url) || /\/product\//i.test(url);
    if (looksLikeProductPath && (brandishTitle || (!price && onlyTrackingImages))) return true;
  }

  return false;
}

function parseDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } {
  // Example: data:image/png;base64,AAA...
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid image data");
  const contentType = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  return { bytes, contentType, ext };
}

async function generateProductImages(args: {
  apiKey: string;
  title: string;
  specs: string;
  tone: Tone;
  count?: number;
}): Promise<string[]> {
  const { apiKey, title, specs, tone } = args;
  const count = Math.max(1, Math.min(args.count ?? 2, 4));

  const basePrompt = `Create a clean e-commerce product photo suitable for Arabic social commerce.
Product: ${title || "(unknown)"}
Details: ${specs || "(unknown)"}
Style: ${tone}
Requirements: neutral background, high detail, realistic lighting, no text, no watermark, centered product, 1:1.`;

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: `${basePrompt}\nVariant: ${i + 1}` }],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Image model error", resp.status, text);
      continue;
    }
    const json = await resp.json();
    const dataUrl = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) out.push(dataUrl);
  }

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  try {
    const cors = corsHeaders(req);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const client = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await client.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Unauthorized: getClaims failed", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { url, tone, section } = (await req.json()) as {
      url: string;
      tone: Tone;
      section?: "all" | "images" | "description" | "short_post" | "selling_points" | "hashtags" | "pricing";
    };

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const normalizedUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    const finalUrl = await resolveFinalUrl(normalizedUrl);

    // Identify user for limits + storage paths
    const userId = claimsData.claims.sub as string;

    // Server-side plan limit enforcement (monthly extractions)
    // Count only for full extraction (section=all) or images-only.
    const shouldCountUsage = !section || section === "all" || section === "images";
    if (shouldCountUsage) {
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("subscription_plan")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) {
        console.error("Failed to fetch profile", profileError);
        return new Response(JSON.stringify({ error: "Failed to load profile" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const plan = (profile?.subscription_plan ?? "free") as string;
      const limit = plan === "pro" ? Infinity : plan === "basic" ? 50 : 10;

      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();

      const { count, error: countError } = await client
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("action", "extract")
        .gte("created_at", monthStart);

      if (countError) {
        console.error("Failed to count usage", countError);
        return new Response(JSON.stringify({ error: "Failed to check usage" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if ((count ?? 0) >= limit) {
        return new Response(
          JSON.stringify({
            error:
              plan === "basic"
                ? "You reached your monthly limit (Basic: 50)."
                : "You reached your monthly limit (Free: 10).",
            code: "LIMIT_REACHED",
            plan,
            limit,
          }),
          {
            status: 429,
            headers: { ...cors, "Content-Type": "application/json" },
          },
        );
      }
    }

    // 1) Hybrid scrape: resolve affiliate redirects -> try direct HTML -> fallback to Firecrawl
    let html = "";
    try {
      const pageResp = await fetch(finalUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      html = await pageResp.text();
    } catch (e) {
      console.error("Direct fetch failed", e);
      html = "";
    }

    // If HTML looks like a JS shell / bot block / too small, fallback
    if (!isHtmlUsable(html)) {
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (FIRECRAWL_API_KEY) {
        try {
          const fc = await firecrawlScrape({ apiKey: FIRECRAWL_API_KEY, url: finalUrl });
          if (fc.html && isHtmlUsable(fc.html)) html = fc.html;
        } catch (e) {
          console.error("Firecrawl fallback failed", e);
        }
      }
    }

    let productTitle = cleanText(pickTitle(html)) || "";
    let productPrice = cleanText(pickPrice(html)) || "";
    let productSpecs = cleanText(pickMeta(html, "description") || pickMeta(html, "og:description")) || "";
    let imageUrls = pickImages(html, 10);

    // If we're seeing a login wall or a public landing page instead of an actual product,
    // stop early to avoid generating misleading content.
    if (looksLikeAuthOrLanding(html, finalUrl)) {
      return new Response(
        JSON.stringify({
          error:
            "الرابط ده غالباً من داخل منصة أفلييت وبيحتاج تسجيل دخول، فالسيرفر بيشوف صفحة عامة/تسجيل دخول مش صفحة المنتج.\n\nالحل: ابعت رابط المنتج النهائي من المتجر الأصلي (Amazon/Noon/…)، أو رابط (Share) عام من المنصة يكون متاح بدون تسجيل دخول.",
          code: "AUTH_REQUIRED_OR_NOT_PRODUCT",
          finalUrl,
        }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Second chance enrichment via Firecrawl if we still have weak signals
    const weakSignals = !productTitle || imageUrls.length === 0 || (!productSpecs && !productPrice);
    if (weakSignals) {
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (FIRECRAWL_API_KEY) {
        try {
          const fc = await firecrawlScrape({ apiKey: FIRECRAWL_API_KEY, url: finalUrl });
          const fcHtml = fc.html && isHtmlUsable(fc.html) ? fc.html : "";
          if (fcHtml) {
            productTitle = productTitle || cleanText(pickTitle(fcHtml)) || "";
            productPrice = productPrice || cleanText(pickPrice(fcHtml)) || "";
            productSpecs =
              productSpecs ||
              cleanText(pickMeta(fcHtml, "description") || pickMeta(fcHtml, "og:description")) ||
              "";
            if (imageUrls.length === 0) imageUrls = pickImages(fcHtml, 10);
          }
        } catch (e) {
          console.error("Firecrawl enrichment failed", e);
        }
      }
    }

    // 2) AI generation via Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Images-only mode (skip text generation)
    if (section === "images") {
      let generatedImageUrls: string[] = [];
      try {
        const dataUrls = await generateProductImages({
          apiKey: LOVABLE_API_KEY,
          title: productTitle,
          specs: productSpecs,
          tone,
          count: 2,
        });

        for (const dataUrl of dataUrls) {
          const { bytes, contentType, ext } = parseDataUrl(dataUrl);
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;
          const uploadRes = await client.storage.from("product-images").upload(path, bytes, {
            contentType,
            upsert: false,
          });
          if (uploadRes.error) {
            console.error("Storage upload error", uploadRes.error);
            continue;
          }
          const pub = client.storage.from("product-images").getPublicUrl(path);
          if (pub.data?.publicUrl) generatedImageUrls.push(pub.data.publicUrl);
        }
      } catch (e) {
        console.error("Images-only generation failed", e);
        generatedImageUrls = [];
      }

      // Track usage server-side
      if (!generatedImageUrls.length) {
        // Still count a usage because request consumed resources.
        await client.from("usage_logs").insert({ user_id: userId, action: "extract" });
      } else {
        await client.from("usage_logs").insert({ user_id: userId, action: "extract" });
      }

      return new Response(
        JSON.stringify({
          productData: {
            title: productTitle,
            price: productPrice,
            specs: productSpecs,
            imageUrls,
            generatedImageUrls,
            ratingsSummary: "",
          },
          content: {},
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const toolSchema = {
      type: "function",
      function: {
        name: "return_product_content",
        description: "Return structured Arabic social commerce content for the product.",
        parameters: {
          type: "object",
          properties: {
            description: { type: "string" },
            shortPost: { type: "string" },
            sellingPoints: { type: "array", items: { type: "string" } },
            hashtags: { type: "array", items: { type: "string" } },
            pricing: { type: "object" },
          },
          required: ["description", "shortPost", "sellingPoints", "hashtags", "pricing"],
          additionalProperties: true,
        },
      },
    };

    const systemPrompt =
      "You are an expert Arabic copywriter specializing in social commerce for Egyptian and Gulf audiences. Write natural Arabic (not overly formal).";

    const userPrompt = `Product details:\nTitle: ${productTitle || "(unknown)"}\nPrice: ${productPrice || "(unknown)"}\nSpecifications: ${productSpecs || "(unknown)"}\n\nTone: ${tone}\n\nWrite Arabic suitable for Egypt + Gulf audiences.\nRules: avoid exaggerated claims, keep it natural, include clear benefits.\n\nGenerate:\n1) وصف كامل (150-220 كلمة)\n2) بوست قصير للسوشيال (50-80 كلمة) + 2-3 إيموجي\n3) 5 نقاط بيع (فوائد)\n4) 10 هاشتاج عربي\n5) تسعير مقترح: سعر الشراء (إن متاح) + 3 خيارات بيع بهامش 30/50/100 مع توضيح الربح.`;

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [toolSchema],
      tool_choice: { type: "function", function: { name: "return_product_content" } },
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again shortly." }), {
          status: 429,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add usage credits." }), {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error", aiResp.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    let content: any = null;
    if (argsStr) {
      try {
        content = JSON.parse(argsStr);
      } catch (e) {
        console.error("Tool arguments JSON parse failed", e);
        content = null;
      }
    }

    // Fallback: sometimes providers return plain text instead of tool-calls
    if (!content) {
      const plain = aiJson?.choices?.[0]?.message?.content;
      content = {
        description: typeof plain === "string" ? plain : "",
        shortPost: "",
        sellingPoints: [],
        hashtags: [],
        pricing: {},
      };
    }

    // Section filtering (MVP)
    const filtered =
      section && section !== "all"
        ? {
            description: section === "description" ? content?.description : undefined,
            shortPost: section === "short_post" ? content?.shortPost : undefined,
            sellingPoints: section === "selling_points" ? content?.sellingPoints : undefined,
            hashtags: section === "hashtags" ? content?.hashtags : undefined,
            pricing: section === "pricing" ? content?.pricing : undefined,
          }
        : content;

    // 3) Optional: generate AI images (only for full generation)
    let generatedImageUrls: string[] = [];
    try {
      if (!section || section === "all") {
        const dataUrls = await generateProductImages({
          apiKey: LOVABLE_API_KEY,
          title: productTitle,
          specs: productSpecs,
          tone,
          count: 2,
        });

        for (const dataUrl of dataUrls) {
          const { bytes, contentType, ext } = parseDataUrl(dataUrl);
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;
          const uploadRes = await client.storage.from("product-images").upload(path, bytes, {
            contentType,
            upsert: false,
          });
          if (uploadRes.error) {
            console.error("Storage upload error", uploadRes.error);
            continue;
          }
          const pub = client.storage.from("product-images").getPublicUrl(path);
          if (pub.data?.publicUrl) generatedImageUrls.push(pub.data.publicUrl);
        }
      }
    } catch (e) {
      console.error("Image generation failed", e);
      generatedImageUrls = [];
    }

    // Track usage server-side for full extraction only
    if (!section || section === "all") {
      const { error: usageErr } = await client.from("usage_logs").insert({ user_id: userId, action: "extract" });
      if (usageErr) console.error("Failed to insert usage_log", usageErr);
    }

    return new Response(
      JSON.stringify({
        productData: {
          title: productTitle,
          price: productPrice,
          specs: productSpecs,
          imageUrls,
          generatedImageUrls,
          ratingsSummary: "",
        },
        content: filtered,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-product-content error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
