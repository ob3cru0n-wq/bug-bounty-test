# GSI OAuth Web App

A minimal Google Sign-In (OAuth 2.0) web application built with Node.js and Express.

## Flow

```
Login page  →  User clicks "Sign in with Google"
            →  Redirect to Google consent screen
            →  Google redirects back with authorization code
            →  Server exchanges code for access token
            →  Server fetches user profile from Google API
            →  Profile page displays user data
```

## Setup

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Choose **Web application**
6. Add `http://localhost:3000/auth/google/callback` as an **Authorized redirect URI**
7. Copy the **Client ID** and **Client Secret**

### 2. Install & Run

```bash
cd gsi-oauth
npm install

# Set your credentials
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"

npm start
```

Then open http://localhost:3000 in your browser.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID | `YOUR_CLIENT_ID` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret | `YOUR_CLIENT_SECRET` |
| `REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/auth/google/callback` |
| `PORT` | Server port | `3000` |

## Endpoints

| Route | Description |
|---|---|
| `GET /` | Login page |
| `GET /auth/google` | Initiates OAuth flow → redirects to Google |
| `GET /auth/google/callback` | OAuth callback — exchanges code, fetches profile |
| `GET /profile` | Displays user profile (requires login) |
| `GET /api/user` | Returns user data as JSON |
| `POST /auth/logout` | Destroys session, redirects to login |

## Security Notes

- CSRF protection via `state` parameter
- HTTP-only session cookies
- Server-side code exchange (client secret never exposed to browser)
- No credentials stored in code — use environment variables
