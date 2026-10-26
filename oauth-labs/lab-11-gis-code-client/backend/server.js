const express = require("express");
const crypto = require("crypto");
const https = require("https");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = 3011;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "YOUR_CLIENT_SECRET";

app.use(express.json());
app.use(
  session({
    secret: crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true },
  })
);
app.use(express.static(path.join(__dirname, "..", "public")));

function httpsRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          reject(new Error("Invalid JSON: " + data));
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Exchange the authorization code for tokens, then fetch user info
app.post("/api/exchange", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "missing code" });

  try {
    // Exchange code for tokens
    const tokenData = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    }).toString();

    const tokenUrl = new URL("https://oauth2.googleapis.com/token");
    const tokenRes = await httpsRequest(
      tokenUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(tokenData),
        },
      },
      tokenData
    );

    if (tokenRes.status !== 200 || !tokenRes.body.access_token) {
      return res.status(400).json({
        error: "token exchange failed",
        detail: tokenRes.body,
      });
    }

    const { access_token, id_token, refresh_token } = tokenRes.body;

    // Fetch user profile
    const userUrl = new URL("https://www.googleapis.com/oauth2/v2/userinfo");
    const userRes = await httpsRequest(userUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${access_token}` },
    });

    res.json({
      tokens: {
        access_token,
        id_token: id_token ? id_token.slice(0, 40) + "..." : null,
        refresh_token: refresh_token || null,
      },
      user: userRes.body,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/config", (_req, res) => {
  res.json({ client_id: CLIENT_ID });
});

app.listen(PORT, () =>
  console.log(`[Lab 11 — GIS Code Client (auth code)]  http://localhost:${PORT}`)
);
