# Backend Requirements: User Suspension Feature

## Overview
The admin can suspend teachers (and eventually students). The frontend currently handles this via localStorage polling, but requires backend support for it to be secure, cross-device, and real-time.

---

## What the Frontend Currently Does (localStorage fallback)

1. **On Login** → checks `assessiq_users` in localStorage for the user's email. If `status === "suspended"`, blocks login and shows an error message.
2. **While Logged In** → polls localStorage every 15 seconds. If another admin session sets `status: "suspended"` on the same device/browser, the user is auto-logged out.

> ⚠️ **Limitation**: This only works if admin and teacher are on the same device/browser. For cross-device suspension, backend support is required.

---

## Required Backend Changes

### 1. Return `status` field on Login

**Endpoint**: `POST /auth/login`  
**Current Response**: `{ access_token, refresh_token, user: { id, email, name, role } }`  
**Required Response**: Add `status` to the user object:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "role": "instructor",
    "status": "active"   // ← ADD THIS FIELD: "active" | "suspended"
  }
}
```

**Frontend behavior**: If `status === "suspended"` → block login with error message, remove tokens.

---

### 2. Return 401 on API Calls for Suspended Users

**All protected endpoints** should check if the user's account is suspended before processing the request.

**Expected behavior**:
- If a suspended user's token is used to make ANY API call → return `401 Unauthorized`
- Response body:
```json
{
  "detail": "Account suspended. Contact your administrator.",
  "code": "account_suspended"
}
```

**Frontend behavior**: The frontend's `apiService` already has a global error handler. We need to add logic that if any API call returns `401` with `code: "account_suspended"`, it calls `handleLogout()` automatically.

---

### 3. Suspend/Activate Endpoint (Admin Only)

**Endpoint**: `PATCH /admin/users/{user_id}/status`  
**Auth**: Admin JWT required  
**Request Body**:
```json
{
  "status": "suspended"   // or "active" to re-activate
}
```
**Response**:
```json
{
  "message": "User status updated successfully.",
  "user": {
    "id": "...",
    "email": "...",
    "status": "suspended"
  }
}
```

**Frontend currently does**: Calls `localStorage` directly. Once this endpoint exists, update `handleSuspendTeacher()` in `AdminDashboard.jsx` to call this API.

---

### 4. (Optional but Recommended) Token Invalidation on Suspension

When a user is suspended, **invalidate their current active tokens** (blacklist or delete from DB).

This ensures:
- The suspended teacher's current session is terminated within seconds (next API call returns 401)
- The frontend's 15-second polling becomes redundant — real-time logout happens on next request

---

## Summary Table

| Feature | Frontend (Done) | Backend (Needed) |
|---|---|---|
| Block login for suspended users | ✅ localStorage check | ✅ Return `status` in `/auth/login` |
| Auto-logout active suspended session | ✅ 15s localStorage poll (same device only) | ✅ Return 401 with `code: "account_suspended"` |
| Suspend/Activate via API | ❌ localStorage only | ✅ `PATCH /admin/users/{id}/status` |
| Cross-device real-time logout | ❌ Not possible without backend | ✅ Invalidate tokens on suspension |

---

## Files to Update After Backend Is Ready

- `frontend/src/pages/admin/AdminDashboard.jsx` → `handleSuspendTeacher()` → replace localStorage write with API call to `PATCH /admin/users/{id}/status`
- `frontend/src/services/apiService.js` → add global 401 handler that checks for `code: "account_suspended"` and triggers logout
- `frontend/src/pages/auth/Login.jsx` → already reads `status` from login response ✅
