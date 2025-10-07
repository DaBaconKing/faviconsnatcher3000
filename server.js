import express from "express";
import fetch from "node-fetch";
import cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_HEADER = "x-auth-code";
const AUTH_SECRET = "MGEFDHGIERHGOIUE-/BACON4LIFE";

app.get("/", async (req, res) => {
  const target = req.query.target;
  const auth = req.headers[AUTH_HEADER];

  if (!target) return res.status(400).send("Missing target URL");
  if (auth !== AUTH_SECRET) return res.status(403).send("Unauthorized");

  try {
    const url = new URL(target);
    if (!/^https?:$/.test(url.protocol)) {
      return res.status(400).send("Only http/https URLs are allowed");
    }

    const htmlRes = await fetch(url.href);
    if (!htmlRes.ok) throw new Error(`Failed to fetch: ${htmlRes.status}`);
    const html = await htmlRes.text();

    const $ = cheerio.load(html);
    const origin = `${url.protocol}//${url.hostname}`;

    // 🧠 Favicon candidates
    const candidates = [
      $('link[rel="icon"]').attr("href"),
      $('link[rel="shortcut icon"]').attr("href"),
      $('link[rel="apple-touch-icon"]').attr("href"),
      `/favicon.ico`
    ].filter(Boolean);

    // 🔍 Resolve absolute URLs
    const resolved = candidates.map(href => {
      if (/^https?:\/\//.test(href)) return href;
      if (href.startsWith("//")) return `${url.protocol}${href}`;
      return `${origin}${href.startsWith("/") ? "" : "/"}${href}`;
    });

    // 🖼️ Try each favicon until one works
    for (const iconURL of resolved) {
      try {
        const iconRes = await fetch(iconURL);
        if (iconRes.ok && iconRes.headers.get("content-type")?.includes("image")) {
          res.set("content-type", iconRes.headers.get("content-type"));
          return iconRes.body.pipe(res);
        }
      } catch (err) {
        console.warn(`Failed favicon: ${iconURL}`);
      }
    }

    // 🧯 Fallback to Google’s favicon service
    const fallback = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
    const fallbackRes = await fetch(fallback);
    if (!fallbackRes.ok) throw new Error("Fallback failed");
    res.set("content-type", fallbackRes.headers.get("content-type"));
    fallbackRes.body.pipe(res);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching favicon");
  }
});

app.listen(PORT, () => console.log(`🔥 Favicon server running on port ${PORT}`));
