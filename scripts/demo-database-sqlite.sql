-- DataQuery Pro Demo Database (SQLite Version)
-- A comprehensive SaaS company database for demonstrating analytics capabilities
-- Company: "CloudMetrics Inc." - A fictional B2B analytics platform

-- ============================================================================
-- CLEANUP (Drop tables if they exist)
-- ============================================================================
DROP TABLE IF EXISTS support_ticket_comments;
DROP TABLE IF EXISTS support_tickets;
DROP TABLE IF EXISTS invoice_line_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS usage_events;
DROP TABLE IF EXISTS subscription_history;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS product_features;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS feature_flags;
DROP TABLE IF EXISTS regions;
DROP TABLE IF EXISTS industries;
DROP TABLE IF EXISTS ticket_categories;
DROP TABLE IF EXISTS ticket_priorities;

-- Drop views if they exist
DROP VIEW IF EXISTS monthly_revenue;
DROP VIEW IF EXISTS customer_health;

-- ============================================================================
-- LOOKUP/REFERENCE TABLES
-- ============================================================================

-- Regions for geographic analysis
CREATE TABLE regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    timezone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO regions (name, code, timezone) VALUES
('North America', 'NA', 'America/New_York'),
('Europe', 'EU', 'Europe/London'),
('Asia Pacific', 'APAC', 'Asia/Singapore'),
('Latin America', 'LATAM', 'America/Sao_Paulo'),
('Middle East & Africa', 'MEA', 'Asia/Dubai');

-- Industries for customer segmentation
CREATE TABLE industries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO industries (name, code, description) VALUES
('Technology', 'TECH', 'Software, hardware, and IT services companies'),
('Healthcare', 'HEALTH', 'Hospitals, clinics, and health tech'),
('Finance', 'FIN', 'Banks, insurance, and fintech'),
('Retail', 'RETAIL', 'E-commerce and brick-and-mortar retail'),
('Manufacturing', 'MFG', 'Industrial and consumer goods manufacturing'),
('Education', 'EDU', 'Schools, universities, and edtech'),
('Media', 'MEDIA', 'Publishing, entertainment, and advertising'),
('Professional Services', 'PROSERV', 'Consulting, legal, and accounting firms');

-- Support ticket categories
CREATE TABLE ticket_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO ticket_categories (name, code, description) VALUES
('Technical Issue', 'TECH', 'Bugs, errors, and technical problems'),
('Billing', 'BILLING', 'Payment and invoice questions'),
('Feature Request', 'FEATURE', 'New feature suggestions'),
('Account', 'ACCOUNT', 'Account management and access'),
('Integration', 'INTEGRATION', 'API and third-party integrations'),
('Training', 'TRAINING', 'How-to questions and onboarding');

-- Support ticket priorities
CREATE TABLE ticket_priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    sla_hours INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO ticket_priorities (name, code, sla_hours) VALUES
('Critical', 'P1', 4),
('High', 'P2', 8),
('Medium', 'P3', 24),
('Low', 'P4', 72);

-- ============================================================================
-- PRODUCTS
-- ============================================================================

CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    monthly_price REAL NOT NULL,
    annual_price REAL NOT NULL,
    max_users INTEGER,
    max_data_gb INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO products (name, code, description, monthly_price, annual_price, max_users, max_data_gb) VALUES
('Starter', 'STARTER', 'Perfect for small teams getting started with analytics', 29.00, 290.00, 5, 10),
('Professional', 'PRO', 'Advanced features for growing businesses', 99.00, 990.00, 25, 100),
('Business', 'BIZ', 'Full-featured solution for established companies', 249.00, 2490.00, 100, 500),
('Enterprise', 'ENT', 'Custom solution for large organizations', 599.00, 5990.00, NULL, NULL);

-- Feature flags available in products
CREATE TABLE feature_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO feature_flags (name, code, description) VALUES
('Real-time Analytics', 'REALTIME', 'Live dashboard updates'),
('Custom Reports', 'CUSTOM_REPORTS', 'Build custom report templates'),
('API Access', 'API', 'REST API for integrations'),
('SSO Authentication', 'SSO', 'Single sign-on support'),
('Advanced Exports', 'ADV_EXPORT', 'Export to multiple formats'),
('White Labeling', 'WHITE_LABEL', 'Custom branding options'),
('Dedicated Support', 'DED_SUPPORT', '24/7 dedicated support team'),
('Data Warehouse', 'DW', 'Direct data warehouse connection'),
('AI Insights', 'AI', 'AI-powered recommendations'),
('Audit Logs', 'AUDIT', 'Comprehensive audit logging');

-- Product-Feature mapping
CREATE TABLE product_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    feature_id INTEGER NOT NULL REFERENCES feature_flags(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(product_id, feature_id)
);

-- Starter features
INSERT INTO product_features (product_id, feature_id) VALUES (1, 5);

-- Professional features
INSERT INTO product_features (product_id, feature_id) VALUES (2, 1), (2, 5), (2, 3);

-- Business features
INSERT INTO product_features (product_id, feature_id) VALUES (3, 1), (3, 2), (3, 3), (3, 5), (3, 9), (3, 10);

-- Enterprise features (all)
INSERT INTO product_features (product_id, feature_id) VALUES
(4, 1), (4, 2), (4, 3), (4, 4), (4, 5), (4, 6), (4, 7), (4, 8), (4, 9), (4, 10);

-- ============================================================================
-- ORGANIZATIONS AND TEAMS
-- ============================================================================

CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    domain TEXT,
    industry_id INTEGER REFERENCES industries(id),
    region_id INTEGER REFERENCES regions(id),
    employee_count INTEGER,
    annual_revenue REAL,
    website TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    team_id INTEGER REFERENCES teams(id),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    title TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    is_admin INTEGER DEFAULT 0,
    last_login_at TEXT,
    login_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role_name TEXT NOT NULL,
    granted_at TEXT DEFAULT (datetime('now')),
    granted_by INTEGER REFERENCES users(id)
);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    status TEXT NOT NULL DEFAULT 'active',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    current_price REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    trial_ends_at TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    cancelled_at TEXT,
    next_billing_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE subscription_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
    previous_product_id INTEGER REFERENCES products(id),
    new_product_id INTEGER REFERENCES products(id),
    change_type TEXT NOT NULL,
    change_reason TEXT,
    changed_at TEXT DEFAULT (datetime('now')),
    changed_by INTEGER REFERENCES users(id)
);

-- ============================================================================
-- INVOICES
-- ============================================================================

CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    subscription_id INTEGER REFERENCES subscriptions(id),
    invoice_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    subtotal REAL NOT NULL,
    tax_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    due_date TEXT NOT NULL,
    paid_at TEXT,
    payment_method TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE invoice_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- USAGE TRACKING
-- ============================================================================

CREATE TABLE usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    user_id INTEGER REFERENCES users(id),
    event_type TEXT NOT NULL,
    event_data TEXT,
    data_processed_mb REAL,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes for faster queries on usage_events
CREATE INDEX idx_usage_events_org_date ON usage_events(organization_id, created_at);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);

-- ============================================================================
-- SUPPORT TICKETS
-- ============================================================================

CREATE TABLE support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    category_id INTEGER NOT NULL REFERENCES ticket_categories(id),
    priority_id INTEGER NOT NULL REFERENCES ticket_priorities(id),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    resolution TEXT,
    first_response_at TEXT,
    resolved_at TEXT,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE support_ticket_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- GENERATE DEMO DATA
-- ============================================================================

-- Generate 50 organizations across different industries and regions
INSERT INTO organizations (name, domain, industry_id, region_id, employee_count, annual_revenue, website, created_at) VALUES
('Nexus Technologies', 'nexustechnologies.com', 1, 1, 450, 15000000.00, 'https://www.nexustechnologies.com', datetime('now', '-400 days')),
('Quantum Dynamics', 'quantumdynamics.com', 1, 2, 820, 28000000.00, 'https://www.quantumdynamics.com', datetime('now', '-380 days')),
('Stellar Innovations', 'stellarinnovations.com', 1, 3, 150, 5000000.00, 'https://www.stellarinnovations.com', datetime('now', '-360 days')),
('Peak Performance Co', 'peakperformanceco.com', 2, 1, 1200, 45000000.00, 'https://www.peakperformanceco.com', datetime('now', '-340 days')),
('Blue Ocean Ventures', 'blueoceanventures.com', 3, 2, 380, 22000000.00, 'https://www.blueoceanventures.com', datetime('now', '-320 days')),
('Summit Analytics', 'summitanalytics.com', 1, 1, 95, 3500000.00, 'https://www.summitanalytics.com', datetime('now', '-300 days')),
('Horizon Labs', 'horizonlabs.com', 2, 3, 620, 18000000.00, 'https://www.horizonlabs.com', datetime('now', '-280 days')),
('Velocity Systems', 'velocitysystems.com', 1, 4, 210, 8000000.00, 'https://www.velocitysystems.com', datetime('now', '-260 days')),
('Apex Solutions', 'apexsolutions.com', 8, 1, 45, 2200000.00, 'https://www.apexsolutions.com', datetime('now', '-240 days')),
('Pinnacle Group', 'pinnaclegroup.com', 3, 2, 1800, 75000000.00, 'https://www.pinnaclegroup.com', datetime('now', '-220 days')),
('Aurora Digital', 'auroradigital.com', 7, 1, 280, 12000000.00, 'https://www.auroradigital.com', datetime('now', '-200 days')),
('Zenith Corp', 'zenithcorp.com', 5, 3, 3200, 120000000.00, 'https://www.zenithcorp.com', datetime('now', '-180 days')),
('Vanguard Tech', 'vanguardtech.com', 1, 1, 520, 19000000.00, 'https://www.vanguardtech.com', datetime('now', '-160 days')),
('Phoenix Industries', 'phoenixindustries.com', 5, 4, 890, 35000000.00, 'https://www.phoenixindustries.com', datetime('now', '-140 days')),
('Catalyst Partners', 'catalystpartners.com', 8, 2, 120, 6500000.00, 'https://www.catalystpartners.com', datetime('now', '-120 days')),
('Momentum Inc', 'momentuminc.com', 4, 1, 450, 25000000.00, 'https://www.momentuminc.com', datetime('now', '-100 days')),
('Synergy Solutions', 'synergysolutions.com', 1, 5, 180, 7000000.00, 'https://www.synergysolutions.com', datetime('now', '-80 days')),
('Elevate Digital', 'elevatedigital.com', 7, 1, 95, 4200000.00, 'https://www.elevatedigital.com', datetime('now', '-60 days')),
('Precision Systems', 'precisionsystems.com', 5, 2, 1500, 55000000.00, 'https://www.precisionsystems.com', datetime('now', '-40 days')),
('Vector Analytics', 'vectoranalytics.com', 1, 3, 75, 2800000.00, 'https://www.vectoranalytics.com', datetime('now', '-20 days')),
('Nova Enterprises', 'novaenterprises.com', 4, 1, 680, 28000000.00, 'https://www.novaenterprises.com', datetime('now', '-350 days')),
('Atlas Corporation', 'atlascorporation.com', 5, 2, 2400, 95000000.00, 'https://www.atlascorporation.com', datetime('now', '-330 days')),
('Frontier Tech', 'frontiertech.com', 1, 4, 320, 11000000.00, 'https://www.frontiertech.com', datetime('now', '-310 days')),
('Pulse Digital', 'pulsedigital.com', 7, 1, 140, 5500000.00, 'https://www.pulsedigital.com', datetime('now', '-290 days')),
('Core Dynamics', 'coredynamics.com', 1, 3, 410, 16000000.00, 'https://www.coredynamics.com', datetime('now', '-270 days')),
('Fusion Labs', 'fusionlabs.com', 2, 2, 560, 21000000.00, 'https://www.fusionlabs.com', datetime('now', '-250 days')),
('Impact Solutions', 'impactsolutions.com', 8, 1, 85, 3800000.00, 'https://www.impactsolutions.com', datetime('now', '-230 days')),
('Matrix Systems', 'matrixsystems.com', 1, 5, 720, 27000000.00, 'https://www.matrixsystems.com', datetime('now', '-210 days')),
('Orbit Technologies', 'orbittechnologies.com', 1, 1, 190, 7500000.00, 'https://www.orbittechnologies.com', datetime('now', '-190 days')),
('Prism Analytics', 'prismanalytics.com', 1, 2, 65, 2400000.00, 'https://www.prismanalytics.com', datetime('now', '-170 days')),
('Spark Innovations', 'sparkinnovations.com', 1, 3, 230, 9000000.00, 'https://www.sparkinnovations.com', datetime('now', '-150 days')),
('Titan Corp', 'titancorp.com', 5, 4, 4500, 180000000.00, 'https://www.titancorp.com', datetime('now', '-130 days')),
('Unity Digital', 'unitydigital.com', 7, 1, 175, 6800000.00, 'https://www.unitydigital.com', datetime('now', '-110 days')),
('Wave Technologies', 'wavetechnologies.com', 1, 2, 340, 13000000.00, 'https://www.wavetechnologies.com', datetime('now', '-90 days')),
('Xcel Partners', 'xcelpartners.com', 8, 1, 55, 2900000.00, 'https://www.xcelpartners.com', datetime('now', '-70 days')),
('Zephyr Systems', 'zephyrsystems.com', 1, 5, 480, 18500000.00, 'https://www.zephyrsystems.com', datetime('now', '-50 days')),
('Alpha Ventures', 'alphaventures.com', 3, 1, 920, 42000000.00, 'https://www.alphaventures.com', datetime('now', '-30 days')),
('Beta Solutions', 'betasolutions.com', 1, 2, 135, 5200000.00, 'https://www.betasolutions.com', datetime('now', '-10 days')),
('Delta Corp', 'deltacorp.com', 5, 3, 1100, 48000000.00, 'https://www.deltacorp.com', datetime('now', '-365 days')),
('Gamma Industries', 'gammaindustries.com', 5, 4, 2800, 110000000.00, 'https://www.gammaindustries.com', datetime('now', '-345 days')),
('Omega Tech', 'omegatech.com', 1, 1, 395, 15500000.00, 'https://www.omegatech.com', datetime('now', '-325 days')),
('Sigma Partners', 'sigmapartners.com', 8, 2, 70, 3200000.00, 'https://www.sigmapartners.com', datetime('now', '-305 days')),
('Theta Labs', 'thetalabs.com', 2, 3, 445, 17000000.00, 'https://www.thetalabs.com', datetime('now', '-285 days')),
('Lambda Systems', 'lambdasystems.com', 1, 1, 260, 10000000.00, 'https://www.lambdasystems.com', datetime('now', '-265 days')),
('Epsilon Digital', 'epsilondigital.com', 7, 5, 110, 4500000.00, 'https://www.epsilondigital.com', datetime('now', '-245 days')),
('Kappa Innovations', 'kappainnovations.com', 1, 2, 185, 7200000.00, 'https://www.kappainnovations.com', datetime('now', '-225 days')),
('Rho Analytics', 'rhoanalytics.com', 1, 1, 50, 1900000.00, 'https://www.rhoanalytics.com', datetime('now', '-205 days')),
('Tau Corporation', 'taucorporation.com', 3, 3, 1350, 58000000.00, 'https://www.taucorporation.com', datetime('now', '-185 days')),
('Upsilon Tech', 'upsilontech.com', 1, 4, 305, 12500000.00, 'https://www.upsilontech.com', datetime('now', '-165 days')),
('Iota Solutions', 'iotasolutions.com', 8, 1, 40, 1800000.00, 'https://www.iotasolutions.com', datetime('now', '-145 days'));

-- Generate teams for each organization (Engineering team for all)
INSERT INTO teams (organization_id, name, description, created_at)
SELECT id, 'Engineering', 'Team responsible for engineering', datetime(created_at, '+5 days')
FROM organizations;

-- Marketing teams (for ~70% of orgs)
INSERT INTO teams (organization_id, name, description, created_at)
SELECT id, 'Marketing', 'Team responsible for marketing', datetime(created_at, '+10 days')
FROM organizations WHERE id % 3 <> 0;

-- Sales teams (for ~75% of orgs)
INSERT INTO teams (organization_id, name, description, created_at)
SELECT id, 'Sales', 'Team responsible for sales', datetime(created_at, '+15 days')
FROM organizations WHERE id % 4 <> 0;

-- Analytics teams (for ~50% of orgs)
INSERT INTO teams (organization_id, name, description, created_at)
SELECT id, 'Analytics', 'Team responsible for analytics', datetime(created_at, '+20 days')
FROM organizations WHERE id % 2 = 0;

-- Operations teams (for ~80% of orgs)
INSERT INTO teams (organization_id, name, description, created_at)
SELECT id, 'Operations', 'Team responsible for operations', datetime(created_at, '+25 days')
FROM organizations WHERE id % 5 <> 0;

-- Generate users for organizations (5 users per org)
-- Admin users
INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id LIMIT 1),
    'admin@' || o.domain,
    'Admin',
    'User',
    'Administrator',
    1,
    abs(random() % 500),
    datetime('now', '-' || (abs(random() % 30)) || ' days'),
    datetime(o.created_at, '+1 days')
FROM organizations o;

-- James Smith users
INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id ORDER BY random() LIMIT 1),
    'james.smith@' || o.domain,
    'James',
    'Smith',
    'Manager',
    0,
    abs(random() % 300),
    datetime('now', '-' || (abs(random() % 30)) || ' days'),
    datetime(o.created_at, '+5 days')
FROM organizations o;

-- Mary Johnson users
INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id ORDER BY random() LIMIT 1),
    'mary.johnson@' || o.domain,
    'Mary',
    'Johnson',
    'Analyst',
    0,
    abs(random() % 200),
    datetime('now', '-' || (abs(random() % 30)) || ' days'),
    datetime(o.created_at, '+10 days')
FROM organizations o;

-- Robert Williams users
INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id ORDER BY random() LIMIT 1),
    'robert.williams@' || o.domain,
    'Robert',
    'Williams',
    'Engineer',
    0,
    abs(random() % 250),
    datetime('now', '-' || (abs(random() % 30)) || ' days'),
    datetime(o.created_at, '+15 days')
FROM organizations o;

-- Patricia Brown users
INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id ORDER BY random() LIMIT 1),
    'patricia.brown@' || o.domain,
    'Patricia',
    'Brown',
    'Specialist',
    0,
    abs(random() % 150),
    datetime('now', '-' || (abs(random() % 30)) || ' days'),
    datetime(o.created_at, '+20 days')
FROM organizations o;

-- Generate subscriptions for organizations
INSERT INTO subscriptions (organization_id, product_id, status, billing_cycle, current_price, discount_percent, started_at, next_billing_date)
SELECT
    o.id,
    CASE
        WHEN o.employee_count < 50 THEN 1
        WHEN o.employee_count < 200 THEN 2
        WHEN o.employee_count < 1000 THEN 3
        ELSE 4
    END,
    CASE WHEN o.id % 10 <> 0 THEN 'active' ELSE 'cancelled' END,
    CASE WHEN o.id % 3 <> 0 THEN 'annual' ELSE 'monthly' END,
    CASE
        WHEN o.employee_count < 50 THEN 29.00
        WHEN o.employee_count < 200 THEN 99.00
        WHEN o.employee_count < 1000 THEN 249.00
        ELSE 599.00
    END,
    CASE WHEN o.id % 4 = 0 THEN (abs(random() % 20) + 5) ELSE 0 END,
    datetime(o.created_at, '+' || (abs(random() % 30)) || ' days'),
    datetime('now', '+' || (abs(random() % 30)) || ' days')
FROM organizations o;

-- Generate invoices (3 invoices per subscription)
-- First invoice
INSERT INTO invoices (organization_id, subscription_id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, payment_method, created_at)
SELECT
    s.organization_id,
    s.id,
    'INV-' || (10000 + (s.id * 3)),
    'paid',
    s.current_price * (1 - s.discount_percent/100),
    s.current_price * 0.08,
    s.current_price * (1 - s.discount_percent/100) * 1.08,
    date(s.started_at, '+30 days'),
    datetime(s.started_at, '+' || (abs(random() % 25) + 1) || ' days'),
    CASE WHEN s.id % 3 <> 0 THEN 'credit_card' ELSE 'bank_transfer' END,
    s.started_at
FROM subscriptions s;

-- Second invoice
INSERT INTO invoices (organization_id, subscription_id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, payment_method, created_at)
SELECT
    s.organization_id,
    s.id,
    'INV-' || (10001 + (s.id * 3)),
    'paid',
    s.current_price * (1 - s.discount_percent/100),
    s.current_price * 0.08,
    s.current_price * (1 - s.discount_percent/100) * 1.08,
    date(s.started_at, '+60 days'),
    datetime(s.started_at, '+' || (abs(random() % 25) + 31) || ' days'),
    CASE WHEN s.id % 3 <> 0 THEN 'credit_card' ELSE 'bank_transfer' END,
    datetime(s.started_at, '+30 days')
FROM subscriptions s;

-- Third invoice (pending)
INSERT INTO invoices (organization_id, subscription_id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, payment_method, created_at)
SELECT
    s.organization_id,
    s.id,
    'INV-' || (10002 + (s.id * 3)),
    'pending',
    s.current_price * (1 - s.discount_percent/100),
    s.current_price * 0.08,
    s.current_price * (1 - s.discount_percent/100) * 1.08,
    date('now', '+15 days'),
    NULL,
    NULL,
    datetime(s.started_at, '+60 days')
FROM subscriptions s;

-- Add line items for invoices
INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
SELECT
    i.id,
    'CloudMetrics ' || p.name || ' Plan - ' || s.billing_cycle,
    1,
    s.current_price * (1 - s.discount_percent/100),
    s.current_price * (1 - s.discount_percent/100)
FROM invoices i
JOIN subscriptions s ON i.subscription_id = s.id
JOIN products p ON s.product_id = p.id;

-- Generate usage events (using a recursive CTE to generate multiple rows per user)
WITH RECURSIVE counter(n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM counter WHERE n < 20
),
event_types(idx, name) AS (
    SELECT 1, 'login' UNION ALL
    SELECT 2, 'report_view' UNION ALL
    SELECT 3, 'export' UNION ALL
    SELECT 4, 'api_call' UNION ALL
    SELECT 5, 'query_run' UNION ALL
    SELECT 6, 'dashboard_view' UNION ALL
    SELECT 7, 'data_import'
)
INSERT INTO usage_events (organization_id, user_id, event_type, data_processed_mb, duration_ms, created_at)
SELECT
    u.organization_id,
    u.id,
    (SELECT name FROM event_types WHERE idx = (abs(random()) % 7 + 1)),
    round((abs(random()) % 10000) / 100.0, 2),
    abs(random() % 5000) + 100,
    datetime('now', '-' || (abs(random() % 90)) || ' days')
FROM users u, counter
WHERE u.is_active = 1;

-- Generate support tickets (2 per organization)
-- First ticket (may be resolved)
INSERT INTO support_tickets (organization_id, created_by, category_id, priority_id, subject, description, status, first_response_at, resolved_at, satisfaction_rating, created_at)
SELECT
    o.id,
    (SELECT u.id FROM users u WHERE u.organization_id = o.id LIMIT 1),
    (abs(random() % 6) + 1),
    (abs(random() % 4) + 1),
    CASE abs(random() % 10)
        WHEN 0 THEN 'Cannot access dashboard'
        WHEN 1 THEN 'Export feature not working'
        WHEN 2 THEN 'Need help with API integration'
        WHEN 3 THEN 'Billing question about last invoice'
        WHEN 4 THEN 'Request for custom report template'
        WHEN 5 THEN 'Data sync issue with warehouse'
        WHEN 6 THEN 'SSO configuration help needed'
        WHEN 7 THEN 'Performance issues with large datasets'
        WHEN 8 THEN 'Feature request: scheduled reports'
        ELSE 'General inquiry about product features'
    END,
    'Detailed description of the issue or request. Customer needs assistance with their CloudMetrics implementation.',
    CASE abs(random() % 4)
        WHEN 0 THEN 'open'
        WHEN 1 THEN 'in_progress'
        WHEN 2 THEN 'resolved'
        ELSE 'closed'
    END,
    datetime('now', '-' || (abs(random() % 170)) || ' days'),
    datetime('now', '-' || (abs(random() % 165)) || ' days'),
    (abs(random() % 2) + 4),
    datetime('now', '-' || (abs(random() % 180)) || ' days')
FROM organizations o;

-- Second ticket (open)
INSERT INTO support_tickets (organization_id, created_by, category_id, priority_id, subject, description, status, created_at)
SELECT
    o.id,
    (SELECT u.id FROM users u WHERE u.organization_id = o.id LIMIT 1),
    (abs(random() % 6) + 1),
    (abs(random() % 4) + 1),
    CASE abs(random() % 10)
        WHEN 0 THEN 'Cannot access dashboard'
        WHEN 1 THEN 'Export feature not working'
        WHEN 2 THEN 'Need help with API integration'
        WHEN 3 THEN 'Billing question about last invoice'
        WHEN 4 THEN 'Request for custom report template'
        WHEN 5 THEN 'Data sync issue with warehouse'
        WHEN 6 THEN 'SSO configuration help needed'
        WHEN 7 THEN 'Performance issues with large datasets'
        WHEN 8 THEN 'Feature request: scheduled reports'
        ELSE 'General inquiry about product features'
    END,
    'Detailed description of the issue or request. Customer needs assistance with their CloudMetrics implementation.',
    'open',
    datetime('now', '-' || (abs(random() % 30)) || ' days')
FROM organizations o;

-- Generate subscription history for some subscriptions
INSERT INTO subscription_history (subscription_id, previous_product_id, new_product_id, change_type, change_reason, changed_at)
SELECT
    s.id,
    s.product_id - 1,
    s.product_id,
    'upgrade',
    'Customer upgraded due to team growth',
    datetime(s.started_at, '+' || (abs(random() % 180)) || ' days')
FROM subscriptions s
WHERE s.status = 'active' AND s.product_id > 1
ORDER BY random()
LIMIT 20;

-- ============================================================================
-- CREATE HELPFUL VIEWS
-- ============================================================================

-- Monthly Revenue View
CREATE VIEW monthly_revenue AS
SELECT
    strftime('%Y-%m-01', i.created_at) as month,
    COUNT(DISTINCT i.organization_id) as customer_count,
    SUM(i.total) as total_revenue,
    AVG(i.total) as avg_invoice_amount
FROM invoices i
WHERE i.status = 'paid'
GROUP BY strftime('%Y-%m-01', i.created_at)
ORDER BY month;

-- Customer Health Score View
CREATE VIEW customer_health AS
SELECT
    o.id as organization_id,
    o.name as organization_name,
    p.name as product_name,
    s.status as subscription_status,
    COUNT(DISTINCT ue.id) as usage_events_30d,
    COUNT(DISTINCT st.id) as open_tickets,
    MAX(u.last_login_at) as last_activity
FROM organizations o
JOIN subscriptions s ON o.id = s.organization_id
JOIN products p ON s.product_id = p.id
LEFT JOIN usage_events ue ON o.id = ue.organization_id AND ue.created_at > datetime('now', '-30 days')
LEFT JOIN support_tickets st ON o.id = st.organization_id AND st.status IN ('open', 'in_progress')
LEFT JOIN users u ON o.id = u.organization_id
GROUP BY o.id, o.name, p.name, s.status;

-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

SELECT 'Database created successfully!' as status;
SELECT 'Organizations: ' || COUNT(*) as info FROM organizations;
SELECT 'Users: ' || COUNT(*) as info FROM users;
SELECT 'Subscriptions: ' || COUNT(*) as info FROM subscriptions;
SELECT 'Invoices: ' || COUNT(*) as info FROM invoices;
SELECT 'Usage Events: ' || COUNT(*) as info FROM usage_events;
SELECT 'Support Tickets: ' || COUNT(*) as info FROM support_tickets;
