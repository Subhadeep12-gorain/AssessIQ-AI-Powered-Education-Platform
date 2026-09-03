# Admin Dashboard + Parent-Child Linking — Frontend Integration Guide

## Base URL

```
https://assess-ai-b2f175ea4c07.herokuapp.com/api/v1/auth
```

All endpoints require **tenant-scoped authentication**. Send these headers with every request:

```
Authorization: Bearer <jwt_token>
X-Tenant-ID: 00000000-0000-4000-8000-000000000001
```

> **Note:** The tenant ID above is a placeholder — your frontend should read it from the JWT payload (`tenant_id` claim) or a tenant-switcher context.

---

## 1. Admin Dashboard — Student Stats

**Lists all active students with aggregated stats: courses enrolled, assessment submissions, scores, and risk tier.**

### Endpoint

```
GET /admin/dashboard/students?skip=0&limit=50
```

### Query Parameters

| Param  | Type   | Default | Max  | Description              |
|--------|--------|---------|------|--------------------------|
| `skip` | int    | 0       | —    | Records to skip (offset) |
| `limit`| int    | 50      | 200  | Records to return        |

### Required Permission

`analytics:read` — granted to `institution_admin` role.

### Response Shape

```typescript
// Envelope
{
  success: boolean;
  data: StudentDashboardItem[] | null;
  meta: DashboardMeta | null;
  errors?: ErrorDetail[];  // only when success=false
}

// Each student
interface StudentDashboardItem {
  id: string;                      // UUID
  email: string;
  name: string;
  role: string;                    // "student"
  is_active: boolean;
  is_verified: boolean;
  last_active: string | null;      // ISO datetime
  created_at: string | null;       // ISO datetime

  // Courses
  courses: string[];               // course names
  course_count: number;

  // Assessment stats
  submission_count: number;
  avg_score: number | null;        // 0–100
  total_score: number;
  total_possible: number;

  // Risk (from prediction service)
  risk_tier: string | null;        // null | "at_risk" | "low_risk"

  // Detail
  submissions: AssessmentSummary[];
}

interface AssessmentSummary {
  assessment_title: string;
  assessment_id: string;           // UUID
  score: number | null;
  total_possible: number | null;
  submitted_at: string | null;     // ISO datetime
}

// Aggregate metadata
interface DashboardMeta {
  total: number;
  skip: number;
  limit: number;
  overall_avg_score: number | null;
  total_students: number;
  total_submissions: number;
  at_risk_count: number;
}
```

### Example Response

```json
{
  "success": true,
  "data": [
    {
      "id": "059af629-852e-4e51-8542-01a4d57eef5d",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "student",
      "is_active": true,
      "is_verified": true,
      "last_active": "2026-07-19T10:30:00Z",
      "created_at": "2026-01-15T08:00:00Z",
      "courses": ["Mathematics 101", "Physics 201"],
      "course_count": 2,
      "submission_count": 5,
      "avg_score": 78.5,
      "total_score": 392.5,
      "total_possible": 500,
      "risk_tier": "low_risk",
      "submissions": [
        {
          "assessment_title": "Midterm Exam",
          "assessment_id": "abc-123",
          "score": 85.0,
          "total_possible": 100,
          "submitted_at": "2026-06-15T14:00:00Z"
        }
      ]
    }
  ],
  "meta": {
    "total": 42,
    "skip": 0,
    "limit": 50,
    "overall_avg_score": 71.2,
    "total_students": 42,
    "total_submissions": 187,
    "at_risk_count": 3
  }
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "meta": null,
  "errors": [
    {
      "code": "ForbiddenError",
      "message": "Missing required permission: analytics:read",
      "details": {
        "required_permission": "analytics:read",
        "user_role": "student"
      }
    }
  ]
}
```

### React Query Example

```typescript
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";  // your axios/fetch wrapper

type FetchStudentsParams = { skip: number; limit: number };

function useStudentStats(params: FetchStudentsParams) {
  return useQuery({
    queryKey: ["admin", "dashboard", "students", params],
    queryFn: async () => {
      const { data } = await api.get("/admin/dashboard/students", { params });
      return data as EnvelopeResponse<StudentDashboardItem[]>;
    },
    enabled: false,  // only fetch when the admin opens the dashboard
  });
}
```

### UI Considerations

- **Risk tier badges:** Use `risk_tier` to show colored chips — `null`/`low_risk` = green, `at_risk` = red.
- **Overall avg score in header:** Pull from `meta.overall_avg_score` for a dashboard summary card.
- **At-risk count:** Display prominently — it's the admin's key metric. `meta.at_risk_count`.
- **Empty state:** When `data: []`, show "No students found" with no errors.
- **Performance:** Response time is proportional to `limit`. Keep default at 50, max 200.

---

## 2. Parent-Child Linking

**Links student accounts to a parent user. Replaces ALL existing links with the provided set (set semantics, not incremental).**

### Endpoint

```
PATCH /admin/users/{user_id}/link-child
```

### Request Body

```json
{
  "children_emails": ["child1@example.com", "child2@example.com"]
}
```

### Required Permission

`user:write` — granted to `institution_admin` and `super_admin` roles.

### Response Shape

```typescript
interface LinkChildResponse {
  parent_id: string;                // UUID
  children: ChildSummary[];
}

interface ChildSummary {
  id: string;                       // UUID
  email: string;
  name: string;
  is_active: boolean;
}
```

### Example

```bash
curl -X PATCH https://assess-ai-b2f175ea4c07.herokuapp.com/api/v1/auth/admin/users/059af629-852e-4e51-8542-01a4d57eef5d/link-child \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-ID: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"children_emails": ["alice@example.com", "bob@example.com"]}'
```

Response:

```json
{
  "success": true,
  "data": {
    "parent_id": "059af629-852e-4e51-8542-01a4d57eef5d",
    "children": [
      {
        "id": "43cd0e28-0d35-4bb7-b469-9027e9bfce52",
        "email": "alice@example.com",
        "name": "Alice Smith",
        "is_active": true
      },
      {
        "id": "025afd23-4f3c-431c-8025-9319270b74ee",
        "email": "bob@example.com",
        "name": "Bob Jones",
        "is_active": true
      }
    ]
  }
}
```

### Error Scenarios

| HTTP Status | `code` | Cause |
|---|---|---|
| 403 | `ForbiddenError` | Caller lacks `user:write` permission |
| 404 | `NotFoundError` | Parent `user_id` does not exist |
| 422 | `ValidationError` | One or more emails have no matching user in the tenant |

### React Hook Example

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

function useLinkChildren() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      parentId,
      childrenEmails,
    }: {
      parentId: string;
      childrenEmails: string[];
    }) => {
      const { data } = await api.patch(
        `/admin/users/${parentId}/link-child`,
        { children_emails: childrenEmails }
      );
      return data as EnvelopeResponse<LinkChildResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}
```

### UI Considerations

- **Email input:** Provide a multi-email input (tag-style, like `react-select` or `chakra-react-select`). Show validation errors inline per email.
- **Set semantics warning:** The UI should make it clear this **replaces** all existing links. Consider a confirmation dialog: "This will replace the current child list. Continue?"
- **Parent user selector:** Use the existing `GET /admin/users` endpoint with a role filter to let the admin pick a parent user before linking.
- **Post-link navigation:** After success, redirect to the parent's user detail or show a success toast with the linked children count.

---

## 3. Related Admin Endpoints

These support the features above and share the same auth/permission model:

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/admin/users` | `user:read` | List users with search + pagination |
| `GET` | `/admin/users/{id}` | `user:read` | Get user details |
| `PATCH` | `/admin/users/{id}/role` | `user:write` | Change user role |
| `PATCH` | `/admin/users/{id}/deactivate` | `user:write` | Activate/deactivate user |
| `POST` | `/admin/users/{id}/force-logout` | `user:write` | Log out user from all devices |
| `POST` | `/admin/users/invite` | `user:invite` | Bulk invite from CSV |

All return the same `EnvelopeResponse` wrapper:

```typescript
interface EnvelopeResponse<T> {
  success: boolean;
  data: T | null;
  meta: Record<string, unknown> | null;
  errors?: { code: string; message: string; details?: Record<string, unknown> }[];
}
```

Success = `data` is populated, `errors` is absent.  
Error = `success: false`, `errors` array with at least one item, `data: null`.
