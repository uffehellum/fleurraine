# Local Development Guide

This guide will help you run Fleurraine locally and debug Google OAuth authentication issues.

## Quick Start

### 1. Database Setup

Your `.env` is already configured to use the Fly.io PostgreSQL database:

```bash
DATABASE_URL=postgres://fleurraine:XvSvGJr2Mri9hHS@fleurraine-db.flycast:5432/fleurraine?sslmode=disable
```

This will connect your local development environment to the production database on Fly.io.

**Note:** If you prefer a local PostgreSQL database instead, see the "Using Local PostgreSQL" section at the bottom of this guide.

All other variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc.) are already configured.

### 2. Start the Backend

```bash
# Export environment variables
set -a && source .env && set +a

# Run the Go server
go run ./cmd/server
```

The API will start on **http://localhost:8080**

### 4. Start the Frontend (in a new terminal)

```bash
cd web
npm install
npm run dev
```

The frontend will start on **http://localhost:5173**

### 5. Open the App

Visit **http://localhost:5173** in your browser.

---

## Debugging Google OAuth Issues

If you're getting "google authentication failed" errors, follow these steps:

### Step 1: Verify Google OAuth Configuration

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID: `887157645579-dlejf1lmo9o8rptfog5j5tknogfjrpme`
3. Click on it to edit

### Step 2: Check Authorized Redirect URIs

Make sure these URIs are registered:

**For Local Development:**
```
http://localhost:5173/auth/callback?provider=google
```

**For Production:**
```
https://fleurraine.fly.dev/auth/callback?provider=google
```

### Step 3: Add Test Users (CRITICAL!)

If your Google OAuth app is in "Testing" mode:

1. In Google Cloud Console, go to **OAuth consent screen**
2. Scroll to **Test users** section
3. Click **+ ADD USERS**
4. Add your email addresses:
   - `uffe.hellum@gmail.com`
   - `lorraine.hellum@gmail.com`
5. Click **SAVE**

**OR** publish your app:
1. In **OAuth consent screen**, click **PUBLISH APP**
2. This allows any Google account to sign in

### Step 4: Check Browser Console for Errors

1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to **Console** tab
3. Try signing in with Google
4. Look for error messages

Common errors:
- `redirect_uri_mismatch` → Check Step 2
- `access_blocked` → Check Step 3 (test users)
- Network errors → Check that backend is running on port 8080

### Step 5: Check Backend Logs

In the terminal where you ran `go run ./cmd/server`, look for:

```
POST /api/auth/google
```

If you see errors like:
- `google: token endpoint returned 400` → Redirect URI mismatch
- `google: tokeninfo returned 401` → Invalid credentials
- `google authentication failed` → User not in test users list

### Step 6: Verify Environment Variables

**Backend (.env):**
```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
ADMIN_EMAILS=your-email@example.com
```

**Frontend (web/.env.local):**
```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### Step 7: Test the OAuth Flow

1. Click **Sign in** → **Sign in with Google**
2. You should be redirected to Google's consent screen
3. After approving, you should be redirected back to `http://localhost:5173/auth/callback?provider=google&code=...`
4. The frontend will exchange the code for a session
5. You should see your name in the header

---

## Common Issues & Solutions

### Issue: "redirect_uri_mismatch"

**Solution:** Add `http://localhost:5173/auth/callback?provider=google` to Authorized redirect URIs in Google Cloud Console.

### Issue: "access_blocked: This app is blocked"

**Solution:** Add your email to test users in OAuth consent screen, or publish the app.

### Issue: "google authentication failed"

**Possible causes:**
1. User not in test users list (if app is in testing mode)
2. Invalid client secret
3. Redirect URI mismatch

**Debug steps:**
1. Check backend logs for specific error
2. Verify test users are added
3. Verify redirect URI matches exactly (including query parameters)

### Issue: Backend not receiving requests

**Solution:** 
1. Check that backend is running on port 8080
2. Check Vite proxy configuration in `web/vite.config.ts`
3. Look for CORS errors in browser console

### Issue: "Session not found or expired"

**Solution:**
1. Clear browser cookies for localhost:5173
2. Try signing in again
3. Check that DATABASE_URL points to running PostgreSQL

---

## Debugging Checklist

- [ ] Backend is running on port 8080 (check terminal output)
- [ ] Frontend is running on port 5173 (check terminal output)
- [ ] `web/.env.local` exists with VITE_GOOGLE_CLIENT_ID
- [ ] Google OAuth redirect URI includes `http://localhost:5173/auth/callback?provider=google`
- [ ] Your email is added as a test user in Google Cloud Console
- [ ] Browser console shows no errors
- [ ] Backend logs show no errors

---

## Testing Admin Access

After successful sign-in:

1. Your email should be in `ADMIN_EMAILS` in `.env`
2. You should see admin links in the header:
   - Queue
   - Orders
   - Analytics
3. If you don't see these, restart the backend after updating `ADMIN_EMAILS`

---

## Need More Help?

1. Check backend terminal for detailed error messages
2. Check browser DevTools → Console for frontend errors
3. Check browser DevTools → Network tab to see API requests/responses
4. Verify all environment variables are loaded: `echo $GOOGLE_CLIENT_ID` (after `set -a && source .env && set +a`)

---

## Using Local PostgreSQL (Optional)

If you prefer to use a local PostgreSQL database instead of the Fly.io database:

### 1. Start Local PostgreSQL

```bash
docker run --name fleurraine-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=fleurraine \
  -p 5432:5432 \
  -d postgres:16
```

### 2. Update .env

Change the DATABASE_URL in your `.env` file:

```bash
# Comment out the Fly.io database
# DATABASE_URL=postgres://fleurraine:XvSvGJr2Mri9hHS@fleurraine-db.flycast:5432/fleurraine?sslmode=disable

# Use local PostgreSQL
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fleurraine?sslmode=disable
```

### 3. Restart the Backend

```bash
set -a && source .env && set +a
go run ./cmd/server
```

The migrations will run automatically and create the necessary tables in your local database.
