-- DataQuery Pro Demo Database
-- A comprehensive SaaS company database for demonstrating analytics capabilities
-- Company: "CloudMetrics Inc." - A fictional B2B analytics platform

-- ============================================================================
-- CLEANUP (Drop tables if they exist)
-- ============================================================================
DROP TABLE IF EXISTS support_ticket_comments CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS invoice_line_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS usage_events CASCADE;
DROP TABLE IF EXISTS subscription_history CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS product_features CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS feature_flags CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS industries CASCADE;
DROP TABLE IF EXISTS ticket_categories CASCADE;
DROP TABLE IF EXISTS ticket_priorities CASCADE;

-- ============================================================================
-- LOOKUP/REFERENCE TABLES
-- ============================================================================

-- Regions for geographic analysis
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE,
    timezone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO regions (name, code, timezone) VALUES
('North America', 'NA', 'America/New_York'),
('Europe', 'EU', 'Europe/London'),
('Asia Pacific', 'APAC', 'Asia/Singapore'),
('Latin America', 'LATAM', 'America/Sao_Paulo'),
('Middle East & Africa', 'MEA', 'Asia/Dubai');

-- Industries for customer segmentation
CREATE TABLE industries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    sla_hours INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    monthly_price DECIMAL(10, 2) NOT NULL,
    annual_price DECIMAL(10, 2) NOT NULL,
    max_users INTEGER,
    max_data_gb INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, code, description, monthly_price, annual_price, max_users, max_data_gb) VALUES
('Starter', 'STARTER', 'Perfect for small teams getting started with analytics', 29.00, 290.00, 5, 10),
('Professional', 'PRO', 'Advanced features for growing businesses', 99.00, 990.00, 25, 100),
('Business', 'BIZ', 'Full-featured solution for established companies', 249.00, 2490.00, 100, 500),
('Enterprise', 'ENT', 'Custom solution for large organizations', 599.00, 5990.00, NULL, NULL);

-- Feature flags available in products
CREATE TABLE feature_flags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    feature_id INTEGER NOT NULL REFERENCES feature_flags(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, feature_id)
);

-- Starter features
INSERT INTO product_features (product_id, feature_id) VALUES
(1, 5); -- Advanced Exports

-- Professional features
INSERT INTO product_features (product_id, feature_id) VALUES
(2, 1), (2, 5), (2, 3); -- Realtime, Advanced Exports, API

-- Business features
INSERT INTO product_features (product_id, feature_id) VALUES
(3, 1), (3, 2), (3, 3), (3, 5), (3, 9), (3, 10); -- Most features

-- Enterprise features (all)
INSERT INTO product_features (product_id, feature_id) VALUES
(4, 1), (4, 2), (4, 3), (4, 4), (4, 5), (4, 6), (4, 7), (4, 8), (4, 9), (4, 10);

-- ============================================================================
-- ORGANIZATIONS AND TEAMS
-- ============================================================================

CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    domain VARCHAR(100),
    industry_id INTEGER REFERENCES industries(id),
    region_id INTEGER REFERENCES regions(id),
    employee_count INTEGER,
    annual_revenue DECIMAL(15, 2),
    website VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    team_id INTEGER REFERENCES teams(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(100),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role_name VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id)
);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, cancelled, paused, trial
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly, annual
    current_price DECIMAL(10, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    trial_ends_at TIMESTAMP,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    next_billing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscription_history (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
    previous_product_id INTEGER REFERENCES products(id),
    new_product_id INTEGER REFERENCES products(id),
    change_type VARCHAR(50) NOT NULL, -- upgrade, downgrade, cancel, reactivate
    change_reason TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by INTEGER REFERENCES users(id)
);

-- ============================================================================
-- INVOICES
-- ============================================================================

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    subscription_id INTEGER REFERENCES subscriptions(id),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    due_date DATE NOT NULL,
    paid_at TIMESTAMP,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    description VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- USAGE TRACKING
-- ============================================================================

CREATE TABLE usage_events (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL, -- login, report_view, export, api_call, query_run
    event_data JSONB,
    data_processed_mb DECIMAL(10, 2),
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries on usage_events
CREATE INDEX idx_usage_events_org_date ON usage_events(organization_id, created_at);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);

-- ============================================================================
-- SUPPORT TICKETS
-- ============================================================================

CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    category_id INTEGER NOT NULL REFERENCES ticket_categories(id),
    priority_id INTEGER NOT NULL REFERENCES ticket_priorities(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, in_progress, waiting, resolved, closed
    resolution TEXT,
    first_response_at TIMESTAMP,
    resolved_at TIMESTAMP,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE support_ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- GENERATE DEMO DATA
-- ============================================================================

-- Generate 50 organizations across different industries and regions
INSERT INTO organizations (name, domain, industry_id, region_id, employee_count, annual_revenue, website, created_at)
SELECT
    company_name,
    LOWER(REPLACE(company_name, ' ', '')) || '.com',
    (random() * 7 + 1)::int,
    (random() * 4 + 1)::int,
    (random() * 9900 + 100)::int,
    (random() * 99000000 + 1000000)::decimal(15,2),
    'https://www.' || LOWER(REPLACE(company_name, ' ', '')) || '.com',
    CURRENT_TIMESTAMP - (random() * 730 || ' days')::interval
FROM (
    VALUES
    ('Nexus Technologies'), ('Quantum Dynamics'), ('Stellar Innovations'), ('Peak Performance Co'),
    ('Blue Ocean Ventures'), ('Summit Analytics'), ('Horizon Labs'), ('Velocity Systems'),
    ('Apex Solutions'), ('Pinnacle Group'), ('Aurora Digital'), ('Zenith Corp'),
    ('Vanguard Tech'), ('Phoenix Industries'), ('Catalyst Partners'), ('Momentum Inc'),
    ('Synergy Solutions'), ('Elevate Digital'), ('Precision Systems'), ('Vector Analytics'),
    ('Nova Enterprises'), ('Atlas Corporation'), ('Frontier Tech'), ('Pulse Digital'),
    ('Core Dynamics'), ('Fusion Labs'), ('Impact Solutions'), ('Matrix Systems'),
    ('Orbit Technologies'), ('Prism Analytics'), ('Spark Innovations'), ('Titan Corp'),
    ('Unity Digital'), ('Wave Technologies'), ('Xcel Partners'), ('Zephyr Systems'),
    ('Alpha Ventures'), ('Beta Solutions'), ('Delta Corp'), ('Gamma Industries'),
    ('Omega Tech'), ('Sigma Partners'), ('Theta Labs'), ('Lambda Systems'),
    ('Epsilon Digital'), ('Kappa Innovations'), ('Rho Analytics'), ('Tau Corporation'),
    ('Upsilon Tech'), ('Iota Solutions')
) AS t(company_name);

-- Generate teams for each organization (2-5 teams per org)
INSERT INTO teams (organization_id, name, description, created_at)
SELECT
    o.id,
    team_name,
    'Team responsible for ' || LOWER(team_name),
    o.created_at + (random() * 30 || ' days')::interval
FROM organizations o
CROSS JOIN (
    VALUES ('Engineering'), ('Marketing'), ('Sales'), ('Analytics'), ('Operations')
) AS t(team_name)
WHERE random() > 0.3;

-- Generate users (3-20 per organization)
DO $$
DECLARE
    org RECORD;
    team RECORD;
    user_count INTEGER;
    i INTEGER;
    first_names TEXT[] := ARRAY['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
                                 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
                                 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
                                 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
                                 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle'];
    last_names TEXT[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
                                'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
                                'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
                                'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young'];
    titles TEXT[] := ARRAY['Analyst', 'Manager', 'Director', 'VP', 'Engineer', 'Specialist', 'Coordinator', 'Lead'];
BEGIN
    FOR org IN SELECT * FROM organizations LOOP
        user_count := floor(random() * 18 + 3)::int;
        FOR i IN 1..user_count LOOP
            SELECT * INTO team FROM teams WHERE organization_id = org.id ORDER BY random() LIMIT 1;
            INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
            VALUES (
                org.id,
                team.id,
                LOWER(first_names[floor(random() * 40 + 1)::int] || '.' || last_names[floor(random() * 32 + 1)::int] || i || '@' || org.domain),
                first_names[floor(random() * 40 + 1)::int],
                last_names[floor(random() * 32 + 1)::int],
                titles[floor(random() * 8 + 1)::int],
                i = 1, -- First user is admin
                floor(random() * 500)::int,
                CURRENT_TIMESTAMP - (random() * 30 || ' days')::interval,
                org.created_at + (random() * 60 || ' days')::interval
            );
        END LOOP;
    END LOOP;
END $$;

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
    CASE WHEN random() > 0.1 THEN 'active' ELSE 'cancelled' END,
    CASE WHEN random() > 0.4 THEN 'annual' ELSE 'monthly' END,
    CASE
        WHEN o.employee_count < 50 THEN 29.00
        WHEN o.employee_count < 200 THEN 99.00
        WHEN o.employee_count < 1000 THEN 249.00
        ELSE 599.00
    END,
    CASE WHEN random() > 0.7 THEN floor(random() * 20 + 5)::decimal ELSE 0 END,
    o.created_at + (random() * 30 || ' days')::interval,
    CURRENT_DATE + (random() * 30 || ' days')::interval
FROM organizations o;

-- Generate invoices (12-24 months of history per organization)
DO $$
DECLARE
    sub RECORD;
    invoice_date DATE;
    invoice_num INTEGER := 10000;
BEGIN
    FOR sub IN SELECT s.*, o.name as org_name FROM subscriptions s JOIN organizations o ON s.organization_id = o.id LOOP
        invoice_date := sub.started_at::date;
        WHILE invoice_date < CURRENT_DATE LOOP
            invoice_num := invoice_num + 1;
            INSERT INTO invoices (organization_id, subscription_id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, payment_method, created_at)
            VALUES (
                sub.organization_id,
                sub.id,
                'INV-' || invoice_num,
                CASE WHEN invoice_date < CURRENT_DATE - 30 THEN 'paid' ELSE 'pending' END,
                sub.current_price * (1 - sub.discount_percent/100),
                sub.current_price * 0.08,
                sub.current_price * (1 - sub.discount_percent/100) * 1.08,
                invoice_date + 30,
                CASE WHEN invoice_date < CURRENT_DATE - 30 THEN (invoice_date + floor(random() * 25 + 1)::int)::timestamp ELSE NULL END,
                CASE WHEN random() > 0.3 THEN 'credit_card' ELSE 'bank_transfer' END,
                invoice_date::timestamp
            );

            -- Add line items
            INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
            VALUES (
                currval('invoices_id_seq'),
                'CloudMetrics ' || (SELECT name FROM products WHERE id = sub.product_id) || ' Plan - ' || sub.billing_cycle,
                1,
                sub.current_price * (1 - sub.discount_percent/100),
                sub.current_price * (1 - sub.discount_percent/100)
            );

            invoice_date := invoice_date + CASE WHEN sub.billing_cycle = 'monthly' THEN 30 ELSE 365 END;
        END LOOP;
    END LOOP;
END $$;

-- Generate usage events (heavy data - lots of activity)
-- Using a simpler set-based approach for reliability
INSERT INTO usage_events (organization_id, user_id, event_type, data_processed_mb, duration_ms, created_at)
SELECT
    u.organization_id,
    u.id,
    (ARRAY['login', 'report_view', 'export', 'api_call', 'query_run', 'dashboard_view', 'data_import'])[floor(random() * 7 + 1)::int],
    (random() * 100)::decimal(10,2),
    floor(random() * 5000 + 100)::int,
    CURRENT_TIMESTAMP - (random() * 90 || ' days')::interval
FROM users u
CROSS JOIN generate_series(1, 50) as g
WHERE u.is_active = true;

-- Generate support tickets
DO $$
DECLARE
    org RECORD;
    usr RECORD;
    ticket_count INTEGER;
    i INTEGER;
    created_date TIMESTAMP;
    ticket_status TEXT;
BEGIN
    FOR org IN SELECT * FROM organizations LOOP
        SELECT * INTO usr FROM users WHERE organization_id = org.id ORDER BY random() LIMIT 1;
        ticket_count := floor(random() * 15 + 1)::int;

        FOR i IN 1..ticket_count LOOP
            created_date := CURRENT_TIMESTAMP - (random() * 180 || ' days')::interval;
            ticket_status := CASE
                WHEN random() > 0.8 THEN 'open'
                WHEN random() > 0.6 THEN 'in_progress'
                WHEN random() > 0.3 THEN 'resolved'
                ELSE 'closed'
            END;

            INSERT INTO support_tickets (
                organization_id, created_by, category_id, priority_id,
                subject, description, status,
                first_response_at, resolved_at, satisfaction_rating, created_at
            )
            VALUES (
                org.id,
                usr.id,
                floor(random() * 6 + 1)::int,
                floor(random() * 4 + 1)::int,
                CASE floor(random() * 10)::int
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
                ticket_status,
                CASE WHEN ticket_status != 'open' THEN created_date + (random() * 4 || ' hours')::interval ELSE NULL END,
                CASE WHEN ticket_status IN ('resolved', 'closed') THEN created_date + (random() * 72 || ' hours')::interval ELSE NULL END,
                CASE WHEN ticket_status IN ('resolved', 'closed') THEN floor(random() * 2 + 4)::int ELSE NULL END,
                created_date
            );
        END LOOP;
    END LOOP;
END $$;

-- Generate subscription history (upgrades/downgrades)
DO $$
DECLARE
    sub RECORD;
BEGIN
    FOR sub IN SELECT * FROM subscriptions WHERE status = 'active' AND product_id > 1 ORDER BY random() LIMIT 20 LOOP
        INSERT INTO subscription_history (subscription_id, previous_product_id, new_product_id, change_type, change_reason, changed_at)
        VALUES (
            sub.id,
            sub.product_id - 1,
            sub.product_id,
            'upgrade',
            'Customer upgraded due to team growth',
            sub.started_at + (random() * 180 || ' days')::interval
        );
    END LOOP;
END $$;

-- ============================================================================
-- CREATE HELPFUL VIEWS
-- ============================================================================

-- Monthly Revenue View
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
    DATE_TRUNC('month', i.created_at) as month,
    COUNT(DISTINCT i.organization_id) as customer_count,
    SUM(i.total) as total_revenue,
    AVG(i.total) as avg_invoice_amount
FROM invoices i
WHERE i.status = 'paid'
GROUP BY DATE_TRUNC('month', i.created_at)
ORDER BY month;

-- Customer Health Score View
CREATE OR REPLACE VIEW customer_health AS
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
LEFT JOIN usage_events ue ON o.id = ue.organization_id AND ue.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
LEFT JOIN support_tickets st ON o.id = st.organization_id AND st.status IN ('open', 'in_progress')
LEFT JOIN users u ON o.id = u.organization_id
GROUP BY o.id, o.name, p.name, s.status;

-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

SELECT 'Database created successfully!' as status;
SELECT 'Organizations: ' || COUNT(*) FROM organizations;
SELECT 'Users: ' || COUNT(*) FROM users;
SELECT 'Subscriptions: ' || COUNT(*) FROM subscriptions;
SELECT 'Invoices: ' || COUNT(*) FROM invoices;
SELECT 'Usage Events: ' || COUNT(*) FROM usage_events;
SELECT 'Support Tickets: ' || COUNT(*) FROM support_tickets;
