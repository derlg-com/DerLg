# Student Discount Verification — Requirements

> **Feature IDs:** F62–F63
> **Scope:** v1.1
> **Priority:** P1

---

## User Stories

### F62 — Student Verification

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F62-01 | As a student, I want to upload my student ID and selfie so that I can verify my student status. | AC1: Verification form in profile settings. AC2: Upload fields: student ID card photo (front), student ID card photo (back), selfie holding ID. AC3: Max 10MB per image, JPEG/PNG only. AC4: Images stored in Supabase Storage with private ACL. AC5: Status tracking: NONE → PENDING → VERIFIED / REJECTED. AC6: Notification sent on status change. AC7: Rejection includes reason. AC8: Can re-submit if rejected (max 3 attempts). |
| US-F62-02 | As an admin, I want to review student verification requests so that I can approve legitimate students. | AC1: Admin dashboard shows verification queue with pending count. AC2: Each request shows: user info, uploaded images, submission date, attempt number. AC3: Actions: Approve, Reject (with reason). AC4: Approval sets `student_status = VERIFIED`, applies 10% discount. AC5: Rejection sets `student_status = REJECTED`, sends email with reason. AC6: Batch actions supported (approve/reject multiple). |

### F63 — Student Discount Auto-Applied

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F63-01 | As a verified student, I want to see discounted prices automatically so that I don't need to enter a code. | AC1: 10% discount applied automatically to all eligible bookings. AC2: Discount shown in price breakdown: "Student discount (-10%)". AC3: Non-stackable with discount codes but combinable with loyalty points. AC4: Discount applies to: trips, hotels, transport, guides (not add-ons or fees). AC5: If verification expires (e.g., after 1 year), discount stops applying. |
| US-F63-02 | As a student, I want to see my verification status so that I know if my discount is active. | AC1: Profile page shows student status badge. AC2: If pending, shows "Under review" with estimated time (2–3 business days). AC3: If verified, shows expiry date. AC4: If rejected, shows reason and re-submit option. |

---

## Data Model

### `student_verifications` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `id_card_front_url` | TEXT | NOT NULL | Supabase Storage URL |
| `id_card_back_url` | TEXT | NOT NULL | |
| `selfie_url` | TEXT | NOT NULL | |
| `status` | VARCHAR(20) | DEFAULT 'PENDING' | PENDING, VERIFIED, REJECTED |
| `rejection_reason` | TEXT | | |
| `verified_by` | UUID | FK → users (admin) | |
| `verified_at` | TIMESTAMPTZ | | |
| `expires_at` | TIMESTAMPTZ | | 1 year from verification |
| `attempt_count` | INTEGER | DEFAULT 1 | Max 3 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Discount Rules

| Rule | Value |
|------|-------|
| Discount percentage | 10% |
| Applicable to | Trips, hotels, transport, guides |
| Not applicable to | Add-ons, fees, taxes |
| Stackable with loyalty | Yes |
| Stackable with discount codes | No (student takes precedence) |
| Validity | 1 year from verification |
| Max attempts | 3 |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `STUDENT_001` | 400 | Invalid image format or size |
| `STUDENT_002` | 429 | Max verification attempts exceeded |
| `STUDENT_003` | 403 | Student discount expired |
| `STUDENT_004` | 400 | Missing required images |

---

*Aligned with PRD section 7.7 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 14, 33).*
