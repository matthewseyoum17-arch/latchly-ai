# LeadPilot AI — Landing Page

A 24/7 AI website assistant that answers questions, captures leads, and sends real customers to your phone.

## 🚀 Deploy to Railway

### Option A: Deploy from GitHub (Recommended)

1. **Push this project to a GitHub repo:**
   ```bash
   cd leadpilot-ai
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/leadpilot-ai.git
   git branch -M main
   git push -u origin main
   ```

2. **Go to [railway.app](https://railway.app)** → New Project → Deploy from GitHub Repo

3. **Select your repo** → Railway auto-detects Next.js and deploys

4. **Generate a domain:**
   - Go to your service → Settings → Networking → Generate Domain
   - You'll get a URL like `leadpilot-ai-production.up.railway.app`

5. **(Optional) Add a custom domain:**
   - Settings → Networking → Custom Domain
   - Add your domain and update your DNS records

### Option B: Deploy with Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd leadpilot-ai
railway init

# Deploy
railway up

# Generate a public URL
railway domain
```

## 🛠 Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
leadpilot-ai/
├── app/
│   ├── layout.js      # Root layout with fonts & metadata
│   ├── globals.css     # Global styles & animations
│   └── page.js         # Main landing page component
├── public/             # Static assets (add logo, images here)
├── next.config.js      # Next.js config (standalone output for Railway)
├── railway.toml        # Railway deployment config
├── package.json        # Dependencies & scripts
└── README.md
```

## 🔑 Environment Variables (for future features)

When you add backend features (Stripe, email, etc.), add these in Railway:
- Railway Dashboard → Your Service → Variables tab

```
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-domain.com
```

## 📝 Next Steps

- [ ] Connect real AI (OpenAI/Anthropic API) for dynamic responses
- [ ] Add Stripe payment integration
- [ ] Set up PostgreSQL database on Railway
- [ ] Build admin dashboard with real data
- [ ] Add email/SMS notifications (SendGrid, Twilio)
- [ ] Implement the embeddable widget as a separate script
