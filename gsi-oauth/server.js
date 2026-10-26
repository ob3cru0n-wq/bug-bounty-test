const express = require("express");
const crypto = require("crypto");
const https = require("https");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration ---
// Set these via environment variables or replace with your Google Cloud Console credentials
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const REDIRECT_URI =
  process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 30 },
  })
);

// Helper: make an HTTPS request and return parsed JSON
function httpsRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          reject(new Error(`Invalid JSON: ${data}`));
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// --- Routes ---

// Serve login page
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/profile");
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Step 1: Redirect user to Google's OAuth 2.0 consent screen
app.get("/auth/google", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    state: state,
    prompt: "consent",
  });

  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
});

// Step 2: Google redirects back with an authorization code
app.get("/auth/google/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  // Validate state parameter to prevent CSRF
  if (!state || state !== req.session.oauthState) {
    return res.status(403).send("Invalid state parameter. Possible CSRF.");
  }
  delete req.session.oauthState;

  if (!code) {
    return res.redirect("/?error=no_code");
  }

  try {
    // Step 3: Exchange authorization code for tokens
    const tokenData = new URLSearchParams({
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString();

    const tokenUrl = new URL("https://oauth2.googleapis.com/token");
    const tokenResponse = await httpsRequest(
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

    if (tokenResponse.status !== 200 || !tokenResponse.body.access_token) {
      console.error("Token exchange failed:", tokenResponse.body);
      return res.redirect("/?error=token_exchange_failed");
    }

    const { access_token, id_token, refresh_token } = tokenResponse.body;

    // Step 4: Fetch user profile from Google
    const userInfoUrl = new URL(
      "https://www.googleapis.com/oauth2/v2/userinfo"
    );
    const userResponse = await httpsRequest(userInfoUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (userResponse.status !== 200) {
      console.error("User info fetch failed:", userResponse.body);
      return res.redirect("/?error=userinfo_failed");
    }

    // Store user in session
    req.session.user = userResponse.body;
    req.session.tokens = { access_token, id_token, refresh_token };

    res.redirect("/profile");
  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect("/?error=server_error");
  }
});

// Profile page — shows fetched Google user data
app.get("/profile", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});

// API endpoint: return user data as JSON (used by profile page)
app.get("/api/user", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  res.json(req.session.user);
});

// Logout
app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.listen(PORT, () => {
  console.log(`GSI OAuth app running at http://localhost:${PORT}`);
  if (CLIENT_ID === "YOUR_CLIENT_ID") {
    console.log(
      "\n  WARNING: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.\n" +
        "  Get them from https://console.cloud.google.com/apis/credentials\n"
    );
  }
});
