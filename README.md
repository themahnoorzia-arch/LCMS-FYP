# Legal Case Management System (Court Central)

A role-based web application for managing legal cases, hearings, appeals, evidence, payments and notifications across five roles: **Administrator, Lawyer, Judge, Court Registrar,** and **Case Participant (Client)**.

**Tech stack:** React (Vite, JavaScript/JSX) · Flask (Python) · PostgreSQL (Supabase) · SQLAlchemy + psycopg2

---

## Prerequisites

Before you start, make sure you have:

- **Python 3.10+** (check with `python --version`)
- **Node.js 18+** and npm (check with `node --version`)
- **A PostgreSQL database** — either your own, or a [Supabase](https://supabase.com) project (recommended, this is what the project was built and tested against)
- **Git**

---

## 1. Clone the repository

```bash
git clone <your-repo-url>
cd LegalCaseManagementSystem
```

## 2. Backend setup

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

### Environment variables

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

### Database tables

- **Using an existing, already-populated database** (e.g. sharing the project's Supabase instance): skip this step entirely — the tables and data already exist.
- **Starting from a brand-new, empty database**: create the schema, then optionally load sample data:
  ```bash
  python create_tables.py
  python seed_database.py
  ```
  `seed_database.py` populates a full demo dataset (a court, sample cases, hearings, evidence, etc.) and prints a list of ready-to-use login accounts — see [Demo Accounts](#demo-accounts) below. It's safe to re-run at any time.

  > No Administrator account is seeded by default. To get one, just register a new account through the app's Sign Up page and choose **Administrator** as the role.

## 3. Frontend setup

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

If you ran `seed_database.py`, every seeded account shares the password:

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

(No Administrator account is seeded — register one manually, as noted above.)

---

## Project Structure

```
LegalCaseManagementSystem/
├── backend/
│   ├── app.py                  # Flask app factory & entry point
│   ├── config.py                # Environment/config loading
│   ├── models.py                # SQLAlchemy models
│   ├── create_tables.py         # One-time schema creation
│   ├── seed_database.py         # Demo data loader
│   ├── db/                      # Database connection layer
│   ├── utils/                   # Shared helpers (logging, notifications, migrations)
│   └── blueprints/               # API routes, grouped by feature
│       ├── auth/                 # Signup, login, OTP, password recovery
│       ├── cases/                # Cases, hearings, appeals, evidence, join requests
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

## Project Overview & Screenshots

# Home Page:
 <img width="1072" height="475" alt="image" src="https://github.com/user-attachments/assets/3e99fc48-ae0d-40df-9afa-de56c88f1554" />

Displays the landing page of the Legal Case Management System, highlighting its purpose to simplify case management
Dashboards:
<img width="1072" height="525" alt="image" src="https://github.com/user-attachments/assets/6127023e-09fa-467d-99cc-c25fd51271c5" />

 Shows the dashboard view for a Court Registrar, providing quick actions for managing court rooms, cases, and appeals
 <img width="1072" height="524" alt="image" src="https://github.com/user-attachments/assets/a732e4ce-fb62-444d-9f19-73e77c939849" />

Illustrates the dashboard for a Lawyer, featuring a list of assigned cases with details and action options
<img width="1072" height="510" alt="image" src="https://github.com/user-attachments/assets/7361d571-fd6e-4c9c-a667-bd6340b98404" />

Displays the Judge's interface showing assigned cases with options to view history, evidence, witnesses, and decisions
 <img width="1072" height="517" alt="image" src="https://github.com/user-attachments/assets/edf8f93e-ab36-43f3-90a5-827017aa4eea" />

Shows the Client's view of their cases, including case title, assigned lawyer and court, status, and history
 

<img width="1072" height="521" alt="image" src="https://github.com/user-attachments/assets/4e42bca8-7751-4dbe-a04a-8ad8de368d57" />


Displays the Admin dashboard showing system logs, including action type, description, status, and timestamp for tracking changes
 


#Some buttons\functionalities:
<img width="1072" height="514" alt="image" src="https://github.com/user-attachments/assets/9b2cc1f4-aa81-4444-81fe-ba7954825b1b" />

A pop-up window showing the final decision details for a case, including decision date, summary, and verdict

 <img width="1072" height="523" alt="image" src="https://github.com/user-attachments/assets/32258d20-9b3f-4836-8d5a-41eeda9c4008" />

Depicts a calendar interface, used for scheduling and viewing hearing dates

 <img width="1072" height="516" alt="image" src="https://github.com/user-attachments/assets/ffdd3b84-1009-4775-ae77-774d9801928c" />

A pop-up window allowing the editing of hearing details, such as case name, date, time, venue, and judge

 <img width="1035" height="510" alt="image" src="https://github.com/user-attachments/assets/52624ec9-52b3-4eac-9c69-b5622c4815f7" />




Shows a pop-up form for judges to announce the final decision of a case by entering the verdict, date, and summary

 <img width="1047" height="536" alt="image" src="https://github.com/user-attachments/assets/2b2ad721-a208-4476-9326-2710f6c011d8" />


A pop-up box for adding remarks or notes related to a specific hearing.
 


#Backend:
The backend coding was done by using Flask to create API's which were called through the frontend. 
First, an API endpoint would be defined in flask like so:

 <img width="610" height="1003" alt="image" src="https://github.com/user-attachments/assets/e5513419-aba8-406f-9344-877ac0800d8c" />

Demonstrates the Flask code for defining an API endpoint to fetch appeals data for the frontend.

Then the API would be tested in postman:
 <img width="920" height="471" alt="image" src="https://github.com/user-attachments/assets/e02c0a7b-28f4-434e-9f04-712becfdfb4b" />

Shows the successful testing of the backend API endpoint using Postman, confirming it returns the expected data

After receiving confirmation of the APIs working, then the API call would be included in the frontend.

#Workflow for connecting frontend and backend:
The API calls for CRUD operations would be included in the frontend code as such:
 <img width="515" height="546" alt="image" src="https://github.com/user-attachments/assets/50a091c2-2373-4ea9-819b-64445755b60c" />

Illustrates the frontend code using React to call the backend API to retrieve and display appeals

The results of which can be seen as follows:
<img width="1072" height="498" alt="image" src="https://github.com/user-attachments/assets/e9581c12-be6a-4e0b-abc9-6049a7531f03" />
