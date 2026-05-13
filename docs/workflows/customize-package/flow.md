# Customize Package Flow Diagrams

> Visual flow reference for private tour booking journeys.

---

## Table of Contents

1. [Prebuilt Private Package — High-Level Flow](#1-prebuilt-private-package--high-level-flow)
2. [Customize vs Book As-Is Branch](#2-customize-vs-book-as-is-branch)
3. [Customization Mode Detail](#3-customization-mode-detail)

---

## 1. Prebuilt Private Package — High-Level Flow

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant DB as PostgreSQL
    participant R as Redis
    participant S as Stripe/QR Provider

    U->>F: Opens "Private Tours" section
    F->>B: GET /trips?type=private&featured=true
    B->>DB: Query private trip templates
    DB-->>B: Private trip list
    B-->>F: Private packages
    F-->>U: Render private tour listings

    U->>F: Taps a private package card
    F->>B: GET /trips/{slug}
    B->>DB: Query trip + journey map template
    DB-->>B: Trip detail
    B-->>F: Package with journey map
    F-->>U: Render package detail page

    Note over F,U: Page shows: benefits, group size, kid-friendly flag, inclusions/exclusions

    alt Customize My Journey
        U->>F: Taps "Customize My Journey"
        F-->>U: Enter customization mode

        loop Customization
            U->>F: Reorder days, add/remove day, swap activities, change hotel/transport
            F->>B: POST /availability/check
            B->>DB: Check inventory (cached)
            DB-->>B: Availability result
            B-->>F: Available/Unavailable
            F-->>U: Update price delta
        end

        U->>F: Taps "Confirm"
        F->>B: POST /availability/confirm
        B->>DB: Fresh availability check
        DB-->>B: All available
        B-->>F: Proceed to checkout
    else Book As-Is
        U->>F: Taps "Book This Package"
        F->>B: POST /availability/confirm
        B->>DB: Fresh availability check
        DB-->>B: All available
        B-->>F: Proceed to checkout
    end

    U->>F: Taps "Proceed to Checkout"
    F->>B: POST /bookings
    B->>DB: BEGIN TX, SELECT FOR UPDATE
    B->>DB: Create booking HOLD
    B->>R: SETEX booking:hold:{id} 900
    B->>DB: COMMIT
    B-->>F: Booking created (DLG-2026-0042)
    F-->>U: Show checkout page + 15min timer

    alt Stripe Card
        U->>F: Selects card payment
        F->>B: POST /payments/intent
        B->>S: Create PaymentIntent
        S-->>B: client_secret
        B-->>F: Payment intent
        F-->>U: Stripe Elements form
        U->>F: Enters card details
        F->>S: Confirm payment
        S-->>F: Payment success
    else QR Code
        U->>F: Selects QR payment
        F->>B: POST /payments/qr
        B->>S: Generate QR
        S-->>B: QR data
        B-->>F: QR image
        F-->>U: Display QR code
        U->>U: Scans QR with banking app
        S->>B: Payment callback
    end

    S->>B: Webhook: payment_intent.succeeded
    B->>DB: Update booking CONFIRMED
    B->>R: DEL booking:hold:{id}
    B->>DB: Generate QR check-in
    B-->>F: Booking confirmed
    F-->>U: Show confirmation + journey map + ticket
```

---

## 2. Customize vs Book As-Is Branch

```mermaid
flowchart TD
    START([User Views Private Package Detail]) --> VIEW[View Package Details]

    VIEW --> DETAILS[Show: Benefits, Group Size, Kid-Friendly, Inclusions/Exclusions]
    DETAILS --> DECISION{User Action}

    DECISION -->|Customize My Journey| CUSTOM[Enter Customization Mode]
    DECISION -->|Book This Package| AS_IS[Skip Customization]

    CUSTOM --> CUST_LOOP[Full Customization Freedom]
    CUST_LOOP --> REORDER[Reorder Days]
    CUST_LOOP --> ADD_DAY[Add New Day]
    CUST_LOOP --> REMOVE_DAY[Remove Day]
    CUST_LOOP --> SWAP_ACT[Swap Activities]
    CUST_LOOP --> CHANGE_HOTEL[Change Hotel]
    CUST_LOOP --> CHANGE_TRANS[Change Transport]
    CUST_LOOP --> ADD_GUIDE[Add Guide]

    REORDER --> CHECK1[Check Availability]
    ADD_DAY --> CHECK1
    REMOVE_DAY --> CALC[Recalculate Price]
    SWAP_ACT --> CHECK1
    CHANGE_HOTEL --> CHECK1
    CHANGE_TRANS --> CHECK1
    ADD_GUIDE --> CHECK1

    CHECK1 --> AVAIL{Available?}
    AVAIL -->|Yes| CALC
    AVAIL -->|No| SHOW_ALT[Show Alternatives]
    SHOW_ALT --> CUST_LOOP

    CALC --> UPDATE[Update Total Price]
    UPDATE --> DISPLAY[Display Price Delta]
    DISPLAY --> DONE{Done?}
    DONE -->|Continue| CUST_LOOP
    DONE -->|Confirm| CONFIRM[POST /availability/confirm]

    AS_IS --> CONFIRM

    CONFIRM --> FRESH_OK{All Available?}
    FRESH_OK -->|No| SHOW_CHANGED[Show What Changed]
    SHOW_CHANGED --> CUSTOM
    FRESH_OK -->|Yes| CHECKOUT[Proceed to Checkout]

    CHECKOUT --> BOOKING[POST /bookings]
    BOOKING --> HOLD[Status: HOLD]
    HOLD --> PAYMENT[Payment]
    PAYMENT --> CONFIRMED[Status: CONFIRMED]
```

---

## 3. Customization Mode Detail

```mermaid
flowchart TD
    START([Enter Customization Mode]) --> LOAD[Load Journey Map Template]

    LOAD --> VIEW[View Day-by-Day Itinerary]

    VIEW --> DAY_OPS{Day Operations}
    VIEW --> ITEM_OPS{Item Operations}

    DAY_OPS --> REORDER[Drag to Reorder Days]
    DAY_OPS --> ADD_DAY[Add Blank Day]
    ADD_DAY --> PICK_LOC[Pick Location/Theme]
    PICK_LOC --> POPULATE[Populate with Suggested Activities]
    DAY_OPS --> REMOVE_DAY[Remove Day]
    REMOVE_DAY --> CONFIRM_DEL[Confirm Deletion]

    ITEM_OPS --> SKIP[Skip Activity]
    ITEM_OPS --> ADD_ACT[Add from Activity Pool]
    ITEM_OPS --> SWAP[Swap Activity]
    ITEM_OPS --> HOTEL[Change Hotel]
    ITEM_OPS --> TRANS[Change Transport]
    ITEM_OPS --> GUIDE[Add/Change Guide]

    REORDER --> VALIDATE[Validate Time Constraints]
    VALIDATE --> OK{Valid?}
    OK -->|Yes| CALC[Recalculate Price]
    OK -->|No| ERROR[Show Conflict Error]
    ERROR --> VIEW

    SKIP --> CALC
    ADD_ACT --> CHECK_AVAIL[Check Availability]
    SWAP --> CHECK_AVAIL
    HOTEL --> CHECK_AVAIL
    TRANS --> CHECK_AVAIL
    GUIDE --> CHECK_AVAIL
    POPULATE --> CHECK_AVAIL

    CHECK_AVAIL --> AVAIL{Available?}
    AVAIL -->|Yes| CALC
    AVAIL -->|No| ALT[Show Alternatives]
    ALT --> VIEW

    CALC --> DELTA[Display Price Delta]
    DELTA --> DECISION{User Action}

    DECISION -->|Continue| VIEW
    DECISION -->|Save Draft| SAVE[POST /journey-drafts]
    DECISION -->|Confirm| CONFIRM[POST /availability/confirm]

    SAVE --> DRAFT[Draft Saved]
    DRAFT --> CAN_RETURN[User Can Return Later]

    CONFIRM --> FRESH[Fresh Availability Check]
    FRESH --> FRESH_OK{All Available?}
    FRESH_OK -->|No| CHANGED[Show Changes]
    CHANGED --> VIEW
    FRESH_OK -->|Yes| CHECKOUT[Proceed to Checkout]
```
