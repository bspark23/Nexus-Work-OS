# Firebase Migration Guide

This project has been successfully migrated from **Supabase** to **Firebase**. This document provides the complete setup and deployment instructions.

---

## 🔥 What Changed

### Before (Supabase)
- **Auth**: Supabase Auth
- **Database**: PostgreSQL with Row-Level Security (RLS)
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime (`postgres_changes`)
- **Admin SDK**: Supabase Admin with service role key

### After (Firebase)
- **Auth**: Firebase Authentication
- **Database**: Cloud Firestore (NoSQL document database)
- **Storage**: Firebase Storage
- **Realtime**: Firestore `onSnapshot` listeners
- **Admin SDK**: Firebase Admin SDK

---

## 📦 Installation

### 1. Install Dependencies

```bash
npm install firebase firebase-admin
# or
bun add firebase firebase-admin
```

### 2. Remove Old Supabase Package

```bash
npm uninstall @supabase/supabase-js
```

---

## 🔧 Firebase Setup

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Name it: `workwise-harmoney` (or your choice)
4. Enable Google Analytics (optional)
5. Click **Create project**

### Step 2: Enable Authentication

1. In Firebase Console → **Authentication** → **Get started**
2. Enable **Email/Password** sign-in method
3. Click **Save**

### Step 3: Create Firestore Database

1. Go to **Firestore Database** → **Create database**
2. Choose **Start in production mode**
3. Select your region
4. Click **Enable**

### Step 4: Set Up Storage

1. Go to **Storage** → **Get started**
2. Start in **production mode**
3. Click **Done**

### Step 5: Get Firebase Config

1. Go to **Project Settings** (gear icon) → **General**
2. Scroll to **Your apps** → Click **Web** icon (`</>`)
3. Register app name: `workwise-harmony-web`
4. Copy the `firebaseConfig` object
5. Update your `.env` file with these values

### Step 6: Generate Service Account Key

1. Go to **Project Settings** → **Service accounts**
2. Click **Generate new private key**
3. Download the JSON file
4. Extract these values into your `.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (the entire key including `-----BEGIN PRIVATE KEY-----`)

---

## 🔑 Environment Variables

Update your `.env` file:

```bash
# Firebase Client (public — safe to expose in browser bundles)
VITE_FIREBASE_API_KEY="your-api-key-here"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="1:your-sender-id:web:e4664a3f8112de132f64af"
VITE_FIREBASE_MEASUREMENT_ID="G-XXXXXXXXXX"

# Firebase Admin SDK (server-side only — NEVER expose to browser)
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@workwise-harmoney.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----"
FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
```

> **Important**: Replace the values above with your actual Firebase credentials.

---

## 🗄️ Firestore Database Structure

The app uses the following Firestore collections:

### Collections

1. **`profiles`** — User profiles
   - Document ID = Firebase Auth UID
   - Fields: `full_name`, `username`, `email`, `department_id`, `job_title`, `status`, `avatar_url`, `bio`, `phone`, `last_seen_at`, `created_at`

2. **`user_roles`** — User role assignments
   - Document ID = Firebase Auth UID
   - Fields: `role` (super_admin | admin | employee), `user_id`

3. **`departments`** — Company departments
   - Fields: `name`, `description`, `created_at`

4. **`projects`** — All projects
   - Fields: `owner_id`, `title`, `description`, `department_id`, `status`, `priority`, `progress`, `due_date`, `created_at`, `updated_at`

5. **`tasks`** — All tasks
   - Fields: `owner_id`, `title`, `description`, `department_id`, `status`, `priority`, `due_date`, `project_id`, `customer_job_id`, `assigned_by`, `notes`, `created_at`, `updated_at`

6. **`reports`** — Employee reports
   - Fields: `author_id`, `department_id`, `report_type`, `title`, `summary`, `completed_work`, `challenges`, `next_steps`, `report_date`, `status`, `created_at`, `updated_at`

7. **`activities`** — Activity log
   - Fields: `actor_id`, `action`, `entity_type`, `entity_id`, `department_id`, `description`, `created_at`

8. **`notifications`** — User notifications
   - Fields: `user_id`, `actor_id`, `department_id`, `title`, `body`, `type`, `audience`, `read`, `created_at`

9. **`attachments`** — File uploads
   - Fields: `owner_id`, `project_id`, `report_id`, `task_id`, `customer_job_id`, `department_id`, `file_name`, `file_path`, `file_url`, `file_type`, `file_size`, `kind`, `created_at`

10. **`customer_jobs`** — Sales job requests
    - Fields: `created_by`, `customer_name`, `company_name`, `contact_info`, `project_title`, `project_description`, `requested_services`, `expected_delivery_date`, `notes`, `status`, `created_at`, `updated_at`

11. **`customer_job_departments`** — Job-to-department assignments
    - Fields: `job_id`, `department_id`, `status`, `created_at`

---

## 🔒 Firestore Security Rules

Deploy these security rules to Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function getUserRole() {
      return get(/databases/$(database)/documents/user_roles/$(request.auth.uid)).data.role;
    }
    
    function isSuperAdmin() {
      return isAuthenticated() && getUserRole() == 'super_admin';
    }
    
    function isAdmin() {
      return isAuthenticated() && (getUserRole() == 'super_admin' || getUserRole() == 'admin');
    }
    
    function getUserDepartment() {
      return get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.department_id;
    }
    
    function isInSameDepartment(deptId) {
      return isAuthenticated() && getUserDepartment() == deptId;
    }
    
    // Profiles - users can read all, update own
    match /profiles/{userId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin() || isOwner(userId);
    }
    
    // User roles - read own, admins can manage
    match /user_roles/{userId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }
    
    // Departments - all can read, admins can write
    match /departments/{deptId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }
    
    // Projects - scoped by department or owner
    match /projects/{projectId} {
      allow read: if isAuthenticated() && (
        isSuperAdmin() || 
        isInSameDepartment(resource.data.department_id) ||
        isOwner(resource.data.owner_id)
      );
      allow create: if isAuthenticated();
      allow update, delete: if isSuperAdmin() || isOwner(resource.data.owner_id);
    }
    
    // Tasks - scoped by department or owner
    match /tasks/{taskId} {
      allow read: if isAuthenticated() && (
        isSuperAdmin() || 
        isInSameDepartment(resource.data.department_id) ||
        isOwner(resource.data.owner_id)
      );
      allow create: if isAuthenticated();
      allow update, delete: if isSuperAdmin() || isOwner(resource.data.owner_id) || isAdmin();
    }
    
    // Reports - scoped by department or author
    match /reports/{reportId} {
      allow read: if isAuthenticated() && (
        isSuperAdmin() || 
        isInSameDepartment(resource.data.department_id) ||
        isOwner(resource.data.author_id)
      );
      allow create: if isAuthenticated();
      allow update, delete: if isSuperAdmin() || isOwner(resource.data.author_id);
    }
    
    // Activities - all can read, write logged automatically
    match /activities/{activityId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
    }
    
    // Notifications - scoped by user or admin audience
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() && (
        resource.data.user_id == request.auth.uid ||
        resource.data.audience == 'admin' && isSuperAdmin() ||
        resource.data.audience == 'department' && isInSameDepartment(resource.data.department_id)
      );
      allow write: if isAuthenticated();
    }
    
    // Attachments - owner can manage
    match /attachments/{attachmentId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow delete: if isOwner(resource.data.owner_id) || isSuperAdmin();
    }
    
    // Customer jobs - sales + admins
    match /customer_jobs/{jobId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isSuperAdmin() || isOwner(resource.data.created_by);
    }
    
    match /customer_job_departments/{linkId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
  }
}
```

---

## 🪣 Storage Security Rules

Deploy these rules to Firebase Storage:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /work-files/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🚀 First-Time Setup

### 1. Create Initial Super Admin

The system needs at least one Super Admin to bootstrap. On first load, call the bootstrap API:

```bash
curl -X POST http://localhost:3000/api/public/bootstrap
```

This creates the pre-configured Super Admin account:
- **Username**: `mbatablessing`
- **Password**: `Admin12345@`

You can change these credentials in `src/lib/admin.server.ts`.

### 2. Create Departments

Log in as the Super Admin and create your company departments (e.g., Sales, Web Development, Marketing).

### 3. Register Employees

Employees can register themselves, or the Super Admin can manually create accounts via the Admin Panel.

---

## 🏗️ Key Architecture Changes

### Auth Flow

**Old (Supabase)**:
```typescript
await supabase.auth.signInWithPassword({ email, password })
```

**New (Firebase)**:
```typescript
await signInWithEmailAndPassword(auth, email, password)
```

### Database Queries

**Old (Supabase)**:
```typescript
const { data } = await supabase.from("projects").select("*")
```

**New (Firebase)**:
```typescript
const snap = await getDocs(collection(db, "projects"))
const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
```

### Real-time Sync

**Old (Supabase)**:
```typescript
supabase.channel("nexus-live")
  .on("postgres_changes", { table: "projects" }, callback)
  .subscribe()
```

**New (Firebase)**:
```typescript
onSnapshot(collection(db, "projects"), (snap) => {
  // Auto-updates when data changes
})
```

### File Upload

**Old (Supabase)**:
```typescript
await supabase.storage.from("work-files").upload(path, file)
```

**New (Firebase)**:
```typescript
await uploadBytes(ref(storage, path), file)
const url = await getDownloadURL(ref(storage, path))
```

---

## 🧪 Testing the Migration

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Test authentication**:
   - Visit `/auth`
   - Try logging in with the Super Admin account
   - Try registering a new employee

3. **Test data operations**:
   - Create a project
   - Assign a task
   - Submit a report
   - Upload a file

4. **Test real-time sync**:
   - Open two browser windows
   - Make a change in one
   - Verify it appears instantly in the other

---

## 📝 Development Notes

- All Supabase imports have been replaced with Firebase
- The old Supabase files in `src/integrations/supabase/` are now deprecated stubs
- User object now has both `uid` (Firebase native) and `id` (backward compatibility alias)
- Server-side admin operations use Firebase Admin SDK
- Client-side operations use Firebase client SDK

---

## 🐛 Troubleshooting

### "Missing Firebase environment variables"
- Check that all `VITE_FIREBASE_*` variables are set in `.env`
- Restart your dev server after updating `.env`

### "Permission denied" errors in Firestore
- Deploy the security rules from this guide
- Verify the user is authenticated
- Check that the user has the correct role in `user_roles` collection

### "Super Admin not found"
- Call the bootstrap API endpoint: `POST /api/public/bootstrap`
- This creates the initial Super Admin account

### Storage upload fails
- Deploy the storage security rules
- Verify the file path matches the pattern: `work-files/{userId}/{filename}`
- Check Firebase Storage is enabled in the console

---

## 📚 Further Reading

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- [Firebase Auth](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

## ✅ Migration Checklist

- [x] Install Firebase packages
- [x] Remove Supabase package
- [x] Create Firebase project
- [x] Enable Authentication
- [x] Create Firestore database
- [x] Set up Firebase Storage
- [x] Update environment variables
- [x] Migrate auth logic
- [x] Migrate database queries
- [x] Migrate file uploads
- [x] Migrate real-time listeners
- [x] Update server functions
- [x] Deploy security rules
- [x] Test authentication
- [x] Test CRUD operations
- [x] Test real-time sync
- [x] Bootstrap Super Admin
- [x] Create departments
- [x] Test full user workflow

---

**Migration completed successfully! 🎉**

For questions or issues, refer to the Firebase Console or check the application logs.

