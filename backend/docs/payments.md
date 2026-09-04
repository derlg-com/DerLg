# Payments — Stripe cards and ABA KHQR

Two providers, two very different confirmation models.

| | Stripe (card) | ABA (KHQR) |
|---|---|---|
| Customer action | Enters card in the browser | Scans a QR in ABA Mobile |
| Confirmed by | Signed webhook from Stripe | Telegram credit alert, read by a userbot |
| Refunds | Automatic via the Stripe API | Manual payout, queued for an operator |
| Works without setup | No — 503 until configured | No — 400 until configured |

Neither is required to boot. With both unconfigured the catalogue, the AI
concierge and booking holds all work; only taking money is unavailable.

---

## 1. The one rule

**The browser never decides that a payment succeeded.**

A client that confirms a Stripe PaymentIntent could simply lie, and a customer who
closes the tab during 3-D Secure would otherwise never receive their booking. Only
two things mark a booking `confirmed`:

- a Stripe webhook whose HMAC signature verifies, or
- an ABA credit alert from an allowlisted Telegram sender.

Both funnel through `PaymentsService.settle()`, which is the only place that writes
`status: confirmed`.

---

## 2. Stripe setup

### 2.1 Keys

```bash
# backend/.env
STRIPE_SECRET_KEY=sk_test_...        # secret key — server only, never shipped
STRIPE_WEBHOOK_SECRET=whsec_...      # from `stripe listen`, or the dashboard
```

```bash
# web/.env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...   # public by design
```

The publishable key is meant to be in the browser. The secret key must never be —
`env.validation.ts` rejects a value that does not start with `sk_`, which catches
the common mistake of pasting the publishable key into the backend.

### 2.2 Local webhook forwarding

```bash
stripe listen --forward-to localhost:4007/v1/payments/stripe/webhook
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart the backend.

### 2.3 Why the raw body matters

`main.ts` creates the app with `{ rawBody: true }`. Stripe signs the exact bytes it
sent, so verification must see those bytes — a body that has been through
`JSON.parse` and re-serialised will not match, and key order or whitespace is
enough to break it. Remove `rawBody` and every webhook fails with an invalid
signature.

### 2.4 Test cards

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Succeeds immediately |
| `4000 0025 0000 3155` | Requires 3-D Secure |
| `4000 0000 0000 9995` | Declined (insufficient funds) |

Any future expiry, any CVC.

---

## 3. ABA setup

ABA publishes no payment API. The integration uses the only two open surfaces
that exist: the KHQR spec to mint a QR with the amount pre-filled, and the
Telegram credit alert ABA's bot posts when money arrives.

```
┌───────────────────────────────────────────────────────────────────────┐
│ 1. GENERATE   POST /v1/payments/intents { method: 'aba_qr' }           │
│               static merchant QR → dynamic QR (amount + 10-min expiry) │
│               writes a pending `payments` row with provider = aba      │
├───────────────────────────────────────────────────────────────────────┤
│ 2. PAY        customer scans in ABA Mobile; the amount is pre-filled   │
│               money lands in the merchant account                      │
│               ABA's bot posts a credit alert in your Telegram group    │
├───────────────────────────────────────────────────────────────────────┤
│ 3. CONFIRM    the userbot reads the alert, parses amount + trx id      │
│               finds the ONE matching pending payment → settles it      │
│               the browser's status poll sees `succeeded`                │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.1 Merchant QR

```bash
ABA_STATIC_QR=000201010211...6304XXXX
ABA_QR_TTL_MINUTES=10
```

Get the string from the ABA merchant portal or the QR on your merchant card. It
must start with `000201` and contain `010211` (static point-of-initiation).

`AbaKhqrService.buildDynamicQr` makes four edits, and **all four are required** —
omitting any one produces a QR that fails differently in ABA Mobile:

| Edit | Omitting it causes |
|---|---|
| Point-of-initiation `11` → `12` | Amount ignored: *"must input the value"* |
| Insert amount (tag 54) | No preset amount |
| Append timestamp (tag 99) | *"the QR code is expired"* |
| Recompute CRC-16 (tag 63) | Will not scan at all |

The TTL is capped at 14 minutes because the booking hold is 15. A QR that outlives
its hold lets a customer pay for inventory that has already been released.

### 3.2 Telegram userbot

A **user account**, not a bot. The Bot API forbids one bot from reading another
bot's messages, so a Bot API listener would connect successfully and then never
receive a single ABA alert.

1. Create an app at <https://my.telegram.org> → *API development tools*.
2. Put `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` in `backend/.env`.
3. Add that Telegram account to the group where ABA posts alerts.
4. Find the group id by forwarding one of its messages to `@userinfobot`.
5. Generate the session:

```bash
cd backend && npm run telegram:login
```

Paste the printed `TELEGRAM_SESSION=...` into `.env`. This runs once; the session
is reused on every boot.

```bash
ABA_TELEGRAM_GROUP_ID=-1004302307901
ABA_ALERT_SENDER_IDS=123456789          # ABA's bot id — see the warning below
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
TELEGRAM_SESSION=1BQANOTE...
```

On startup you should see:

```
ABA Telegram listener started { account: ..., group: ..., senderAllowlist: 1 }
```

### 3.3 Set the sender allowlist

**Group membership is not authorisation.** A credit alert is an instruction to mark
a booking paid. With `ABA_ALERT_SENDER_IDS` empty, anyone who can post in that
group can send text matching ABA's format and confirm a booking nobody paid for.

The listener logs a warning at startup when the allowlist is empty, and discards
payment-shaped messages from unlisted senders at `error` level.

---

## 4. How ABA settlement stays safe

ABA's alert gives us an amount, a payer phone suffix and a transaction id. Only the
amount is something we also know in advance, so matching is on amount — with two
safeguards.

**Replay cannot settle twice.** The transaction id is written to
`payments.provider_payment_id`, which has a unique index. Stripe redelivers
webhooks and Telegram replays messages after a reconnect; an application-level
"have I seen this?" check loses to a race between two concurrent deliveries, a
unique index does not. A Redis `SET NX` on the trx id short-circuits the common
case before touching Postgres.

**Ambiguity refuses to guess.** If two pending ABA payments share an amount,
nothing is settled: an `ABA_PAYMENT_AMBIGUOUS` event is published to the admin
real-time channel for an operator to resolve. Settling the newest would be a coin
flip that confirms one stranger's booking with another stranger's money.

The trade-off is explicit: a genuine payment can sit pending until a human looks at
it. That is the right direction to fail when the alternative is confirming the
wrong booking.

An alert that matches nothing publishes `ABA_PAYMENT_UNMATCHED` instead.

### 4.1 Resolving an exception

Refusing to guess only works if a human can finish the job, so
`/admin/payments` exists for exactly that.

| Section | What it is for |
|---|---|
| **ABA exceptions** | ABA payments whose QR expired while still pending — money that arrived unmatched, or an ambiguous match. |
| **Refund payouts** | Queued ABA refunds awaiting a manual bank transfer. |
| **All payments** | Read-only ledger, searchable by booking reference or settlement id. |

**Settling by hand** (`POST /v1/admin/payments/:id/settle`, OPERATIONS_MANAGER+):

- ABA only. Cards settle by webhook; a manual override for Stripe would be a way
  to confirm a booking Stripe never charged for.
- Requires the numeric ABA transaction id from the credit alert. It is written to
  the unique `provider_payment_id`, so the same bank transaction cannot settle two
  bookings, and every manual settlement traces to a line on the statement.
- Requires a written reason, recorded in the audit log.
- Also claims the trx id in Redis, so a late-arriving Telegram alert for that
  transaction is ignored rather than reported as unmatched.

**Confirming a payout** (`PATCH /v1/admin/refunds/:id/complete`, OPERATIONS_MANAGER+)
requires the bank transfer reference and a reason. This is the point at which
`payments.refunded_amount_usd` moves — after the transfer, not before.

Support agents can read all three sections but see neither write action. Both are
audit-logged with the operator's justification.

---

## 5. Refunds

Refund tiers come from `computeRefund` (100% ≥7 days, 50% 1–7 days, 0% <24h) and
are applied by `RefundOnCancelListener`, which consumes the existing
`booking.cancelled` event.

Before this, that event had no consumer — a customer cancelling inside the 100%
window was told they would be refunded and no money ever moved.

- **Card**: refunded through Stripe, with an idempotency key derived from the
  payment id and amount so a retried cancellation cannot refund twice.
- **ABA**: no refund API exists, so a `pending` refund row is written and
  `ABA_REFUND_REQUIRED` is published for a manual payout. The payment's own
  `refunded_amount_usd` is deliberately *not* moved until the payout happens —
  reporting money as returned when nobody sent it is worse than flagging the work.

A refund never exceeds what was actually taken minus what was already returned.

---

## 6. Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/v1/payments/intents` | JWT | `{ bookingId, method: 'card' \| 'aba_qr' }`. 3/min. |
| GET | `/v1/payments/status?bookingId=` | JWT | Owner-scoped. Polled by the client. |
| POST | `/v1/payments/stripe/webhook` | HMAC signature | `@Public()`, not rate limited. |
| POST | `/v1/ai-tools/payments/qr` | Service key | The concierge's ABA QR tool. |
| GET | `/v1/admin/payments` | Admin (support+) | Ledger. Filters: provider, status, search, dates. |
| GET | `/v1/admin/payments/aba-exceptions` | Admin (support+) | Expired-pending ABA payments. |
| POST | `/v1/admin/payments/:id/settle` | Admin (ops+) | Manual ABA settlement. Audited. |
| GET | `/v1/admin/refunds` | Admin (support+) | Refunds; filter `status=pending` for the queue. |
| PATCH | `/v1/admin/refunds/:id/complete` | Admin (ops+) | Confirms an ABA payout. Audited. |

`POST /v1/bookings/:id/confirm` still exists behind `DEMO_PAYMENTS` for local demos
and seeded fixtures. It marks a booking paid with no charge, so it must stay `false`
in production.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| *"must input the value"* in ABA Mobile | Point-of-initiation still `11` | Confirm `ABA_STATIC_QR` contains `010211`; the service flips it |
| *"the QR code is expired"* immediately | Tag 99 missing, or expiry in seconds not milliseconds | Both are covered by `buildDynamicQr`; check you are not passing a hand-built payload |
| QR will not scan at all | Bad CRC | The CRC must cover the `6304` prefix itself |
| `ABA_STATIC_QR does not end with a CRC tag` at boot | Truncated paste | Re-copy the full string from ABA |
| `listener not started: TELEGRAM_* missing` | No session | Run `npm run telegram:login` |
| Listener runs, no alerts arrive | Account not in the group, or wrong group id | Compare the id against `@userinfobot`'s answer |
| `ABA credit alert matched no pending payment` | Paid after the QR expired, or amount differs | Pay within `ABA_QR_TTL_MINUTES` |
| `alert is ambiguous; refusing to settle` | Two pending payments, same amount | Resolve by hand; see §4 |
| Every Stripe webhook returns 400 | `STRIPE_WEBHOOK_SECRET` wrong, or `rawBody` disabled | Re-copy from `stripe listen`; keep `rawBody: true` in `main.ts` |
| Card form shows "unavailable" | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` unset | Set it in `web/.env.local` and restart Next |

---

## 8. Secrets

| Value | Sensitivity |
|---|---|
| `TELEGRAM_SESSION` | **Full account credential** — read and write, no second factor. Never commit. |
| `TELEGRAM_API_HASH` | Secret. |
| `STRIPE_SECRET_KEY` | Secret. |
| `STRIPE_WEBHOOK_SECRET` | Secret. Without it, webhooks fail closed. |
| `ABA_STATIC_QR` | Not secret (it is in every QR a customer sees) but it is the merchant identifier — a wrong value sends money elsewhere. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public by design. |

Lock the ABA Telegram group down so only ABA's bot and trusted admins can post, and
set `ABA_ALERT_SENDER_IDS` regardless.
