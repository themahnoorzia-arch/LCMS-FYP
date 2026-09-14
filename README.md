# Legal Case Management System (LegalEase)

A role-based web application for managing legal cases, hearings, evidence, payments, and notifications across five roles: **Administrator, Lawyer, Judge, Court Registrar,** and **Case Participant (Client)**.

**Tech stack:** React (Vite, JavaScript/JSX) · Flask (Python) · PostgreSQL (Supabase) · SQLAlchemy + psycopg2

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
- [Running the App](#running-the-app)
- [Demo Accounts](#demo-accounts)
- [Project Structure](#project-structure)
- [How It Was Built](#how-it-was-built)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [Project Team](#project-team)

---

## Overview

LegalEase digitizes the day-to-day workflow of a court registry: a client's case is filed by a lawyer, verified and opened by a court registrar, assigned a judge, taken through hearings, and closed with a final decision — with every role seeing only what's relevant to them, and every step producing an audit trail.

---

## Key Features

**Case lifecycle**
- Case filing by a lawyer, with client (participant) linkage
- Registrar verification: assigns an official case number, judge, and (optionally) prosecutor, and opens the case
- Lawyers on the opposing side can request to join an already-registered case; the request stays pending until a registrar approves it
- Case history / timeline view combining filing, verification, hearings, evidence, and decisions in one place
- Evidence and witness records attached to a case

**Hearings**
- Judges schedule and reschedule hearings for their assigned cases
- Double-booking protection: a client or judge already booked at an exact date/time is blocked from a second hearing at that same slot
- Hearing remarks and status tracking (scheduled / completed / etc.)

**Decisions & Payments**
- Judges announce a final decision (verdict, summary, date) once a case concludes
- Payments are tracked in PKR, with a registrar verification step before a payment counts as confirmed

**Notifications & Accounts**
- In-app notifications for key events (case approved, join request approved/rejected, etc.)
- Signup with OTP email verification, and email-based password recovery
- Judge and Court Registrar signups require Admin approval before they can log in

**Administration**
- Admin manages users (approve/reject pending Judge & Registrar signups, delete accounts) with built-in protections against deleting a Judge/Lawyer/Client who still has active (non-closed) cases
- Court and courtroom management, with judges affiliated to specific courts
- System-wide activity/audit log of admin actions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Bootstrap |
| Backend | Flask (Python), Flask-Login |
| Database | PostgreSQL (Supabase) |
| Data access | SQLAlchemy ORM + raw psycopg2 (mixed, by route) |
| Email | Flask-Mail (Gmail SMTP, App Password) |
| Deployment | Vercel (frontend) · Render (backend) · Supabase (database) |

---

## Screenshots

**Home page** — the landing page introducing LegalEase.

<img width="1072" height="475" alt="Home page" src="https://github.com/user-attachments/assets/3e99fc48-ae0d-40df-9afa-de56c88f1554" />

**Court Registrar dashboard** — quick actions for managing courtrooms and cases.

<img width="1072" height="525" alt="Registrar dashboard" src="https://github.com/user-attachments/assets/6127023e-09fa-467d-99cc-c25fd51271c5" />

<img width="1072" height="524" alt="Registrar dashboard detail" src="https://github.com/user-attachments/assets/a732e4ce-fb62-444d-9f19-73e77c939849" />

**Lawyer dashboard** — assigned cases with details and actions.

<img width="1072" height="510" alt="Lawyer dashboard" src="https://github.com/user-attachments/assets/7361d571-fd6e-4c9c-a667-bd6340b98404" />

**Judge dashboard** — assigned cases with history, evidence, witnesses, and decisions.

<img width="1072" height="517" alt="Judge dashboard" src="https://github.com/user-attachments/assets/edf8f93e-ab36-43f3-90a5-827017aa4eea" />

**Client (Case Participant) dashboard** — case title, assigned lawyer and court, status, and history.

<img width="1072" height="521" alt="Client dashboard" src="https://github.com/user-attachments/assets/4e42bca8-7751-4dbe-a04a-8ad8de368d57" />

**Admin dashboard** — system logs: action type, description, status, and timestamp.

<img width="1072" height="514" alt="Admin dashboard" src="https://github.com/user-attachments/assets/9b2cc1f4-aa81-4444-81fe-ba7954825b1b" />

**Final decision pop-up** — decision date, summary, and verdict.

<img width="1072" height="523" alt="Final decision modal" src="https://github.com/user-attachments/assets/32258d20-9b3f-4836-8d5a-41eeda9c4008" />

**Calendar view** — scheduling and viewing hearing dates.

<img width="1072" height="516" alt="Calendar view" src="https://github.com/user-attachments/assets/ffdd3b84-1009-4775-ae77-774d9801928c" />

**Edit hearing** — case name, date, time, venue, and judge.

<img width="1035" height="510" alt="Edit hearing modal" src="https://github.com/user-attachments/assets/52624ec9-52b3-4eac-9c69-b5622c4815f7" />

**Announce final decision** — verdict, date, and summary form for judges.

<img width="1047" height="536" alt="Announce decision modal" src="https://github.com/user-attachments/assets/2b2ad721-a208-4476-9326-2710f6c011d8" />

**Hearing remarks** — adding notes related to a specific hearing.

<img width="1072" height="498" alt="Hearing remarks" src="https://github.com/user-attachments/assets/e9581c12-be6a-4e0b-abc9-6049a7531f03" />

---

## Getting Started

### Prerequisites

- **Python 3.10+** (check with `python --version`)
- **Node.js 18+** and npm (check with `node --version`)
- **A PostgreSQL database** — either your own, or a [Supabase](https://supabase.com) project (recommended, this is what the project was built and tested against)
- **Git**

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd LegalCaseManagementSystem
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:
```bash
# Windows (PowerShell)
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

#### Environment variables

Create a file named `.env` inside the `backend/` folder (same folder as `app.py`) with the following:

```env
# Required — your PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host:port/dbname

# Optional — defaults shown
SESSION_TYPE=filesystem
SECRET_KEY=change-this-to-a-random-secret-string
FRONTEND_URL=http://localhost:5173

# Required for OTP email verification and password recovery
MAIL_USERNAME=your-gmail-address@gmail.com
MAIL_PASSWORD=your-gmail-app-password
```

> `MAIL_PASSWORD` must be a **Gmail App Password**, not your normal Gmail password — generate one from your Google Account's Security settings (2-Step Verification must be enabled first). Without valid mail credentials, signup and password recovery emails will silently fail to send.

#### Database tables

- **Using an existing, already-populated database** (e.g. sharing the project's Supabase instance): skip this step entirely — the tables and data already exist.
- **Starting from a brand-new, empty database**: create the schema, then optionally load sample data:
  ```bash
  python create_tables.py
  python seed_demo_data.py
  ```
  `seed_demo_data.py` populates a full demo dataset (a court, sample cases, hearings, evidence, etc.) and prints a list of ready-to-use login accounts — see [Demo Accounts](#demo-accounts) below. It's safe to re-run at any time.

  > No Administrator account is seeded, and **Admin accounts cannot be created through the Sign Up page** — the signup endpoint explicitly rejects `role: "admin"`, and there is no in-app "promote to Admin" tool. The only way to create one is directly in the database, e.g. from `backend/` with the virtual environment active:
  > ```bash
  > python -c "
  > from app import create_app
  > from db.db import SessionLocal
  > from models import Users, Admin
  > from werkzeug.security import generate_password_hash
  > from sqlalchemy import text
  >
  > app = create_app()
  > db = SessionLocal()
  > user = Users(firstname='Your', lastname='Name', email='admin@example.com',
  >               phoneno='03001234567', cnic='1234512345671', dob='1990-01-01',
  >               password=generate_password_hash('ChangeThisPassword!'), role='Admin')
  > db.add(user)
  > db.flush()
  > db.execute(text('UPDATE users SET is_email_verified=TRUE WHERE userid=:uid'), {'uid': user.userid})
  > db.add(Admin(userid=user.userid))
  > db.commit()
  > print('Admin created:', user.email)
  > "
  > ```
  > (`is_email_verified` must be set manually since there's no signup flow to send/verify an OTP for this account.)

### 3. Frontend setup

Open a new terminal (keep the backend one as-is):

```bash
cd frontend
npm install
npm run build
```

`npm run build` produces a `dist/` folder — the backend serves this directly, so **you must re-run this command any time you change frontend code** for the change to actually show up (see [Running the App](#running-the-app) below for why).

---

## Running the App

There are two ways to run this locally, depending on what you're doing:

### Option A — Single server (recommended for demos)

```bash
cd backend
venv\Scripts\activate    # if not already active
python app.py
```

Open **http://localhost:5000**. Flask serves both the API and the built frontend from one place — the simplest option if you just want to use or show off the app.

> ⚠️ If you change any frontend file, run `npm run build` again inside `frontend/` before refreshing — Flask serves the pre-built `dist/` folder, not your live source files, so it won't pick up frontend changes automatically. Backend (Python) changes, on the other hand, reload automatically since the app runs in debug mode.

### Option B — Two dev servers (recommended for active development)

```bash
# Terminal 1 — backend
cd backend
venv\Scripts\activate
python app.py

# Terminal 2 — frontend, with instant hot-reload
cd frontend
npm run dev
```

Open **http://localhost:5173** instead — Vite's dev server automatically proxies any `/api/*` request to the Flask backend on port 5000, and every frontend change appears instantly with no build step.

---

## Demo Accounts

If you ran `seed_demo_data.py`, every seeded account shares the password:

```
LegalEase2025!
```

| Role | Email |
|---|---|
| Client | client@gmail.com |
| Client | ali.raza@client.com |
| Lawyer | ahmed.khan@legalease.com |
| Lawyer | sara.malik@legalease.com |
| Lawyer | omar.hassan@legalease.com |
| Judge | test@judge.com |
| Court Registrar | registrar@legalease.com |

(No Administrator account is seeded, and none can be created via Sign Up — see the note above for creating one directly in the database.)

---

## Project Structure

```
LegalCaseManagementSystem/
├── backend/
│   ├── app.py                  # Flask app factory & entry point
│   ├── config.py                # Environment/config loading
│   ├── models.py                # SQLAlchemy models
│   ├── create_tables.py         # One-time schema creation
│   ├── seed_demo_data.py        # Demo data loader
│   ├── db/                      # Database connection layer
│   ├── utils/                   # Shared helpers (logging, notifications, migrations)
│   └── blueprints/               # API routes, grouped by feature
│       ├── auth/                 # Signup, login, OTP, password recovery
│       ├── cases/                # Cases, hearings, evidence, join requests
│       ├── financials/           # Payments
│       ├── legal_actors/         # Judges, lawyers, prosecutors, client search
│       ├── users/                # Profiles, admin management
│       ├── court/                # Courts and courtrooms
│       ├── notifications/        # In-app notifications
│       └── registrar_routes.py   # Registrar-specific actions (verify case, join-request review)
└── frontend/
    ├── src/
    │   ├── pages/                # One file per dashboard/major screen
    │   ├── components/           # Shared/reusable UI pieces
    │   └── utils/
    └── vite.config.js
```

---

## How It Was Built

The backend was built by defining Flask API endpoints, testing each one in Postman, and only then wiring it up to the frontend.

**1. Define the endpoint in Flask:**

<img width="610" height="1003" alt="Flask endpoint code" src="https://github.com/user-attachments/assets/e5513419-aba8-406f-9344-877ac0800d8c" />

**2. Test it in Postman:**

<img width="920" height="471" alt="Postman test" src="https://github.com/user-attachments/assets/e02c0a7b-28f4-434e-9f04-712becfdfb4b" />

**3. Call it from the frontend (React):**

<img width="515" height="546" alt="Frontend API call" src="https://github.com/user-attachments/assets/50a091c2-2373-4ea9-819b-64445755b60c" />

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Frontend changes don't appear | You forgot to run `npm run build` (Option A) — Flask serves the static `dist/` folder, not live source |
| `ValueError: DATABASE_URL environment variable is required` | `.env` is missing or in the wrong folder — it must sit directly inside `backend/` |
| Signup/OTP emails never arrive | `MAIL_USERNAME`/`MAIL_PASSWORD` missing or wrong — must be a Gmail **App Password**, not your account password |
| `ModuleNotFoundError` on `python app.py` | Virtual environment isn't activated, or `pip install -r requirements.txt` wasn't run inside it |
| Blank page or 404 at localhost:5000 | Frontend hasn't been built yet — run `npm run build` inside `frontend/` at least once |

---

## Deployment

This project is set up to deploy as three separate services:
- **Frontend** → Vercel (builds `frontend/`, `vercel.json` rewrites `/api/*` to the Render backend)
- **Backend** → Render (`gunicorn app:app`, environment variables set in the Render dashboard, not committed to git)
- **Database** → Supabase (PostgreSQL)

Pushing to the connected GitHub branch triggers an automatic rebuild on both Vercel and Render — local changes have no effect on the deployed URLs until they're pushed.

---

## Project Team

| Role | Name |
|---|---|
| Admin | Mahnoor Zia |
| Court Registrar | Bilal Ahmed |
| Court Registrar | Fatima Khalid |
| Judge | Ali Hamza |
| Judge | Rasheeda Tabassum |
| Lawyer | Zaina Zia |
| Lawyer | Hassan Malik |
| Lawyer | Ayesha Raza |
| Lawyer | Omar Farooq |
| Client | Kamran Malik |
| Client | Sana Tariq |
| Client | Hira Zia |
| Client | Faizan Zia |
| Client | Zia Ch |

Credentials for the live demo are shared separately and are not published in this repository.
