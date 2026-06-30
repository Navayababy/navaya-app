# Navaya App — Setup Guide

This guide takes you from zero to a live app. Follow each step in order.
Estimated time: 30–45 minutes.

---

## What you'll need to create (all free)

- A GitHub account — github.com
- A Vercel account — vercel.com
- An Anthropic API key — console.anthropic.com

---

## Step 1 — Install Node.js

Node.js is the engine that runs the app on your computer.

1. Go to **nodejs.org**
2. Click the big green **LTS** button to download
3. Open the downloaded file and follow the installer
4. When it's done, you won't see anything — that's normal

---

## Step 2 — Get the code onto your computer

1. Download this project as a ZIP file (there will be a button in Claude)
2. Unzip it — you'll get a folder called `navaya`
3. Move the `navaya` folder to your Desktop so it's easy to find

---

## Step 3 — Open the Terminal

The Terminal lets you type commands to your computer.

**On Mac:**
1. Press `Cmd + Space`
2. Type `terminal`
3. Press Enter

**On Windows:**
1. Press the Windows key
2. Type `powershell`
3. Press Enter

---

## Step 4 — Navigate to the project folder

In the Terminal, type exactly this and press Enter:

```
cd ~/Desktop/navaya
```

(On Windows, type: `cd C:\Users\YourName\Desktop\navaya`)

---

## Step 5 — Install the app's dependencies

Type this and press Enter. It will download the code the app needs. This takes 1–2 minutes.

```
npm install
```

You'll see a lot of text scroll past — that's normal.

---

## Step 6 — Get your Anthropic API key

The AI chat needs an API key to work.

1. Go to **console.anthropic.com**
2. Sign up or log in
3. Click **API Keys** in the left menu
4. Click **Create Key**
5. Copy the key (it starts with `sk-ant-...`) — save it somewhere safe

---

## Step 7 — Test the app locally

Type this and press Enter:

```
npm run dev
```

You'll see something like:
```
  ➜  Local:   http://localhost:5173/
```

Open that address in your browser. The app should appear.

**Note:** The AI chat won't work yet locally — that's fine. It will work once you deploy to Vercel in the next steps.

Press `Ctrl + C` in the Terminal when you want to stop the local server.

---

## Step 8 — Put the code on GitHub

GitHub stores your code safely in the cloud and lets Vercel access it.

1. Go to **github.com** and sign in (or create an account)
2. Click the **+** button at the top right → **New repository**
3. Name it `navaya-app`
4. Leave everything else as default
5. Click **Create repository**
6. GitHub will show you a page with instructions — follow the section that says **"…or push an existing repository from the command line"**
7. Copy those three lines and paste them into your Terminal one at a time

---

## Step 9 — Deploy to Vercel

1. Go to **vercel.com** and sign in with GitHub
2. Click **Add New → Project**
3. Find `navaya-app` in your list and click **Import**
4. On the configuration screen, don't change anything
5. Click **Deploy**

Vercel will build your app. This takes about a minute. When it's done you'll see a URL like `navaya-app.vercel.app` — that's your live app.

---

## Step 10 — Add your Anthropic API key to Vercel

This is what makes the AI chat work in the live app.

1. In Vercel, go to your project
2. Click **Settings** at the top
3. Click **Environment Variables** in the left menu
4. Click **Add**
5. In the **Key** field type: `ANTHROPIC_API_KEY`
6. In the **Value** field, paste your API key from Step 6
7. Click **Save**
8. Go back to **Deployments** and click **Redeploy** on your latest deployment

The AI chat will now work on your live app.

---

## You're live

Your app is now running at `your-project-name.vercel.app`.

You can share this link with anyone. It works in any mobile browser and can be saved to a phone's home screen like an app.

---

## Making changes

Whenever you want to update the app:
1. Make your changes to the code files
2. In Terminal, run: `git add . && git commit -m "update" && git push`
3. Vercel will automatically redeploy

---

## Things to know

**Data is stored on the device for now.** Feed history and checklist are saved locally in the browser. This means they won't sync between two phones yet. Partner sync can be added later — it requires a Supabase database to be connected.

**The AI chat costs money to run.** Anthropic charges per message. At typical usage it's pennies per day, but keep an eye on your usage at console.anthropic.com.

**The app is private.** Only people with the link can access it. You control who you share it with.

---

## Optional — Step 11: See how people are using the app

The app can quietly send anonymous usage events (app opened, feed logged, nappy logged, etc.) to a free dashboard tool called **PostHog**. This is optional — skip this whole section if you don't want it. Nothing is tracked until you do this.

1. Go to **posthog.com** and sign up for a free account (no card needed)
2. When asked to create a project, give it any name (e.g. "Navaya")
3. In your new project, go to **Project Settings** → copy the **Project API Key** (starts with `phc_...`) and note your **region** (US or EU) — this decides your host URL:
   - US: `https://us.i.posthog.com`
   - EU: `https://eu.i.posthog.com`
4. **Locally:** open the `.env` file you created earlier and add two lines:
   ```
   VITE_POSTHOG_KEY=phc_your_key_here
   VITE_POSTHOG_HOST=https://us.i.posthog.com
   ```
5. **On the live app:** in Vercel, go to your project → **Settings** → **Environment Variables** → **Add**, and add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` the same way you added the Anthropic key. Then go to **Deployments** and **Redeploy**.
6. Use the app for a bit (start a feed, log a nappy), then go back to **posthog.com** → your project → **Activity** — you should see events like `feed_logged` and `screen_view` appearing within a minute or two.

**A quick dashboard to glance at:** in PostHog, go to **Dashboards** → **New dashboard** → **Start from template**, and add these insights:
- A trend of `screen_view` events grouped by `screen` — shows which tab people open most (Feed, Nappy, Sleep, Logbook, Sage)
- Unique users of `feed_logged`, `nappy_logged`, `sleep_logged`, `medicine_logged` and `sage_message_sent` (weekly), each as a separate insight — shows how many people use each feature and how often
- A trend of `account_created` (all-time, cumulative) — running total of people who've signed up
- A trend of `household_invite_accepted` — how many partners have joined a household

Pin that dashboard so it's the first thing you see when you log in to PostHog — that's your at-a-glance sense check.

**Privacy note:** only anonymous, coarse events are sent (e.g. "a breast feed was logged on the left side") — never baby names, parent names, chat messages, or medicine names/notes.

---

## Getting help

If anything goes wrong, take a screenshot of the error and share it. Every error message tells you exactly what went wrong — the trick is knowing how to read it.
