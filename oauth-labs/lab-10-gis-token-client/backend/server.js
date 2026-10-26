const express = require("express");
const https = require("https");
const path = require("path");

const app = express();
const PORT = 3010;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID";

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Fetch user info with access_token (server-side proxy)
app.get("/api/userinfo", (req, res) => {
  const token = req.query.access_token;
  if (!token) return res.status(400).json({ error: "missing access_token" });

  const url = new URL("https://www.googleapis.com/oauth2/v2/userinfo");
  https
    .get(url, { headers: { Authorization: `Bearer ${token}` } }, (gRes) => {
      let data = "";
      gRes.on("data", (c) => (data += c));
      gRes.on("end", () => {
        try {
          res.json(JSON.parse(data));
        } catch {
          res.status(502).json({ error: "bad upstream response" });
        }
      });
    })
    .on("error", () => res.status(502).json({ error: "upstream error" }));
});

// Fetch data from any Google API using the access_token
app.get("/api/google-people", (req, res) => {
  const token = req.query.access_token;
  if (!token) return res.status(400).json({ error: "missing access_token" });

  const url = new URL(
    "https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos,metadata"
  );
  https
    .get(url, { headers: { Authorization: `Bearer ${token}` } }, (gRes) => {
      let data = "";
      gRes.on("data", (c) => (data += c));
      gRes.on("end", () => {
        try {
          res.json(JSON.parse(data));
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
  console.log(`[Lab 10 — GIS Token Client (access_token)]  http://localhost:${PORT}`)
);
