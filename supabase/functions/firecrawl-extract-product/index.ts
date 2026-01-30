const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ExtractedProduct = {
  title?: string;
  price?: string;
  images?: string[];
  description?: string;
  variants?: unknown;
};

function normalizeUrl(raw: string) {
  const u = raw.trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

function toJson(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Best-effort in-memory cache (instance-local). Speeds repeated imports.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<
  string,
  { at: number; data: { product: ExtractedProduct; screenshot?: string; finalUrl?: string } }
>();

function getCached(url: string) {
  const hit = cache.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(url);
    return null;
  }
  return hit.data;
}

function setCached(url: string, data: { product: ExtractedProduct; screenshot?: string; finalUrl?: string }) {
  cache.set(url, { at: Date.now(), data });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return toJson(401, { error: "Unauthorized" });
    }

    // Verify JWT (signing-keys compatible)
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl) return toJson(500, { error: "SUPABASE_URL not configured" });
    if (!supabaseAnon) return toJson(500, { error: "SUPABASE_ANON_KEY not configured" });

    const { createClient } = await import("npm:@supabase/supabase-js@2.93.1");
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return toJson(401, { error: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const urlRaw = typeof body?.url === "string" ? body.url : "";
    const url = normalizeUrl(urlRaw);
    if (!url) return toJson(400, { error: "URL is required" });

    const cached = getCached(url);
    if (cached) {
      return toJson(200, { ...cached, cached: true });
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return toJson(500, { error: "Firecrawl is not configured" });
    }

    // Firecrawl v1 scrape w/ JSON extraction schema + screenshot
    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        price: { type: "string" },
        images: { type: "array", items: { type: "string" } },
        description: { type: "string" },
        variants: {},
      },
      additionalProperties: true,
    };

    const prompt =
      "Extract e-commerce product data accurately. Arabic/English OK. Focus main product. Return clean image URLs (prefer highest resolution).";

    const fcResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: [
          { type: "json", schema, prompt },
          "screenshot",
        ],
        onlyMainContent: true,
        waitFor: 5000,
      }),
    });

    const fcJson = await fcResp.json().catch(() => ({}));
    if (!fcResp.ok) {
      const errMsg = fcJson?.error || "Failed to scrape";
      return toJson(fcResp.status, { error: errMsg });
    }

    const dataRoot = fcJson?.data ?? fcJson;
    const product = (dataRoot?.json ?? {}) as ExtractedProduct;
    const screenshot = dataRoot?.screenshot as string | undefined;
    const finalUrl = dataRoot?.metadata?.sourceURL as string | undefined;

    // Light sanity checks
    const title = typeof product?.title === "string" ? product.title.trim() : "";
    const images = Array.isArray(product?.images)
      ? product.images.filter((x) => typeof x === "string" && x.trim()).slice(0, 30)
      : [];

    if (!title && images.length === 0) {
      return toJson(422, {
        error: "Could not confidently extract product data. Try manual input.",
        code: "EXTRACT_LOW_CONFIDENCE",
      });
    }

    const payload = {
      product: {
        title: title || undefined,
        price: typeof product?.price === "string" ? product.price.trim() || undefined : undefined,
        images,
        description:
          typeof product?.description === "string" ? product.description.trim() || undefined : undefined,
        variants: product?.variants,
      },
      screenshot,
      finalUrl,
    };

    setCached(url, payload);
    return toJson(200, payload);
  } catch (e) {
    console.error("firecrawl-extract-product error", e);
    return toJson(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
