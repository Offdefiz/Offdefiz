BEGIN;
CREATE TABLE IF NOT EXISTS cj_payment_orders (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL UNIQUE,
 plan text NOT NULL CHECK(plan IN ('solo','escritorio','equipe')),
 method text NOT NULL CHECK(method IN ('pix','card')),
 amount integer NOT NULL CHECK(amount>0),
 firm text NOT NULL,
 name text NOT NULL,
 email text NOT NULL,
 status text NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','waiting','paid','in_analysis','declined','canceled','refunded','expired')),
 checkout_id text UNIQUE,
 provider_order_id text UNIQUE,
 charge_id text,
 url text,
 expires_at timestamptz,
 paid_at timestamptz,
 lead_id uuid REFERENCES cj_sales_leads(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cj_payment_orders_created_idx ON cj_payment_orders(created_at DESC);
CREATE TABLE IF NOT EXISTS cj_payment_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 payment_id uuid NOT NULL REFERENCES cj_payment_orders(id),
 status text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON cj_payment_orders,cj_payment_audit FROM PUBLIC;
COMMIT;
