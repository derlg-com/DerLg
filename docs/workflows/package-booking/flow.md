# Package Booking Flow Diagrams

> Visual flow reference for the homepage search package booking journey.

---

## Table of Contents

1. [High-Level Sequence Flow](#1-high-level-sequence-flow)
2. [Journey Map Customization Detail](#2-journey-map-customization-detail)
3. [Save vs Confirm Branch](#3-save-vs-confirm-branch)
4. [Payment Flow](#4-payment-flow)
5. [Booking State Machine](#5-booking-state-machine)
6. [Error Recovery Paths](#6-error-recovery-paths)
7. [Multi-Package Booking Flow](#7-multi-package-booking-flow)

---

## 1. High-Level Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant DB as PostgreSQL
    participant R as Redis
    participant S as Stripe/QR Provider

    U->>F: Opens Homepage
    F->>B: GET /trips?featured=true
    B->>DB: Query featured trips
    DB-->>B: Trip list
    B-->>F: Featured trips
    F-->>U: Render homepage

    U->>F: Types search query
    F->>B: GET /search?q=...
    B->>DB: Full-text search
    DB-->>B: Search results
    B-->>F: Package results
    F-->>U: Show search results

    U->>F: Taps package card
    F->>B: GET /trips/{slug}
    B->>DB: Query trip + journey map template
    DB-->>B: Trip detail
    B-->>F: Package with journey map
    F-->>U: Render package detail page

    U->>F: Taps "Customize My Journey"
    F-->>U: Enter customization mode

    loop Customization
        U->>F: Skip/Add/Swap activity, change hotel/transport
        F->>B: POST /availability/check
        B->>DB: Check inventory (cached)
        DB-->>B: Availability result
        B-->>F: Available/Unavailable
        F-->>U: Update price delta
    end

    alt Save My Journey
        U->>F: Taps "Save My Journey"
        F->>B: POST /journey-drafts
        B->>DB: Save draft
        DB-->>B: Draft saved
        B-->>F: Draft ID
        F-->>U: "Saved! Continue later"
        
        U->>F: Returns later
        F->>B: GET /journey-drafts
        B->>DB: Load draft
        DB-->>B: Draft data
        B-->>F: Saved journey
        F-->>U: Load customization mode
    else Confirm
        U->>F: Taps "Confirm"
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

## 2. Journey Map Customization Detail

```mermaid
flowchart TD
    START([Enter Customization Mode]) --> VIEW[View Default Journey Map]
    
    VIEW --> ACT{Customize Activities}
    VIEW --> HOTEL{Change Hotel}
    VIEW --> TRANS{Change Transport}
    VIEW --> GUIDE{Add Guide}
    VIEW --> SWAP{Swap Between Days}
    VIEW --> ADD_PKG{Add Another Package}
    
    ACT --> SKIP[Skip Activity]
    ACT --> ADD[Add from Activity Pool]
    ACT --> REMOVE[Remove Added Activity]
    
    SKIP --> CALC[Recalculate Price]
    ADD --> CHECK1[Check Availability]
    REMOVE --> CALC
    
    HOTEL --> SELECT_H[Select from Hotel Pool]
    SELECT_H --> CHECK2[Check Availability]
    
    TRANS --> SELECT_T[Select from Transport Pool]
    SELECT_T --> CHECK3[Check Availability]
    
    GUIDE --> SEARCH_G[Search Guides]
    SEARCH_G --> SELECT_G[Select Guide]
    SELECT_G --> CHECK4[Check Availability]
    
    SWAP --> SELECT_D1[Select Day 1 Activity]
    SELECT_D1 --> SELECT_D2[Select Day 2 Activity]
    SELECT_D2 --> VALIDATE[Validate Time Constraints]
    VALID --> CALC
    
    ADD_PKG --> SEARCH[Search More Packages]
    SEARCH --> SELECT_PKG[Select Package]
    SELECT_PKG --> MERGE[Merge Journey Maps]
    MERGE --> CALC
    
    CHECK1 --> AVAIL1{Available?}
    CHECK2 --> AVAIL2{Available?}
    CHECK3 --> AVAIL3{Available?}
    CHECK4 --> AVAIL4{Available?}
    
    AVAIL1 -->|Yes| CALC
    AVAIL1 -->|No| SHOW_ALT1[Show Alternatives]
    SHOW_ALT1 --> ACT
    
    AVAIL2 -->|Yes| CALC
    AVAIL2 -->|No| SHOW_ALT2[Show Alternatives]
    SHOW_ALT2 --> HOTEL
    
    AVAIL3 -->|Yes| CALC
    AVAIL3 -->|No| SHOW_ALT3[Show Alternatives]
    SHOW_ALT3 --> TRANS
    
    AVAIL4 -->|Yes| CALC
    AVAIL4 -->|No| SHOW_ALT4[Show Alternatives]
    SHOW_ALT4 --> GUIDE
    
    CALC --> UPDATE[Update Total Price]
    UPDATE --> DISPLAY[Display Price Delta]
    DISPLAY --> DECISION{User Action}
    
    DECISION -->|Continue Customizing| VIEW
    DECISION -->|Save My Journey| SAVE
    DECISION -->|Confirm| CONFIRM
    
    SAVE --> SAVE_API[POST /journey-drafts]
    SAVE_API --> DRAFT_SAVED[Draft Saved]
    DRAFT_SAVED --> CAN_RETURN[User Can Return Later]
    
    CONFIRM --> FRESH_CHECK[POST /availability/confirm]
    FRESH_CHECK --> FRESH_OK{All Available?}
    FRESH_OK -->|Yes| CHECKOUT[Proceed to Checkout]
    FRESH_OK -->|No| SHOW_CHANGED[Show What Changed]
    SHOW_CHANGED --> VIEW
```

---

## 3. Save vs Confirm Branch

```mermaid
flowchart LR
    subgraph "Customization Phase"
        A[User Customizing] --> B{User Decision}
    end
    
    subgraph "Save Path"
        B -->|Save My Journey| C[POST /journey-drafts]
        C --> D[Draft Stored in DB]
        D --> E[No Inventory Held]
        E --> F[User Leaves App]
        F --> G[Returns Later]
        G --> H[GET /journey-drafts]
        H --> I[Load Saved Draft]
        I --> A
    end
    
    subgraph "Confirm Path"
        B -->|Confirm| J[POST /availability/confirm]
        J --> K{Available?}
        K -->|No| L[Show Changes]
        L --> A
        K -->|Yes| M[Proceed to Checkout]
    end
    
    style C fill:#e1f5fe
    style J fill:#fff3e0
    style M fill:#e8f5e9
```

---

## 4. Payment Flow

```mermaid
flowchart TD
    CHECKOUT[Checkout Page<br/>15min Timer] --> SELECT{Payment Method}
    
    SELECT -->|Stripe Card| CARD[POST /payments/intent]
    SELECT -->|QR Code| QR[POST /payments/qr]
    
    CARD --> SECRET[Receive client_secret]
    SECRET --> ELEMENTS[Stripe Elements]
    ELEMENTS --> USER_CARD[User Enters Card]
    USER_CARD --> CONFIRM[Confirm Payment]
    CONFIRM --> STRIPE[Stripe Processing]
    STRIPE --> WEBHOOK[Webhook: succeeded]
    
    QR --> QR_DATA[Receive QR Image]
    QR_DATA --> DISPLAY[Display QR Code]
    DISPLAY --> USER_SCAN[User Scans with Bank App]
    USER_SCAN --> QR_WAIT[Poll Every 10s]
    QR_WAIT --> QR_CALLBACK[Provider Callback]
    
    WEBHOOK --> UPDATE[Update Booking: CONFIRMED]
    QR_CALLBACK --> UPDATE
    
    UPDATE --> DEL_REDIS[Delete Redis Hold Key]
    UPDATE --> GEN_QR[Generate Check-in QR]
    UPDATE --> EMAIL[Send Confirmation Email]
    UPDATE --> PUSH[Send Push Notification]
    
    DEL_REDIS --> CONFIRMED[Status: CONFIRMED]
    GEN_QR --> CONFIRMED
    EMAIL --> CONFIRMED
    PUSH --> CONFIRMED
    
    CONFIRMED --> SUCCESS[Show Success Page]
    SUCCESS --> JOURNEY[Display Final Journey Map]
    SUCCESS --> TICKET[Display QR Ticket]
    
    STRIPE -->|Failed| RETRY{Retry?}
    QR_WAIT -->|Timeout| EXPIRED[Booking EXPIRED]
    
    RETRY -->|Yes| CHECKOUT
    RETRY -->|No| CANCEL[CANCELLED]
```

---

## 5. Booking State Machine

```mermaid
stateDiagram-v2
    [*] --> HOLD : Create booking
    
    HOLD --> EXPIRED : 15 min timeout
    HOLD --> PENDING_PAYMENT : Payment initiated
    
    PENDING_PAYMENT --> EXPIRED : 15 min timeout
    PENDING_PAYMENT --> CONFIRMED : Payment success
    PENDING_PAYMENT --> CANCELLED : User cancels
    PENDING_PAYMENT --> HOLD : Payment retry (extend 5 min)
    
    CONFIRMED --> COMPLETED : Trip date passed
    CONFIRMED --> CANCELLED : User requests cancel
    
    CANCELLED --> REFUND_PENDING : Refund initiated
    REFUND_PENDING --> REFUNDED : Refund success
    REFUND_PENDING --> REFUND_FAILED : Refund failed
    
    EXPIRED --> [*] : Inventory released
    REFUNDED --> [*]
    REFUND_FAILED --> ADMIN_REVIEW : Admin intervention
    COMPLETED --> [*]
```

---

## 6. Error Recovery Paths

```mermaid
flowchart TD
    subgraph "During Customization"
        C1[User Changes Hotel] --> C2[Check Availability]
        C2 --> C3{Available?}
        C3 -->|No| C4[Show Sold Out Badge]
        C4 --> C5[Show Similar Options]
        C5 --> C1
        C3 -->|Yes| C6[Apply Change]
    end
    
    subgraph "At Confirm"
        CF1[User Clicks Confirm] --> CF2[Fresh Availability Check]
        CF2 --> CF3{All Available?}
        CF3 -->|No| CF4[Show What's Changed]
        CF4 --> CF5[Highlight Changed Items]
        CF5 --> CF6[User Re-customizes]
        CF6 --> CF1
        CF3 -->|Yes| CF7[Proceed to Checkout]
    end
    
    subgraph "During Payment"
        P1[Payment Processing] --> P2{Success?}
        P2 -->|Declined| P3[Show Error Message]
        P3 --> P4{Retry?}
        P4 -->|Yes| P5[Extend Hold +5 min]
        P5 --> P1
        P4 -->|No| P6[CANCELLED]
        P2 -->|Timeout| P7[EXPIRED]
        P7 --> P8[Notify User]
        P8 --> P9[Return to Search]
    end
    
    subgraph "Post-Booking"
        PB1[CONFIRMED] --> PB2{User Cancels?}
        PB2 -->|>=7 days| PB3[100% Refund]
        PB2 -->|1-7 days| PB4[50% Refund]
        PB2 -->|<24h| PB5[0% Refund]
        PB3 --> PB6[REFUNDED]
        PB4 --> PB6
        PB5 --> PB7[CANCELLED No Refund]
    end
```

---

## 7. Multi-Package Booking Flow

```mermaid
flowchart TD
    START([User Customizes Package A]) --> CUSTOM_A[Package A Journey Map]
    CUSTOM_A --> DONE_A{Done?}
    
    DONE_A -->|Add More| SEARCH[Search More Packages]
    SEARCH --> SELECT_B[Select Package B]
    SELECT_B --> CUSTOM_B[Package B Journey Map]
    CUSTOM_B --> MERGE[Merge into Single Booking]
    MERGE --> COMBINED[Combined Journey Map]
    
    DONE_A -->|Done| COMBINED
    CUSTOM_B -->|Add More| SEARCH
    
    COMBINED --> REVIEW[Review Combined Itinerary]
    REVIEW --> TIMELINE[Verify No Date Conflicts]
    TIMELINE --> OK{Valid?}
    
    OK -->|No| FIX[Show Conflict]
    FIX --> CUSTOM_A
    
    OK -->|Yes| PRICE[Combined Price Calculation]
    PRICE --> CHECKOUT[Single Checkout]
    CHECKOUT --> SINGLE_PAYMENT[One Payment for All Packages]
    SINGLE_PAYMENT --> CONFIRM[CONFIRMED]
    CONFIRM --> MULTI_TICKET[Multiple QR Tickets]
```

---

## Legend

| Color | Meaning |
|-------|---------|
| Light Blue | Save/Storage operation |
| Light Orange | Validation/Check operation |
| Light Green | Success/Proceed state |
| Red | Error/Failure state |
