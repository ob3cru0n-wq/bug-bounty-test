const express = require("express");
const crypto = require("crypto");
const https = require("https");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = 3009;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID";

app.use(express.json());
app.use(
  session({
    secret: crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true },
  })
);
app.use(express.static(path.join(__dirname, "..", "public")));

// Generate a nonce and store its hash server-side
app.get("/api/nonce", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(nonce).digest("hex");
  req.session.nonceHash = hash;
  res.json({ nonce });
});

// Verify JWT credential and check that the nonce hash matches
app.post("/api/verify", (req, res) => {
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

          // Verify nonce: hash the nonce from the JWT and compare
          if (payload.nonce && req.session.nonceHash) {
            const expectedHash = crypto
              .createHash("sha256")
              .update(payload.nonce)
              .digest("hex");
            if (expectedHash !== req.session.nonceHash) {
              return res.status(403).json({ error: "nonce mismatch" });
            }
          }

          delete req.session.nonceHash;
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
  console.log(`[Lab 09 — GIS renderButton (nonce/hash)]  http://localhost:${PORT}`)
);
