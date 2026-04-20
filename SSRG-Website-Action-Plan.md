# SSRG Website Upgrade — Owner Action Plan

## What This Is

This document outlines the steps the SSRG team needs to take to move the website off Wix, set up an admin panel for managing events and photos, and start accepting payments for event registration. Each section tells you **what to do**, **where to go**, and **what it costs**.

---

## Step 1: Set Up Hosting (Replace Wix)

**What:** Move the new SSRG website to Vercel, a modern hosting platform built specifically for the technology our site uses.

**Why Vercel:**
- Free for our level of traffic
- The company that built our website framework (Next.js) — best compatibility
- Automatic security (SSL certificates)
- Site updates go live in seconds when we push code changes

**What you need to do:**

1. **Create a Vercel account** at [vercel.com](https://vercel.com) — sign up with GitHub
2. **Create a GitHub account** (if you don't have one) at [github.com](https://github.com) — this is where the website code will live
3. Once the developer connects the code to Vercel, **add the custom domain** in the Vercel dashboard

**Domain DNS Change (GoDaddy):**

Once Vercel is set up, you'll need to update your GoDaddy DNS settings so your domain points to Vercel instead of Wix:

1. Log in to [GoDaddy](https://www.godaddy.com)
2. Go to **My Products** → **DNS** for your domain
3. The developer will provide the exact DNS records to add/change (a simple copy-paste)
4. Changes take effect within a few hours

**Cost:** $0/month (free tier)

---

## Step 2: Set Up the Database & Admin System

**What:** Create a Supabase account. Supabase is an all-in-one service that provides the database (where events and photos are stored), user login for admins, and image/photo storage.

**Why Supabase:**
- Free tier is more than enough (500 MB database, 1 GB photo storage)
- One service instead of three — simpler to manage
- No credit card required to start

**What you need to do:**

1. **Create a Supabase account** at [supabase.com](https://supabase.com) — sign up with GitHub
2. **Create a new project** — name it something like "SSRG Website"
   - Choose a strong database password and save it somewhere secure
   - Select the region closest to your members (e.g., West US for LA)
3. **Create an admin login** — the developer will set up email/password login for admins
   - Decide which email addresses should have admin access
   - Each admin will log in at `yoursite.com/admin`

**What admins will be able to do:**
- Add, edit, and remove events (with title, date, price, description, and photo)
- Upload photos to media galleries (Drives/Rallies, Track Events, Private Parties, Coffee Runs)
- Remove photos from galleries
- Save events as drafts before publishing them to the site

**Cost:** $0/month (free tier). If the club grows significantly, the paid plan is $25/month.

---

## Step 3: Set Up Payment Processing (Replace Wix Payments)

**What:** Create a Stripe account to accept payments for event registrations.

**Why Stripe:**
- Industry standard — used by companies like Lyft, DoorDash, Shopify
- Easiest to integrate with our website
- Members can pay with credit card, Apple Pay, or Google Pay
- You never handle credit card numbers — Stripe manages all of that securely
- Full dashboard to view payments, issue refunds, and export data
- Supports future membership dues if needed

**What you need to do:**

1. **Create a Stripe account** at [stripe.com](https://stripe.com)
2. **Complete business verification** — Stripe will ask for:
   - Business name (SSRG or the legal entity name)
   - Business type (LLC, sole proprietorship, etc.)
   - EIN or SSN (for tax reporting)
   - Bank account for receiving payouts (where the money goes)
   - A brief description of what you sell ("Event registration for an exotic car club")
3. **Set your payout schedule** — in the Stripe Dashboard under Settings → Payouts
   - Default is a 2-day rolling payout to your bank account
   - You can change this to weekly or monthly if preferred

**How payments will work for members:**
1. Member visits the Events page and clicks **Register Now**
2. They're taken to a secure Stripe payment page (branded with SSRG logo/colors)
3. They enter their name, email, card info (or use Apple Pay / Google Pay)
4. They also enter their car make/model and Instagram handle (optional)
5. After payment, they see a confirmation page and receive an email receipt
6. You see the registration in your Stripe Dashboard immediately

**How to issue refunds:**
1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Go to **Payments** → find the payment → click **Refund**
3. Choose full or partial refund
4. Member receives the refund in 5-10 business days

**Cost:**
- No monthly fee
- 2.9% + $0.30 per transaction

| Event Price | Stripe Fee | You Receive |
|-------------|-----------|-------------|
| $500 | $14.80 | $485.20 |
| $1,500 | $43.80 | $1,456.20 |
| $3,000 | $87.30 | $2,912.70 |

---

## Summary of Accounts to Create

| # | Service | URL | Purpose | Monthly Cost |
|---|---------|-----|---------|-------------|
| 1 | GitHub | github.com | Code storage & deployment trigger | Free |
| 2 | Vercel | vercel.com | Website hosting | Free |
| 3 | Supabase | supabase.com | Database, admin login, photo storage | Free |
| 4 | Stripe | stripe.com | Payment processing | Free + per-transaction fees |

**Total fixed monthly cost: $0**

---

## Information the Developer Will Need From You

Once the accounts are created, share the following with the developer (securely — not over text/DM):

| From | What's Needed |
|------|---------------|
| **Supabase** | Project URL, Anon Key, Service Role Key (found in Project Settings → API) |
| **Stripe** | Publishable Key, Secret Key (found in Developers → API Keys) |
| **GoDaddy** | Login credentials or DNS access to update domain records |
| **Admin users** | List of email addresses that should have admin access |

---

## Timeline Expectations

| Phase | What Happens | Owner Action Needed |
|-------|-------------|-------------------|
| **Week 1** | Accounts created, database set up | Create accounts listed above |
| **Week 2-3** | Admin panel built, events & media management working | Test admin login, try uploading a photo |
| **Week 3-4** | Stripe integrated, payment flow working | Complete Stripe business verification |
| **Week 4-5** | Testing, polish, deployment | Review the site, confirm everything works |
| **Go Live** | DNS switched from Wix to Vercel | Approve the switch, monitor for a few days |

---

## Questions to Decide

1. **Which email addresses should have admin access?** (e.g., Sally, other board members)
2. **What bank account should Stripe payouts go to?**
3. **What is the legal business entity name for Stripe verification?**
4. **Do you want to keep Wix active for a transition period, or switch immediately?** (Recommended: keep Wix running for 1-2 weeks after go-live as a safety net)
5. **Should members receive a confirmation email after registering for events?** (Stripe sends a receipt automatically, but we can also send a custom branded email)
