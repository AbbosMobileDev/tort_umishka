-- TortBot ma'lumotlar modeli (PRD 10-bo'lim).
-- Barcha pul maydonlari BIGINT (so'm, butun son). FLOAT ishlatilmaydi.
-- Har bir jadvalda shop_id bor — hech qanday so'rov shop_id siz bajarilmasin.

CREATE TABLE IF NOT EXISTS shops (
  id                     SERIAL PRIMARY KEY,
  name                   TEXT        NOT NULL,
  bot_username           TEXT,
  admin_group_id         BIGINT,
  admin_user_ids         BIGINT[]    NOT NULL DEFAULT '{}',
  timezone               TEXT        NOT NULL DEFAULT 'Asia/Tashkent',
  prepayment_percent     INT         NOT NULL DEFAULT 40,
  delivery_fee           BIGINT      NOT NULL DEFAULT 20000,
  inscription_price      BIGINT      NOT NULL DEFAULT 15000,
  lead_time_hours        INT         NOT NULL DEFAULT 24,
  booking_horizon_days   INT         NOT NULL DEFAULT 30,
  daily_capacity_kg      NUMERIC(7,2) NOT NULL DEFAULT 25,
  daily_capacity_orders  INT         NOT NULL DEFAULT 8,
  working_days           INT[]       NOT NULL DEFAULT '{1,2,3,4,5,6}',  -- ISO: 1=Dushanba .. 7=Yakshanba
  time_slots             TEXT[]      NOT NULL DEFAULT '{"10:00-12:00","12:00-15:00","15:00-18:00"}',
  payment_card           TEXT,
  payment_card_holder    TEXT,
  contact_phone          TEXT,
  is_active              BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  shop_id    INT     NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  sort_order INT     NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS products (
  id             SERIAL PRIMARY KEY,
  shop_id        INT          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id    INT          NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name           TEXT         NOT NULL,
  description    TEXT,
  photo_file_id  TEXT,
  photo_path     TEXT,
  price_per_kg   BIGINT       NOT NULL,
  min_kg         NUMERIC(5,2) NOT NULL DEFAULT 1,
  max_kg         NUMERIC(5,2) NOT NULL DEFAULT 10,
  weight_options NUMERIC(5,2)[] NOT NULL DEFAULT '{1,1.5,2,3,4,5}',
  is_available   BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order     INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_options (
  id          SERIAL PRIMARY KEY,
  shop_id     INT    NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id  INT    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_name  TEXT   NOT NULL,
  option_name TEXT   NOT NULL,
  extra_price BIGINT NOT NULL DEFAULT 0,
  price_type  TEXT   NOT NULL DEFAULT 'fixed',   -- 'fixed' | 'per_kg'
  sort_order  INT    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id                    SERIAL PRIMARY KEY,
  shop_id               INT     NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  telegram_user_id      BIGINT  NOT NULL,
  phone                 TEXT,
  first_name            TEXT,
  username              TEXT,
  language              TEXT    NOT NULL DEFAULT 'uz',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, telegram_user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  shop_id          INT    NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  state            TEXT   NOT NULL DEFAULT 'IDLE',
  draft            JSONB  NOT NULL DEFAULT '{}'::jsonb,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,
  PRIMARY KEY (shop_id, telegram_user_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id                 SERIAL PRIMARY KEY,
  shop_id            INT    NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id        INT    NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_number       INT    NOT NULL,
  status             TEXT   NOT NULL DEFAULT 'DRAFT',
  product_snapshot   JSONB  NOT NULL DEFAULT '{}'::jsonb,
  options_snapshot   JSONB  NOT NULL DEFAULT '[]'::jsonb,
  weight_kg          NUMERIC(5,2) NOT NULL,
  inscription_text   TEXT,
  delivery_type      TEXT   NOT NULL DEFAULT 'pickup',   -- 'delivery' | 'pickup'
  address_text       TEXT,
  location_lat       DOUBLE PRECISION,
  location_lng       DOUBLE PRECISION,
  address_note       TEXT,
  pickup_date        DATE   NOT NULL,
  pickup_time_slot   TEXT,
  subtotal           BIGINT NOT NULL DEFAULT 0,
  delivery_fee       BIGINT NOT NULL DEFAULT 0,
  total              BIGINT NOT NULL DEFAULT 0,
  prepaid_amount     BIGINT NOT NULL DEFAULT 0,
  remaining_amount   BIGINT NOT NULL DEFAULT 0,
  payment_status     TEXT   NOT NULL DEFAULT 'unpaid',   -- unpaid | receipt_sent | paid | rejected
  payment_receipt_id TEXT,
  admin_message_id   BIGINT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at       TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  cancelled_reason   TEXT,
  UNIQUE (shop_id, order_number)
);

CREATE TABLE IF NOT EXISTS order_events (
  id          SERIAL PRIMARY KEY,
  order_id    INT  NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_type  TEXT NOT NULL DEFAULT 'system',  -- system | admin | customer
  actor_id    BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slot_holds (
  id               SERIAL PRIMARY KEY,
  shop_id          INT    NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  hold_date        DATE   NOT NULL,
  weight_kg        NUMERIC(5,2) NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS capacity_overrides (
  id             SERIAL PRIMARY KEY,
  shop_id        INT     NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  override_date  DATE    NOT NULL,
  capacity_kg    NUMERIC(7,2),
  capacity_orders INT,
  is_blocked     BOOLEAN NOT NULL DEFAULT FALSE,
  note           TEXT,
  UNIQUE (shop_id, override_date)
);

CREATE TABLE IF NOT EXISTS occasions (
  id               SERIAL PRIMARY KEY,
  shop_id          INT  NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id      INT  NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  occasion_name    TEXT NOT NULL,
  occasion_date    DATE NOT NULL,
  last_reminded_at TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  shop_id    INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_id   INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating     INT NOT NULL,
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migratsiyalar (eski bazalar uchun; yangi bazada ta'siri yo'q)
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_path TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_slot     ON orders (shop_id, pickup_date, status);
CREATE INDEX IF NOT EXISTS idx_holds_slot      ON slot_holds (shop_id, hold_date);
CREATE INDEX IF NOT EXISTS idx_holds_expires   ON slot_holds (expires_at);
CREATE INDEX IF NOT EXISTS idx_occasions_date  ON occasions (occasion_date);
CREATE INDEX IF NOT EXISTS idx_products_shop   ON products (shop_id, category_id, is_available);
