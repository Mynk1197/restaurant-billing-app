# Restaurant Billing

A fast restaurant billing PWA backed by Google Sheets (no database, no server to run). Staff pick dishes, the app computes SGST/CGST, saves the bill, and shares a PDF receipt straight to the customer's WhatsApp — no WhatsApp Business API required.

- `apps-script/` — the backend: a Google Apps Script bound to your Google Sheet, exposed as a Web App API.
- `web/` — the frontend: a React + Vite Progressive Web App, installable on phones.

## 1. Create the Google Sheet

1. Create a new Google Sheet (e.g. "Restaurant Billing").
2. Extensions → Apps Script.
3. Delete the default `Code.gs` content and paste in the contents of `apps-script/Code.gs`.
4. In the Apps Script editor, open `appsscript.json` (Project Settings → "Show appsscript.json") and replace it with `apps-script/appsscript.json`.
5. From the function dropdown, select `setupSheets` and click Run once. This creates the `Staff`, `Dishes`, `Settings`, `Bills` tabs — `Settings` is pre-filled with default GST rates and restaurant fields. Grant the permissions it asks for.
6. Go back to the Sheet and fill in the `Staff` tab with whoever should be able to use the app:
   | Email | Name |
   |---|---|
   | staff@gmail.com | Priya |
7. Edit the `Settings` tab: set `RestaurantName`, `Address`, `Phone`, `SGSTRate`, `CGSTRate` to your real values (rates are plain numbers, e.g. `2.5` for 2.5%).
8. Add at least a couple of rows to the `Dishes` tab (or use the Menu screen in the app once it's running) — `Id` can be left blank and will be filled in automatically if you add dishes from the app instead.

## 2. Deploy the Apps Script as a Web App

1. In the Apps Script editor: Deploy → New deployment → type "Web app".
2. Execute as: **Me**. Who has access: **Anyone**. (Auth is enforced inside the script by verifying the signed-in Google user against the `Staff` tab — no one else can read/write even though the endpoint itself is public.)
3. Deploy, authorize, and copy the Web App URL (ends in `/exec`).

## 3. Set up Google Sign-In (OAuth client)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID, type "Web application" (you can reuse an existing Google Cloud project/account you already use for other apps — just add a new, separate Client ID here).
3. Add your eventual hosting URL (e.g. `https://restaurant-billing.web.app`) and `http://localhost:5173` (for local dev) under "Authorized JavaScript origins".
4. Copy the generated Client ID.

## 4. Configure and build the frontend

```bash
cd web
cp .env.example .env
# edit .env:
#   VITE_APPS_SCRIPT_URL=<web app URL from step 2>
#   VITE_GOOGLE_CLIENT_ID=<client ID from step 3>
npm install
npm run dev      # local testing at http://localhost:5173
npm run build    # production build in web/dist
```

## 5. Host it (Firebase Hosting, free)

```bash
npm install -g firebase-tools
firebase login
cd web
firebase init hosting
#   - use an existing/new Firebase project (can be the same account/project you use elsewhere, as a new hosting site)
#   - public directory: dist
#   - configure as single-page app: Yes
#   - set up automatic builds with GitHub: optional, No is fine
firebase deploy
```

Firebase gives you a URL like `https://restaurant-billing.web.app`. Open it on a phone browser and use "Add to Home Screen" to install it like a native app.

Remember to add that final URL to the OAuth client's Authorized JavaScript origins (step 3) and redeploy if it changed.

## Notes

- **WhatsApp sharing**: on a phone, "Share on WhatsApp" opens the native share sheet with the bill PDF attached — pick WhatsApp and it goes straight to the chat. On desktop browsers (or if file sharing isn't supported), it falls back to opening a WhatsApp chat with a text summary; use "Download PDF" to send the file separately in that case.
- **Offline support**: a bill created while offline is queued locally (IndexedDB) and synced automatically once back online. The bill number is assigned by the server at sync time.
- **GST**: SGST and CGST are computed server-side from the `Settings` sheet rates — the app never trusts client-side totals for the saved record, only for the live preview while billing.
- **Reports**: total sales, bill count, GST collected, payment-method breakdown, and item-wise sales are computed by the Apps Script backend from the raw `Bills` sheet for any date range.
- **Single shared login**: v1 doesn't track which staff member created which bill — anyone listed in the `Staff` tab shares one view of the data.
