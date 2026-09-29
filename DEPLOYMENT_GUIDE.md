# 🚀 Fire Guardian — Production Deployment Guide (Vercel & Render)

This guide provides step-by-step instructions to deploy the **Fire Guardian ML Safety System**:
1. **Frontend Dashboard** $\rightarrow$ Deployed on **Vercel**
2. **AI Machine Learning Engine** $\rightarrow$ Deployed on **Render.com**

---

## 📌 Prerequisites & GitHub Repository

- **GitHub Repository**: [https://github.com/Janaarthanandev/fire-Project](https://github.com/Janaarthanandev/fire-Project)
- All configuration files (`vercel.json`, `backend/requirements.txt`, trained model `.pkl` files) are pushed and live on GitHub.

---

## 💻 1. Deploying the React Dashboard on Vercel

Vercel provides free, instant, automatic deployment for React + Vite web applications.

### Step-by-Step Vercel Deployment:

1. Go to **[vercel.com/new](https://vercel.com/new)** and log in with your GitHub account (**Janaarthanandev**).
2. Under **Import Git Repository**, search for **`fire-Project`** and click **Import**.
3. In the **Configure Project** screen:
   - **Project Name**: `fire-project` (or your preferred name)
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click **Edit** and select **`dashboard`** (or type `dashboard`).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** (Optional if default Supabase keys are used):
   - `VITE_GODOWN_ID` = `godown_filling_01`
5. Click **Deploy**.
6. Vercel will build the project in ~45 seconds and output a live public URL (e.g. `https://fire-project-one.vercel.app`).

---

## 🧠 2. Deploying the ML Backend Engine on Render.com

Render.com provides free Python FastAPI web service hosting.

### Step-by-Step Render Deployment:

1. Go to **[dashboard.render.com](https://dashboard.render.com)** and log in with your GitHub account.
2. Click **New +** (top right) $\rightarrow$ Select **Web Service**.
3. Under **Connect a repository**, select **`Janaarthanandev/fire-Project`**.
4. Configure the Web Service fields:
   - **Name**: `fire-guardian-ml-backend`
   - **Region**: Oregon (US West) or Frankfurt (EU Central)
   - **Branch**: `master`
   - **Root Directory**: **`backend`**
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
5. Scroll down to **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | `https://kcvbagkwmttglvjoztsu.supabase.co` |
   | `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdmJhZ2t3bXR0Z2x2am96dHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NDkzOTcsImV4cCI6MjEwNDAyNTM5N30.BnleXdqYhPGRCpZ24bJcJ5_C7luMqQxOFHMqr12ntqE` |
   | `GODOWN_ID` | `godown_filling_01` |

6. Click **Create Web Service**.
7. Render will build and launch your FastAPI ML inference server in ~2 minutes, assigning a public URL (e.g. `https://fire-guardian-ml-backend.onrender.com`).

---

## ⚡ 3. Verification & Live System Health Check

Once both Vercel and Render deployments complete:

1. **Verify Backend Health**: Open `https://fire-guardian-ml-backend.onrender.com/health` in your browser. It will return:
   ```json
   {
     "status": "ok",
     "godown_id": "godown_filling_01"
   }
   ```
2. **Verify Dashboard**: Open your Vercel URL (e.g. `https://fire-project-one.vercel.app`).
   - The top header will show `🟢 SUPABASE LIVE REAL-TIME`.
   - All 7 sections (Zone Cards, Actuators, M1/M2 ML Panels, 8x8 IR Thermal Matrix, Log Table, and Recharts Graphs) will render live.
