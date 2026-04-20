# TrustChit

**TrustChit** is a modern, secure, and transparent platform for managing chit funds online. Built with Next.js, Supabase, and a robust React component architecture, TrustChit empowers users to create, manage, and participate in chit fund groups with ease and confidence.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

TrustChit digitizes the traditional chit fund system, making it accessible, efficient, and trustworthy for everyone. Whether you want to start a new group, join existing ones, participate in auctions, or track payments, TrustChit provides a seamless experience with real-time analytics and bank-level security.

---

## Key Features

- **Group Creation & Management:** Set up chit fund groups with custom rules, invite members, and manage group details.
- **Secure Payments:** Make and track monthly contributions with automated reminders and transparent records.
- **Auction System:** Participate in monthly auctions with real-time bidding and fair winner selection.
- **Analytics & Reports:** Monitor group progress, payment histories, and receive automated reports.
- **Notifications:** Stay updated with real-time alerts for auctions, payments, and group activities.
- **Enhanced Security:** Multi-factor authentication and encryption for all transactions and data.
- **Modern UI:** Responsive, accessible, and intuitive interface for all user roles.

---

## How It Works

1. **Create Your Group:** Set up a chit fund group with your own rules and invite trusted members.
2. **Make Contributions:** Members pay their monthly share securely through TrustChit.
3. **Participate in Auctions:** Bid for the pooled fund in transparent, real-time auctions.
4. **Track & Withdraw:** Winners receive the fund, and all members can track group progress and payments.

---

## Screenshots

> _Add screenshots or GIFs here to showcase TrustChit’s UI and features._

---

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Payments:** Razorpay integration
- **Other:** ESLint, PostCSS, modern component and hooks architecture

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm, yarn, pnpm, or bun
- Supabase project (see `.env.example` for required keys)
- Razorpay account for payment integration

### Installation

```bash
git clone https://github.com/your-org/trustchit.git
cd trustchit
npm install
# or
yarn install
```

### Environment Setup

Copy `.env.example` to `.env.local` and fill in your Supabase and Razorpay credentials.

If your old Supabase project was paused (and cannot be restored), create a new Supabase project and run the SQL schema in `supabase/schema.sql` to recreate the tables this MVP expects.

### Running Locally

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Visit [http://localhost:3000](http://localhost:3000) to use TrustChit.

---

## Project Structure

- `src/app/` – Next.js app routes (Dashboard, Groups, Auctions, Payments, etc.)
- `src/components/` – Reusable React components (Button, Sidebar, Modals, etc.)
- `src/lib/` – Database and third-party integrations (Supabase, payment actions)
- `src/types/` – TypeScript types and interfaces
- `src/hooks/` – Custom React hooks
- `public/` – Static assets

---

## Contributing

We welcome contributions! Please:

1. Fork the repository and create your branch (`git checkout -b feature/your-feature`).
2. Follow the code style and best practices outlined in the `/usage.txt` files.
3. Write clear commit messages and document your code.
4. Submit a pull request with a detailed description.

---

## License

This project is licensed under the MIT License.

---

**TrustChit** – Secure, Transparent, and Effortless Chit Fund Management.
