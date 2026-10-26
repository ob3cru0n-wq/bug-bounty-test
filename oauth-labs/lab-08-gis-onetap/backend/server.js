const express = require("express");
const https = require("https");
const path = require("path");

const app = express();
const PORT = 3008;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID";

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Verify the JWT id_token by calling Google's tokeninfo endpoint
app.post("/api/verify", async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "missing credential" });

  const url = new URL(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );

  https
    .get(url, (gRes) => {
      let data = "";
      gRes.on("data", (c) => (data += c));
      gRes.on("end", () => {
        try {
          const payload = JSON.parse(data);
          if (payload.aud !== CLIENT_ID) {
            return res.status(403).json({ error: "audience mismatch" });
          }
          res.json(payload);
        } catch {
          res.status(502).json({ error: "bad upstream response" });
        }
      });
    })
    .on("error", () => res.status(502).json({ error: "upstream error" }));
});

app.get("/config", (_req, res) => {
  res.json({ client_id: CLIENT_ID });
});

app.listen(PORT, () =>
  console.log(`[Lab 08 — GIS One Tap + renderButton]  http://localhost:${PORT}`)
);
