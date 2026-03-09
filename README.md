# CSA App — Continual Spiritual State

A Progressive Web Application (PWA) prototype for tracking spiritual growth across seven Christian spiritual gift categories.

## Prerequisites

- Node.js 18+
- XAMPP with MySQL running on port 3306
- npm

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
copy .env.example .env
```

Edit `.env` — XAMPP MySQL defaults are `root` with no password, so defaults may work as-is.

### 3. Set Up Database

Ensure XAMPP MySQL is running, then:

```bash
npm run db:setup
```

Follow the prompts to create the super admin account. Default suggestion: `admin@csa.local` / `Admin@123!`

**Change this password after first login.**

### 4. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## User Roles

| Role | Access |
|------|--------|
| `superadmin` | Full access — manage all groups/users, view all data |
| `group_admin` | Manage users in their group, view group dashboard |
| `user` | Take assessments, view personal dashboard |

---

## Seven Gift Categories

| # | Gift | Core Struggle |
|---|------|---------------|
| 1 | Bold Proclaimer | "Ready-Fire-Aim" speech |
| 2 | Relentless Server | Serves when convenient, burns out |
| 3 | Researching Teacher | Stuck in research, indecisive |
| 4 | Enthusiastic Encourager | People-pleaser |
| 5 | Generous Contributor | Needs affirmation for giving |
| 6 | Diligent Leader | Procrastination |
| 7 | Cheerful Mercy | Carrying hurts and sadness |

Each category is assessed on a 1–10 scale:
- **1–3**: Natural State (flesh-driven)
- **4–6**: Growing
- **7–10**: Spiritual State (Spirit-led)

---

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: MySQL (XAMPP)
- **Auth**: JWT (24h) + bcrypt (cost 12)
- **Frontend**: HTML5 + CSS3 + Vanilla JS — Material Design
- **Charts**: Chart.js (CDN)
- **PWA**: Service Worker + Web App Manifest

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | any | Current user |
| POST | `/api/auth/change-password` | any | Change password |
| GET | `/api/users` | admin | List users |
| POST | `/api/users` | admin | Create user |
| GET/PUT/DELETE | `/api/users/:id` | admin | Manage user |
| GET | `/api/groups` | admin | List groups |
| POST | `/api/groups` | superadmin | Create group |
| GET/PUT/DELETE | `/api/groups/:id` | admin | Manage group |
| GET | `/api/assessments/categories` | any | Gift categories |
| GET | `/api/assessments/dashboard` | any | Personal dashboard data |
| GET | `/api/assessments/group-dashboard` | admin | Group summary |
| GET/POST | `/api/assessments` | any | List/create assessments |
| GET | `/api/assessments/:id` | any | Single assessment |
