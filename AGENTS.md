# Nexus Work OS — Development Notes

This is a Company Work Management System built with:
- **Framework**: TanStack Start (React 19, SSR)
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Storage**: Base64 in Firestore (upgrade to Firebase Storage for large files)
- **UI**: Radix UI + Tailwind CSS v4 + shadcn/ui

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase credentials.

## Roles

- `super_admin` — Full company access, created via first registration or Admin Panel
- `admin` — Department-scoped admin, promoted by Super Admin
- `employee` — Personal workspace only

## First-time Setup

1. Go to `/auth` → Register tab
2. A yellow banner will appear — this creates the Super Admin account
3. Log in and go to Admin Panel → Departments to set up departments
4. Add employees via Admin Panel → Users
