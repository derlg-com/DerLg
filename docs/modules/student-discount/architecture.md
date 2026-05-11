# Student Discount Verification — Architecture

> **Feature IDs:** F62–F63
> **Scope:** v1.1

---

## Overview

The Student Discount module handles document-based verification with an admin review queue. Verified students receive an automatic 10% discount on eligible bookings.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Verification│  │ Status      │  │ Price Display       │  │
│  │ Form        │  │ Badge       │  │ (with discount)     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Auth Store (Zustand) — student_status               │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Student Service                                     │    │
│  │ — upload, status, discount calculation              │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ PostgreSQL + Supabase Storage                       │    │
│  │ (student_verifications, private image storage)      │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Verification Flow

```
[Student uploads ID + selfie]
        │
        ▼
[Validate images: format, size, count]
        │
        ▼
[Store in Supabase Storage (private bucket)]
        │
        ▼
[Create student_verifications record: PENDING]
        │
        ▼
[Notify admin (push + email)]
        │
        ▼
[Admin reviews in dashboard]
        │
   ┌────┴────┐
   ▼         ▼
Approve   Reject
   │         │
   ▼         ▼
[Status:  [Status:
 VERIFIED] REJECTED]
   │         │
   ▼         ▼
[Notify   [Notify
 user]    user + reason]
   │         │
   ▼         ▼
[Discount  [Can re-
 active]   submit]
```

---

## Image Storage

```typescript
// Upload to Supabase Storage
const { data, error } = await supabase.storage
  .from('student-verifications')
  .upload(`${userId}/${type}-${Date.now()}.jpg`, file, {
    contentType: 'image/jpeg',
    upsert: false,
  });

// Generate signed URL for admin review (1-hour expiry)
const { data: signedUrl } = await supabase.storage
  .from('student-verifications')
  .createSignedUrl(path, 3600);
```

---

## Discount Application

```typescript
function applyStudentDiscount(
  subtotalUsd: number,
  user: User
): { discountUsd: number; finalUsd: number } {
  if (user.student_status !== 'VERIFIED') {
    return { discountUsd: 0, finalUsd: subtotalUsd };
  }
  if (user.student_expires_at && new Date() > user.student_expires_at) {
    return { discountUsd: 0, finalUsd: subtotalUsd };
  }
  const discountUsd = subtotalUsd * 0.10;
  return { discountUsd, finalUsd: subtotalUsd - discountUsd };
}
```

---

*Aligned with PRD section 7.7 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
