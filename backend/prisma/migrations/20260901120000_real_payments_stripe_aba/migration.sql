-- Real payments: ABA as a first-class provider, plus settlement idempotency.
--
-- Until now there was no payment code at all. The only way a booking became paid
-- was the `DEMO_PAYMENTS`-gated sandbox confirm, which wrote a `succeeded` row
-- without a charge. This migration prepares `payments` for Stripe PaymentIntents
-- and ABA KHQR.
--
-- Every change here is additive and backward-compatible: existing rows keep their
-- values, and nothing that reads the table today needs to change.

-- ---------------------------------------------------------------------------
-- 1. ABA becomes its own provider.
--
-- ABA and Bakong both ride the KHQR rail, so the placeholder QR code in
-- ai-tools wrote ABA payments as `bakong`. That is not safe once settlement is
-- real: ABA is confirmed out-of-band by parsing a Telegram credit alert and
-- matching on amount, while Bakong is confirmed by polling a provider API. With
-- one shared value, an ABA credit alert could settle a Bakong row that happened
-- to share an amount.
--
-- Safe in a transaction on PostgreSQL 12+ because the new value is not
-- referenced by any statement in this migration.
-- ---------------------------------------------------------------------------
ALTER TYPE "payment_provider" ADD VALUE 'aba';

-- ---------------------------------------------------------------------------
-- 2. Persist the KHQR payload.
--
-- `qr_code_url` holds a rendered image URL. The KHQR string itself — the thing
-- the customer's banking app decodes, carrying the preset amount and expiry — had
-- nowhere to live. It must be stored rather than re-derived: regenerating it
-- would mint a fresh expiry timestamp and a different CRC, silently invalidating
-- the code already displayed on the customer's screen.
-- ---------------------------------------------------------------------------
ALTER TABLE "payments" ADD COLUMN "qr_payload" TEXT;

-- ---------------------------------------------------------------------------
-- 3. Settlement idempotency at the database level.
--
-- `provider_payment_id` holds a Stripe charge id or an ABA transaction id. Both
-- arrive over channels that redeliver: Stripe retries webhooks until it gets a
-- 2xx, and the Telegram client can replay messages after a reconnect. An
-- application-level "have I seen this id?" check loses to a race between two
-- concurrent deliveries; a unique index cannot.
--
-- Postgres permits unlimited NULLs in a unique index, so unsettled payments are
-- unaffected. Verified no duplicate non-NULL values exist before adding this.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");

-- ---------------------------------------------------------------------------
-- 4. Index the ABA listener's hot path.
--
-- Confirming an ABA payment means finding the pending row for one provider with
-- one exact amount. That query runs on every credit alert, while a customer is
-- watching a QR code — a sequential scan of `payments` is the wrong thing to do
-- there, and it gets slower for every payment the platform has ever taken.
-- ---------------------------------------------------------------------------
CREATE INDEX "payments_provider_status_amount_usd_idx" ON "payments"("provider", "status", "amount_usd");
