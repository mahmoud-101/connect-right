// Minimal PDF export without extra dependencies: opens a print-friendly window.
// The user can choose “Save as PDF” from the browser print dialog.
export function exportAsPdf({ title, html }: { title: string; html: string }) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.open();
  w.document.write(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:24px;}
        h1,h2{margin:0 0 12px 0}
        .muted{opacity:.7}
        .card{border:1px solid #ddd; border-radius:12px; padding:16px; margin:12px 0;}
        img{max-width:100%; border-radius:12px;}
        pre{white-space:pre-wrap; word-break:break-word;}
      </style>
    </head>
    <body>
      ${html}
      <script>window.onload=()=>window.print()</script>
    </body>
  </html>`);
  w.document.close();
}
