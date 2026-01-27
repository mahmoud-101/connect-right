function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

import { createClient } from "npm:@supabase/supabase-js@2";

type Tone = "casual" | "professional" | "luxury" | "friendly";

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
      section?: "all" | "description" | "short_post" | "selling_points" | "hashtags" | "pricing";
    };

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const normalizedUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;

    // 1) Best-effort scrape
    const pageResp = await fetch(normalizedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const html = await pageResp.text();

    const productTitle = cleanText(pickTitle(html)) || "";
    const productPrice = cleanText(pickPrice(html)) || "";
    const productSpecs = cleanText(pickMeta(html, "description") || pickMeta(html, "og:description")) || "";
    const imageUrls = pickImages(html, 10);

    // 2) AI generation via Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
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

    const userPrompt = `Product details:\nTitle: ${productTitle || "(unknown)"}\nPrice: ${productPrice || "(unknown)"}\nSpecifications: ${productSpecs || "(unknown)"}\n\nTone: ${tone}\n\nGenerate:\n1) FULL DESCRIPTION (150-250 words)\n2) SHORT SOCIAL POST (50-80 words) with 2-3 emojis\n3) 4-5 selling points (benefits)\n4) 10 Arabic hashtags\n5) Pricing suggestion with markup options 30/50/100 and profit margins.`;

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

    return new Response(
      JSON.stringify({
        productData: {
          title: productTitle,
          price: productPrice,
          specs: productSpecs,
          imageUrls,
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
