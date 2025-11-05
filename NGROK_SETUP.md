# 🔗 Setting Up ngrok for Local M-Pesa Development

This guide will help you set up ngrok to receive M-Pesa callbacks on your local development server.

## 📋 Prerequisites

- ngrok account (free tier works)
- Backend server running on port 5001

## 🚀 Step 1: Install ngrok

### macOS
```bash
brew install ngrok/ngrok/ngrok
```

### Linux/Windows
Download from: https://ngrok.com/download

## 🚀 Step 2: Sign up and Get Your Auth Token

1. Go to https://dashboard.ngrok.com/signup
2. Sign up for a free account
3. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
4. Run: `ngrok config add-authtoken YOUR_AUTH_TOKEN`

## 🚀 Step 3: Start ngrok

In a new terminal window, run:

```bash
ngrok http 5001
```

This will give you output like:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:5001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

## 🚀 Step 4: Update Backend .env File

Add or update this line in `backend/.env`:

```env
MPESA_CALLBACK_URL=https://abc123.ngrok-free.app/api/mpesa/callback
```

Replace `abc123.ngrok-free.app` with your actual ngrok URL.

## 🚀 Step 5: Restart Backend Server

Restart your backend server to load the new callback URL:

```bash
cd backend
npm start
```

## ✅ Verify It's Working

1. Check the backend logs when starting - you should see:
   ```
   ✅ Using callback URL from environment: https://abc123.ngrok-free.app/api/mpesa/callback
   ```

2. Make a test payment - the callback should now reach your local server!

## 🔄 Important Notes

- **Free ngrok URLs change every time you restart ngrok** - you'll need to update `.env` each time
- **ngrok free tier has connection limits** - upgrade if you need more
- **For production**, use the production callback URL (Render server)
- **Keep ngrok running** while developing - if it stops, callbacks won't work

## 🐛 Troubleshooting

### Callbacks still going to production?
- Check that `MPESA_CALLBACK_URL` is set correctly in `.env`
- Verify ngrok is running and accessible
- Check backend logs for which callback URL is being used

### ngrok URL not accessible?
- Make sure ngrok is running
- Check that your backend is running on port 5001
- Verify the ngrok URL in your browser

### Want a stable URL?
- Upgrade to ngrok paid plan for static domains
- Or use a service like Serveo or Cloudflare Tunnel

