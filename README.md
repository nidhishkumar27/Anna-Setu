# 🍲 Anna Setu (अन्न सेतु) — Food Rescue & Donation Platform

> **Bridging the gap between surplus food and community need.**
> Anna Setu is a full-stack web application designed to orchestrate the end-to-end food rescue lifecycle — connecting food donors, verified recipient organizations, and a network of volunteers, all coordinated through an administrative dashboard with regulatory compliance and quality assurance.

---

## 📌 Table of Contents
- [About the Project](#-about-the-project)
- [✨ Core Features by Role](#-core-features-by-role)
  - [🍽️ Donors (Restaurants, Hotels & Individuals)](#️-donors)
  - [🚚 Volunteers (Logistics & Field Operations)](#-volunteers)
  - [🏠 Receivers (NGOs, Shelters & Communities)](#-receivers)
  - [⚙️ Administrators (Central Oversight & Dispatch)](#️-administrators)
- [🛡️ Quality Control & FSSAI Verification](#️-quality-control--fssai-verification)
- [🛠️ Technology Stack](#️-technology-stack)
- [📂 Project Directory Structure](#-project-directory-structure)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#1-backend-setup)
  - [Database & Admin Seeding](#2-database--admin-seeding)
  - [Frontend Setup](#3-frontend-setup)
- [🔑 Default Admin Credentials](#-default-admin-credentials)
- [📡 API Endpoints Summary](#-api-endpoints-summary)
- [🔮 Future Roadmap](#-future-roadmap)

---

## 📖 About the Project

In India, an estimated **40% of all food produced is wasted** while millions face food insecurity. Much of this waste consists of fresh, edible, high-quality meals from restaurants, banquet halls, and events that end up in landfills purely due to logistical bottlenecks.

**Anna Setu** ("Food Bridge") solves this through a multi-tier distribution model:
1. **Human Consumption:** Fresh, surplus edible food dispatched directly to verified shelters and NGOs.
2. **Animal Feed:** Surplus food safe for livestock and animal shelters routed appropriately.
3. **Composting & Circular Economy:** Organic food waste routed to composting partners, with revenue logging for sustainability.

---

## ✨ Core Features by Role

### 🍽️ Donors
- **Two Flexible Donor Profiles:**
  - **Instant Donors:** One-time individual donors who can register quickly without a business license and start donating immediately.
  - **Regular Donors (Restaurants, Hotels, Caterers):** Registered food businesses required to provide a valid **14-digit FSSAI License Number** during registration, pending administrative verification.
- **Smart Pickup Scheduling:** Specify food categorization (*Human Consumption*, *Animal Feed*, *Compost*), estimated quantity in kilograms, pickup address, and volunteer handling guidelines.
- **Live Status Tracking:** Real-time visibility into the status of each donation (*Pending Assignment* → *Volunteer Assigned* → *Picked Up* → *Delivered*).
- **Donation History & Metrics:** Comprehensive history of past contributions and meals provided.
- **User Profile Management:** Update organization contact details, address, and profile settings.

---

### 🚚 Volunteers
- **Task Discovery Dashboard:** View and accept available delivery tasks in real time.
- **Step-by-Step Delivery Lifecycle:** Progress tasks sequentially (*Accepted* → *Picked Up* → *Delivered*).
- **Mandatory Quality Check (QC) Form:** Upon pickup, volunteers submit a digital inspection report verifying:
  - Food condition (*Fresh / Edible / Poor*)
  - Packaging integrity (*Intact / Minor Damage / Damaged*)
  - Volunteer inspection notes and remarks before delivery approval.
- **Volunteer Training Hub:** Built-in guidance covering food hygiene standards, safe transport protocols, and courteous handover etiquette.

---

### 🏠 Receivers
- **Community Need Posting:** Verified NGOs, shelters, and orphanages can post requests for specific food quantities and requirements.
- **Incoming Delivery Dashboard:** Real-time visibility into upcoming food deliveries, assigned volunteers, and estimated arrival.
- **Receipt Confirmation:** Confirm successful delivery on the platform, closing the loop and recording impact metrics.

---

### ⚙️ Administrators
- **Real-Time Analytics Command Center:** Live platform counters for Total Donors, Total Receivers, Active Volunteers, Pending Approvals, and estimated Meals Served.
- **FSSAI License Verification & Approval:**
  - Dedicated verification interface displaying submitted 14-digit FSSAI registration numbers.
  - Direct integration link to cross-check credentials on the official **[FSSAI FOSCOS Portal](https://foscos.fssai.gov.in)** prior to granting approval.
- **User Role Moderation:** Review, approve, or reject pending regular donors, volunteers, and receiver organizations.
- **Logistics & Dispatch Coordination:** Match pending food donations with available volunteers and assign appropriate recipient shelters.
- **Quality Control Oversight:** Review submitted volunteer Quality Check reports to ensure food safety compliance.
- **Compost Management & Revenue Logging:** Track organic waste collection and log sales and revenue generated from compost.
- **Platform Activity Audit Log:** Real-time activity feed documenting registrations, approvals, dispatches, and deliveries.

---

## 🛡️ Quality Control & FSSAI Verification

Anna Setu integrates strict safety protocols at both entry and transit stages:

```
[ Restaurant Signs Up ] ──> Validates 14-digit FSSAI ──> Admin Checks FOSCOS ──> [ Account Approved ]
                                                                                       │
[ Donation Scheduled ] ──> [ Volunteer Assigned ] ──> Mandatory QC Form at Pickup ────> [ Delivered ]
                                                       (Freshness & Packaging)
```

1. **At Registration:** Regular food donors must submit their official 14-digit FSSAI license number. Both client-side and server-side validation enforce format and structure.
2. **At Approval:** Admin cross-checks the license directly on FOSCOS before authorizing food donations.
3. **At Pickup:** Field volunteers complete a mandatory inspection check before goods can be transported.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3 (Modern Flexbox/Grid, CSS Variables), Vanilla JavaScript (ES6+ async/await, Fetch API), FontAwesome |
| **Backend** | Node.js, Express.js (RESTful API architecture) |
| **Database** | MongoDB with Mongoose ODM (Data modeling, indexing, schema validations) |
| **Authentication** | JSON Web Tokens (JWT), bcryptjs password hashing, Role-Based Access Control (RBAC) middleware |
| **Testing** | Jest, Supertest |

---

## 📂 Project Directory Structure

```text
anna-setu/
├── backend/
│   ├── controllers/         # Business logic (admin, auth, donor, receiver, volunteer, compost, user)
│   ├── middleware/          # JWT authentication and role authorization guards
│   ├── models/              # Mongoose schemas (User, Donation, Task, Request, Activity, CompostSale)
│   ├── routes/              # Express API route declarations
│   ├── tests/               # Test suites (unit and integration tests)
│   ├── .env                 # Environment configuration (PORT, MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD)
│   ├── app.js               # Express application instance setup
│   ├── server.js            # Server entry point & database connection
│   ├── create-admin.js      # Seeding script for default administrator account
│   └── package.json         # Backend dependencies & test scripts
│
└── frontend/
    ├── assets/              # Logos, branding graphics, and media
    ├── css/                 # Modular stylesheets (theme.css, landing.css, adminDashboard.css, etc.)
    ├── js/                  # Client-side controllers (adminDashboard.js, signup.js, login.js, etc.)
    ├── index.html           # Public landing & awareness page
    ├── login.html           # Unified login page with role-based redirection
    ├── signup.html          # Registration form (with conditional FSSAI input for regular donors)
    ├── adminDashboard.html  # Administrator management & dispatch console
    ├── donorDashboard.html  # Food donor management console
    ├── volunteerDashboard.html # Volunteer task & quality inspection console
    ├── receiverDashboard.html  # Recipient organization portal
    └── profile.html         # User profile update portal
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)
- **MongoDB** (installed and running locally on port `27017` or a MongoDB Atlas URI)

---

### 1. Backend Setup

1. Open PowerShell or a terminal and navigate to the `backend` directory:
   ```powershell
   cd anna-setu/backend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Configure environment variables in `backend/.env`:
   ```ini
   PORT=4000
   MONGODB_URI=mongodb://localhost:27017/anna-setu
   JWT_SECRET=your_super_secret_jwt_key_here
   ADMIN_PASSWORD=your_strong_unique_password
   ```

---

### 2. Database & Admin Seeding

Seed the initial administrator account (only needed once):
```powershell
node create-admin.js
```
*Expected output: `✅ Admin user created successfully!` (or `Admin user already exists`).*

Start the backend server:
```powershell
node server.js
```
*The API will be available at:* `http://localhost:4000`

---

### 3. Frontend Setup

1. Navigate to the `frontend` directory:
   ```powershell
   cd ../frontend
   ```

2. Run the frontend using any local HTTP server (or VS Code Live Server):
   ```powershell
   # Using npx serve:
   npx serve -l 3000

   # Or using Python:
   python -m http.server 3000
   ```

3. Open your browser and navigate to:
   - **Landing Page:** `http://localhost:3000/index.html`
   - **Login Page:** `http://localhost:3000/login.html`
   - **Sign Up Page:** `http://localhost:3000/signup.html`

*(Alternatively, open [index.html](file:///frontend/index.html) directly in any modern browser).*

---

## 🔑 Admin Account Setup

The administrator account is created using the backend setup script.

1. Configure `ADMIN_PASSWORD` in your backend `.env` file.
2. Configure `MONGODB_URI`.
3. Run the admin creation script:

   ```bash
   node create-admin.js
---

## 📡 API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new donor, volunteer, or receiver | Public |
| `POST` | `/api/auth/login` | Authenticate user & return JWT token | Public |
| `GET` | `/api/users/me` | Fetch logged-in user profile details | Yes (All roles) |
| `PUT` | `/api/users/me` | Update logged-in user profile | Yes (All roles) |
| `GET` | `/api/admin/stats` | Fetch aggregated dashboard analytics | Yes (Admin) |
| `GET` | `/api/admin/pending-users` | Fetch users awaiting approval (includes FSSAI) | Yes (Admin) |
| `POST` | `/api/admin/users/:id/approve` | Approve a pending user account | Yes (Admin) |
| `POST` | `/api/admin/users/:id/reject` | Reject a pending user account | Yes (Admin) |
| `GET` | `/api/admin/pending-donations` | List donations awaiting volunteer assignment | Yes (Admin) |
| `POST` | `/api/admin/assign-task` | Dispatch donation to volunteer & receiver | Yes (Admin) |
| `POST` | `/api/donor/schedule` | Schedule a new surplus food donation | Yes (Donor) |
| `GET` | `/api/donor/history` | View donor's full donation log | Yes (Donor) |
| `GET` | `/api/volunteer/tasks` | View volunteer's assigned tasks | Yes (Volunteer) |
| `POST` | `/api/volunteer/tasks/:id/qc` | Submit food quality control inspection | Yes (Volunteer) |
| `PUT` | `/api/volunteer/tasks/:id/status`| Update task status (Accepted/Picked Up/Delivered) | Yes (Volunteer) |
| `GET` | `/api/receiver/requests` | List open requests and deliveries | Yes (Receiver) |
| `POST` | `/api/receiver/request` | Submit new food assistance request | Yes (Receiver) |

---

## 🔮 Future Roadmap

- 🗺️ **Live Map & Route Optimization:** Integrated GIS mapping for volunteers showing shortest pickup and drop-off delivery routes.
- 💬 **In-App Messaging:** Real-time socket-based chat between coordinating volunteers, donors, and shelters.
- 📱 **Mobile Application:** Progressive Web App (PWA) / React Native mobile app with push notifications for instant donation alerts.
- 📊 **Advanced Impact Reporting:** Automated certificate generation documenting kilograms of CO₂ prevented and meals served for corporate ESG reporting.

---

*Anna Setu — Empowering communities, preventing waste, feeding hope.*
