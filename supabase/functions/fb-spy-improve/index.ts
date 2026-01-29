const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EGYPT_HASHTAGS = [
  "#مصر",
  "#افلييت_مصر",
  "#اونلاين",
  "#عروض",
  "#تخفيضات",
  "#تسوق",
  "#تجارة_الكترونية",
  "#شحن",
  "#الدفع_عند_الاستلام",
  "#هدايا",
  "#لايف",
  "#ستورى",
  "#فيسبوك",
  "#جملة",
  "#بيع",
];

function normalizeUrl(raw: string) {
  const u = raw.trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const postUrl = normalizeUrl(String(url ?? ""));
    if (!postUrl) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "Firecrawl is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: postUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const scrapeJson = await scrapeResp.json();
    if (!scrapeResp.ok) {
      console.error("firecrawl error", scrapeResp.status, scrapeJson);
      return new Response(JSON.stringify({ error: scrapeJson?.error || "Failed to scrape" }), {
        status: scrapeResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawText =
      scrapeJson?.data?.markdown ||
      scrapeJson?.markdown ||
      "";

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `
أنت كاتب إعلانات مصري متخصص في بوستات Facebook للبيع في مصر.

المطلوب:
- حسّن البوست التالي ليصبح إعلان بيع قوي باللهجة المصرية (خفيفة ومحترمة)
- استخدم سطر Hook قوي + 3 نقاط مميزات + CTA واضح (ابعت رسالة / كومنت "سعر")
- أضف Emojis بشكل معتدل
- أضف 8-12 هاشتاجات، لازم تتضمن هاشتاجات مصرية من هذه القائمة:
${EGYPT_HASHTAGS.join(" ")}

النص المستخرج (قد يحتوي ضوضاء):
"""
${rawText.slice(0, 6000)}
"""

اكتب الناتج النهائي فقط بدون شرح.
    `.trim();

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write concise, high-converting Arabic Facebook ads for Egypt." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("ai gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: aiResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const improved = aiJson?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ rawText, improved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fb-spy-improve error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
