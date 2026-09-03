# AssessIQ — AI-Powered Assessment Platform

> A modern, role-based assessment platform for students, teachers, admins, and parents — built with React + Vite.

🌐 **Live Demo:** [assess-iq-five.vercel.app](https://assess-iq-five.vercel.app)

---

## ✨ Features

- 🎓 **Multi-role support** — Student, Teacher, Admin, and Parent dashboards
- 📝 **Assessment creation & management** — Teachers can create, assign, and review assessments
- 🤖 **AI-powered grading** — Automated evaluation with intelligent feedback
- 📊 **Analytics & insights** — Track performance with detailed charts and statistics
- 🔐 **Authentication** — Role-based login and signup with local persistence
- 🌌 **3D Knowledge Graph** — Interactive neural-style visualization using Three.js
- 🎨 **Dark themed UI** — Sleek, modern design with smooth Framer Motion animations
- 📱 **Responsive layout** — Works across desktop and mobile

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router DOM v6 |
| Animations | Framer Motion + Lenis (smooth scroll) |
| 3D Graphics | Three.js + @react-three/fiber + @react-three/drei |
| Icons | Lucide React |
| Styling | Vanilla CSS + CSS Modules |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/Subhadeep12-gorain/AssessIQ.git
cd AssessIQ/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@edu.com | admin123 |
| Teacher | teacher@edu.com | teacher123 |
| Student | student@edu.com | student123 |

---

## 📁 Project Structure

```
frontend/
└── src/
    ├── App.jsx                  # Root component & routing
    ├── index.css                # Global styles & CSS variables
    ├── components/
    │   ├── DashboardLayout.jsx  # Shared sidebar layout
    │   ├── common/              # Reusable UI components
    │   ├── modals/              # Modal dialogs
    │   ├── student/             # Student-specific components
    │   └── teacher/             # Teacher-specific components
    ├── pages/
    │   ├── Landing/             # Dark hero landing page
    │   ├── auth/                # Login & Signup pages
    │   ├── student/             # Student dashboard
    │   ├── teacher/             # Teacher dashboard
    │   ├── admin/               # Admin dashboard
    │   └── parent/              # Parent dashboard
    └── services/
        └── apiService.js        # API / Mock Service 
```

---

## 📦 Available Scripts

*(Run these inside the `frontend` directory)*

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

---

## 📄 License

MIT © [Subhadeep Gorain](https://github.com/Subhadeep12-gorain)
