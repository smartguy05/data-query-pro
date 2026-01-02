-- DataQuery Pro Demo Database (MySQL Version)
-- A comprehensive SaaS company database for demonstrating analytics capabilities
-- Company: "CloudMetrics Inc." - A fictional B2B analytics platform

-- ============================================================================
-- CLEANUP (Drop tables if they exist)
-- ============================================================================
SET FOREIGN_KEY_CHECKS = 0;

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

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- LOOKUP/REFERENCE TABLES
-- ============================================================================

-- Regions for geographic analysis
CREATE TABLE regions (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    sla_hours INT NOT NULL,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    monthly_price DECIMAL(10, 2) NOT NULL,
    annual_price DECIMAL(10, 2) NOT NULL,
    max_users INT,
    max_data_gb INT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO products (name, code, description, monthly_price, annual_price, max_users, max_data_gb) VALUES
('Starter', 'STARTER', 'Perfect for small teams getting started with analytics', 29.00, 290.00, 5, 10),
('Professional', 'PRO', 'Advanced features for growing businesses', 99.00, 990.00, 25, 100),
('Business', 'BIZ', 'Full-featured solution for established companies', 249.00, 2490.00, 100, 500),
('Enterprise', 'ENT', 'Custom solution for large organizations', 599.00, 5990.00, NULL, NULL);

-- Feature flags available in products
CREATE TABLE feature_flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    feature_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_product_feature (product_id, feature_id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (feature_id) REFERENCES feature_flags(id)
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    domain VARCHAR(100),
    industry_id INT,
    region_id INT,
    employee_count INT,
    annual_revenue DECIMAL(15, 2),
    website VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (industry_id) REFERENCES industries(id),
    FOREIGN KEY (region_id) REFERENCES regions(id)
);

CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    team_id INT,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(100),
    phone VARCHAR(50),
    is_active TINYINT(1) DEFAULT 1,
    is_admin TINYINT(1) DEFAULT 0,
    last_login_at TIMESTAMP NULL,
    login_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE TABLE user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    product_id INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    current_price DECIMAL(10, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    trial_ends_at TIMESTAMP NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP NULL,
    next_billing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE subscription_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT NOT NULL,
    previous_product_id INT,
    new_product_id INT,
    change_type VARCHAR(50) NOT NULL,
    change_reason TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by INT,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    FOREIGN KEY (previous_product_id) REFERENCES products(id),
    FOREIGN KEY (new_product_id) REFERENCES products(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- ============================================================================
-- INVOICES
-- ============================================================================

CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    subscription_id INT,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    due_date DATE NOT NULL,
    paid_at TIMESTAMP NULL,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE TABLE invoice_line_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- ============================================================================
-- USAGE TRACKING
-- ============================================================================

CREATE TABLE usage_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    user_id INT,
    event_type VARCHAR(50) NOT NULL,
    event_data JSON,
    data_processed_mb DECIMAL(10, 2),
    duration_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for faster queries on usage_events
CREATE INDEX idx_usage_events_org_date ON usage_events(organization_id, created_at);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);

-- ============================================================================
-- SUPPORT TICKETS
-- ============================================================================

CREATE TABLE support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    created_by INT NOT NULL,
    assigned_to INT,
    category_id INT NOT NULL,
    priority_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    resolution TEXT,
    first_response_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    satisfaction_rating INT CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES ticket_categories(id),
    FOREIGN KEY (priority_id) REFERENCES ticket_priorities(id)
);

CREATE TABLE support_ticket_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    is_internal TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================================
-- GENERATE DEMO DATA
-- ============================================================================

-- Generate 50 organizations across different industries and regions
INSERT INTO organizations (name, domain, industry_id, region_id, employee_count, annual_revenue, website, created_at)
VALUES
('Nexus Technologies', 'nexustechnologies.com', 1, 1, 450, 15000000.00, 'https://www.nexustechnologies.com', DATE_SUB(NOW(), INTERVAL 400 DAY)),
('Quantum Dynamics', 'quantumdynamics.com', 1, 2, 820, 28000000.00, 'https://www.quantumdynamics.com', DATE_SUB(NOW(), INTERVAL 380 DAY)),
('Stellar Innovations', 'stellarinnovations.com', 1, 3, 150, 5000000.00, 'https://www.stellarinnovations.com', DATE_SUB(NOW(), INTERVAL 360 DAY)),
('Peak Performance Co', 'peakperformanceco.com', 2, 1, 1200, 45000000.00, 'https://www.peakperformanceco.com', DATE_SUB(NOW(), INTERVAL 340 DAY)),
('Blue Ocean Ventures', 'blueoceanventures.com', 3, 2, 380, 22000000.00, 'https://www.blueoceanventures.com', DATE_SUB(NOW(), INTERVAL 320 DAY)),
('Summit Analytics', 'summitanalytics.com', 1, 1, 95, 3500000.00, 'https://www.summitanalytics.com', DATE_SUB(NOW(), INTERVAL 300 DAY)),
('Horizon Labs', 'horizonlabs.com', 2, 3, 620, 18000000.00, 'https://www.horizonlabs.com', DATE_SUB(NOW(), INTERVAL 280 DAY)),
('Velocity Systems', 'velocitysystems.com', 1, 4, 210, 8000000.00, 'https://www.velocitysystems.com', DATE_SUB(NOW(), INTERVAL 260 DAY)),
('Apex Solutions', 'apexsolutions.com', 8, 1, 45, 2200000.00, 'https://www.apexsolutions.com', DATE_SUB(NOW(), INTERVAL 240 DAY)),
('Pinnacle Group', 'pinnaclegroup.com', 3, 2, 1800, 75000000.00, 'https://www.pinnaclegroup.com', DATE_SUB(NOW(), INTERVAL 220 DAY)),
('Aurora Digital', 'auroradigital.com', 7, 1, 280, 12000000.00, 'https://www.auroradigital.com', DATE_SUB(NOW(), INTERVAL 200 DAY)),
('Zenith Corp', 'zenithcorp.com', 5, 3, 3200, 120000000.00, 'https://www.zenithcorp.com', DATE_SUB(NOW(), INTERVAL 180 DAY)),
('Vanguard Tech', 'vanguardtech.com', 1, 1, 520, 19000000.00, 'https://www.vanguardtech.com', DATE_SUB(NOW(), INTERVAL 160 DAY)),
('Phoenix Industries', 'phoenixindustries.com', 5, 4, 890, 35000000.00, 'https://www.phoenixindustries.com', DATE_SUB(NOW(), INTERVAL 140 DAY)),
('Catalyst Partners', 'catalystpartners.com', 8, 2, 120, 6500000.00, 'https://www.catalystpartners.com', DATE_SUB(NOW(), INTERVAL 120 DAY)),
('Momentum Inc', 'momentuminc.com', 4, 1, 450, 25000000.00, 'https://www.momentuminc.com', DATE_SUB(NOW(), INTERVAL 100 DAY)),
('Synergy Solutions', 'synergysolutions.com', 1, 5, 180, 7000000.00, 'https://www.synergysolutions.com', DATE_SUB(NOW(), INTERVAL 80 DAY)),
('Elevate Digital', 'elevatedigital.com', 7, 1, 95, 4200000.00, 'https://www.elevatedigital.com', DATE_SUB(NOW(), INTERVAL 60 DAY)),
('Precision Systems', 'precisionsystems.com', 5, 2, 1500, 55000000.00, 'https://www.precisionsystems.com', DATE_SUB(NOW(), INTERVAL 40 DAY)),
('Vector Analytics', 'vectoranalytics.com', 1, 3, 75, 2800000.00, 'https://www.vectoranalytics.com', DATE_SUB(NOW(), INTERVAL 20 DAY)),
('Nova Enterprises', 'novaenterprises.com', 4, 1, 680, 28000000.00, 'https://www.novaenterprises.com', DATE_SUB(NOW(), INTERVAL 350 DAY)),
('Atlas Corporation', 'atlascorporation.com', 5, 2, 2400, 95000000.00, 'https://www.atlascorporation.com', DATE_SUB(NOW(), INTERVAL 330 DAY)),
('Frontier Tech', 'frontiertech.com', 1, 4, 320, 11000000.00, 'https://www.frontiertech.com', DATE_SUB(NOW(), INTERVAL 310 DAY)),
('Pulse Digital', 'pulsedigital.com', 7, 1, 140, 5500000.00, 'https://www.pulsedigital.com', DATE_SUB(NOW(), INTERVAL 290 DAY)),
('Core Dynamics', 'coredynamics.com', 1, 3, 410, 16000000.00, 'https://www.coredynamics.com', DATE_SUB(NOW(), INTERVAL 270 DAY)),
('Fusion Labs', 'fusionlabs.com', 2, 2, 560, 21000000.00, 'https://www.fusionlabs.com', DATE_SUB(NOW(), INTERVAL 250 DAY)),
('Impact Solutions', 'impactsolutions.com', 8, 1, 85, 3800000.00, 'https://www.impactsolutions.com', DATE_SUB(NOW(), INTERVAL 230 DAY)),
('Matrix Systems', 'matrixsystems.com', 1, 5, 720, 27000000.00, 'https://www.matrixsystems.com', DATE_SUB(NOW(), INTERVAL 210 DAY)),
('Orbit Technologies', 'orbittechnologies.com', 1, 1, 190, 7500000.00, 'https://www.orbittechnologies.com', DATE_SUB(NOW(), INTERVAL 190 DAY)),
('Prism Analytics', 'prismanalytics.com', 1, 2, 65, 2400000.00, 'https://www.prismanalytics.com', DATE_SUB(NOW(), INTERVAL 170 DAY)),
('Spark Innovations', 'sparkinnovations.com', 1, 3, 230, 9000000.00, 'https://www.sparkinnovations.com', DATE_SUB(NOW(), INTERVAL 150 DAY)),
('Titan Corp', 'titancorp.com', 5, 4, 4500, 180000000.00, 'https://www.titancorp.com', DATE_SUB(NOW(), INTERVAL 130 DAY)),
('Unity Digital', 'unitydigital.com', 7, 1, 175, 6800000.00, 'https://www.unitydigital.com', DATE_SUB(NOW(), INTERVAL 110 DAY)),
('Wave Technologies', 'wavetechnologies.com', 1, 2, 340, 13000000.00, 'https://www.wavetechnologies.com', DATE_SUB(NOW(), INTERVAL 90 DAY)),
('Xcel Partners', 'xcelpartners.com', 8, 1, 55, 2900000.00, 'https://www.xcelpartners.com', DATE_SUB(NOW(), INTERVAL 70 DAY)),
('Zephyr Systems', 'zephyrsystems.com', 1, 5, 480, 18500000.00, 'https://www.zephyrsystems.com', DATE_SUB(NOW(), INTERVAL 50 DAY)),
('Alpha Ventures', 'alphaventures.com', 3, 1, 920, 42000000.00, 'https://www.alphaventures.com', DATE_SUB(NOW(), INTERVAL 30 DAY)),
('Beta Solutions', 'betasolutions.com', 1, 2, 135, 5200000.00, 'https://www.betasolutions.com', DATE_SUB(NOW(), INTERVAL 10 DAY)),
('Delta Corp', 'deltacorp.com', 5, 3, 1100, 48000000.00, 'https://www.deltacorp.com', DATE_SUB(NOW(), INTERVAL 365 DAY)),
('Gamma Industries', 'gammaindustries.com', 5, 4, 2800, 110000000.00, 'https://www.gammaindustries.com', DATE_SUB(NOW(), INTERVAL 345 DAY)),
('Omega Tech', 'omegatech.com', 1, 1, 395, 15500000.00, 'https://www.omegatech.com', DATE_SUB(NOW(), INTERVAL 325 DAY)),
('Sigma Partners', 'sigmapartners.com', 8, 2, 70, 3200000.00, 'https://www.sigmapartners.com', DATE_SUB(NOW(), INTERVAL 305 DAY)),
('Theta Labs', 'thetalabs.com', 2, 3, 445, 17000000.00, 'https://www.thetalabs.com', DATE_SUB(NOW(), INTERVAL 285 DAY)),
('Lambda Systems', 'lambdasystems.com', 1, 1, 260, 10000000.00, 'https://www.lambdasystems.com', DATE_SUB(NOW(), INTERVAL 265 DAY)),
('Epsilon Digital', 'epsilondigital.com', 7, 5, 110, 4500000.00, 'https://www.epsilondigital.com', DATE_SUB(NOW(), INTERVAL 245 DAY)),
('Kappa Innovations', 'kappainnovations.com', 1, 2, 185, 7200000.00, 'https://www.kappainnovations.com', DATE_SUB(NOW(), INTERVAL 225 DAY)),
('Rho Analytics', 'rhoanalytics.com', 1, 1, 50, 1900000.00, 'https://www.rhoanalytics.com', DATE_SUB(NOW(), INTERVAL 205 DAY)),
('Tau Corporation', 'taucorporation.com', 3, 3, 1350, 58000000.00, 'https://www.taucorporation.com', DATE_SUB(NOW(), INTERVAL 185 DAY)),
('Upsilon Tech', 'upsilontech.com', 1, 4, 305, 12500000.00, 'https://www.upsilontech.com', DATE_SUB(NOW(), INTERVAL 165 DAY)),
('Iota Solutions', 'iotasolutions.com', 8, 1, 40, 1800000.00, 'https://www.iotasolutions.com', DATE_SUB(NOW(), INTERVAL 145 DAY));

-- Generate teams for each organization
INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Engineering', 'Team responsible for engineering', DATE_ADD(o.created_at, INTERVAL 5 DAY)
FROM organizations o;

INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Marketing', 'Team responsible for marketing', DATE_ADD(o.created_at, INTERVAL 10 DAY)
FROM organizations o WHERE RAND() > 0.3;

INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Sales', 'Team responsible for sales', DATE_ADD(o.created_at, INTERVAL 15 DAY)
FROM organizations o WHERE RAND() > 0.4;

INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Analytics', 'Team responsible for analytics', DATE_ADD(o.created_at, INTERVAL 20 DAY)
FROM organizations o WHERE RAND() > 0.5;

INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Operations', 'Team responsible for operations', DATE_ADD(o.created_at, INTERVAL 25 DAY)
FROM organizations o WHERE RAND() > 0.6;

-- Generate users for organizations (simplified - 5 users per org)
INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id ORDER BY RAND() LIMIT 1),
    CONCAT('admin@', o.domain),
    'Admin',
    'User',
    'Administrator',
    1,
    FLOOR(RAND() * 500),
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY),
    DATE_ADD(o.created_at, INTERVAL 1 DAY)
FROM organizations o;

INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id ORDER BY RAND() LIMIT 1),
    CONCAT('james.smith@', o.domain),
    'James',
    'Smith',
    'Manager',
    0,
    FLOOR(RAND() * 300),
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY),
    DATE_ADD(o.created_at, INTERVAL 5 DAY)
FROM organizations o;

INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id ORDER BY RAND() LIMIT 1),
    CONCAT('mary.johnson@', o.domain),
    'Mary',
    'Johnson',
    'Analyst',
    0,
    FLOOR(RAND() * 200),
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY),
    DATE_ADD(o.created_at, INTERVAL 10 DAY)
FROM organizations o;

INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id ORDER BY RAND() LIMIT 1),
    CONCAT('robert.williams@', o.domain),
    'Robert',
    'Williams',
    'Engineer',
    0,
    FLOOR(RAND() * 250),
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY),
    DATE_ADD(o.created_at, INTERVAL 15 DAY)
FROM organizations o;

INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT t.id FROM teams t WHERE t.organization_id = o.id ORDER BY RAND() LIMIT 1),
    CONCAT('patricia.brown@', o.domain),
    'Patricia',
    'Brown',
    'Specialist',
    0,
    FLOOR(RAND() * 150),
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY),
    DATE_ADD(o.created_at, INTERVAL 20 DAY)
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
    CASE WHEN RAND() > 0.1 THEN 'active' ELSE 'cancelled' END,
    CASE WHEN RAND() > 0.4 THEN 'annual' ELSE 'monthly' END,
    CASE
        WHEN o.employee_count < 50 THEN 29.00
        WHEN o.employee_count < 200 THEN 99.00
        WHEN o.employee_count < 1000 THEN 249.00
        ELSE 599.00
    END,
    CASE WHEN RAND() > 0.7 THEN FLOOR(RAND() * 20 + 5) ELSE 0 END,
    DATE_ADD(o.created_at, INTERVAL FLOOR(RAND() * 30) DAY),
    DATE_ADD(NOW(), INTERVAL FLOOR(RAND() * 30) DAY)
FROM organizations o;

-- Generate invoices (simplified - 3 invoices per subscription)
INSERT INTO invoices (organization_id, subscription_id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, payment_method, created_at)
SELECT
    s.organization_id,
    s.id,
    CONCAT('INV-', 10000 + (s.id * 3)),
    'paid',
    s.current_price * (1 - s.discount_percent/100),
    s.current_price * 0.08,
    s.current_price * (1 - s.discount_percent/100) * 1.08,
    DATE_ADD(s.started_at, INTERVAL 30 DAY),
    DATE_ADD(s.started_at, INTERVAL FLOOR(RAND() * 25 + 1) DAY),
    CASE WHEN RAND() > 0.3 THEN 'credit_card' ELSE 'bank_transfer' END,
    s.started_at
FROM subscriptions s;

INSERT INTO invoices (organization_id, subscription_id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, payment_method, created_at)
SELECT
    s.organization_id,
    s.id,
    CONCAT('INV-', 10001 + (s.id * 3)),
    'paid',
    s.current_price * (1 - s.discount_percent/100),
    s.current_price * 0.08,
    s.current_price * (1 - s.discount_percent/100) * 1.08,
    DATE_ADD(s.started_at, INTERVAL 60 DAY),
    DATE_ADD(s.started_at, INTERVAL FLOOR(RAND() * 25 + 31) DAY),
    CASE WHEN RAND() > 0.3 THEN 'credit_card' ELSE 'bank_transfer' END,
    DATE_ADD(s.started_at, INTERVAL 30 DAY)
FROM subscriptions s;

INSERT INTO invoices (organization_id, subscription_id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, payment_method, created_at)
SELECT
    s.organization_id,
    s.id,
    CONCAT('INV-', 10002 + (s.id * 3)),
    'pending',
    s.current_price * (1 - s.discount_percent/100),
    s.current_price * 0.08,
    s.current_price * (1 - s.discount_percent/100) * 1.08,
    DATE_ADD(NOW(), INTERVAL 15 DAY),
    NULL,
    NULL,
    DATE_ADD(s.started_at, INTERVAL 60 DAY)
FROM subscriptions s;

-- Add line items for invoices
INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
SELECT
    i.id,
    CONCAT('CloudMetrics ', p.name, ' Plan - ', s.billing_cycle),
    1,
    s.current_price * (1 - s.discount_percent/100),
    s.current_price * (1 - s.discount_percent/100)
FROM invoices i
JOIN subscriptions s ON i.subscription_id = s.id
JOIN products p ON s.product_id = p.id;

-- Generate usage events (simplified - 20 events per user)
INSERT INTO usage_events (organization_id, user_id, event_type, data_processed_mb, duration_ms, created_at)
SELECT
    u.organization_id,
    u.id,
    ELT(FLOOR(RAND() * 7) + 1, 'login', 'report_view', 'export', 'api_call', 'query_run', 'dashboard_view', 'data_import'),
    ROUND(RAND() * 100, 2),
    FLOOR(RAND() * 5000 + 100),
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 90) DAY)
FROM users u
CROSS JOIN (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
            UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20) AS nums
WHERE u.is_active = 1;

-- Generate support tickets (2 tickets per organization)
INSERT INTO support_tickets (organization_id, created_by, category_id, priority_id, subject, description, status, first_response_at, resolved_at, satisfaction_rating, created_at)
SELECT
    o.id,
    (SELECT u.id FROM users u WHERE u.organization_id = o.id LIMIT 1),
    FLOOR(RAND() * 6) + 1,
    FLOOR(RAND() * 4) + 1,
    ELT(FLOOR(RAND() * 10) + 1,
        'Cannot access dashboard',
        'Export feature not working',
        'Need help with API integration',
        'Billing question about last invoice',
        'Request for custom report template',
        'Data sync issue with warehouse',
        'SSO configuration help needed',
        'Performance issues with large datasets',
        'Feature request: scheduled reports',
        'General inquiry about product features'),
    'Detailed description of the issue or request. Customer needs assistance with their CloudMetrics implementation.',
    ELT(FLOOR(RAND() * 4) + 1, 'open', 'in_progress', 'resolved', 'closed'),
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 170) DAY),
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 165) DAY),
    FLOOR(RAND() * 2) + 4,
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 180) DAY)
FROM organizations o;

INSERT INTO support_tickets (organization_id, created_by, category_id, priority_id, subject, description, status, created_at)
SELECT
    o.id,
    (SELECT u.id FROM users u WHERE u.organization_id = o.id LIMIT 1),
    FLOOR(RAND() * 6) + 1,
    FLOOR(RAND() * 4) + 1,
    ELT(FLOOR(RAND() * 10) + 1,
        'Cannot access dashboard',
        'Export feature not working',
        'Need help with API integration',
        'Billing question about last invoice',
        'Request for custom report template',
        'Data sync issue with warehouse',
        'SSO configuration help needed',
        'Performance issues with large datasets',
        'Feature request: scheduled reports',
        'General inquiry about product features'),
    'Detailed description of the issue or request. Customer needs assistance with their CloudMetrics implementation.',
    'open',
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY)
FROM organizations o;

-- Generate subscription history for some subscriptions
INSERT INTO subscription_history (subscription_id, previous_product_id, new_product_id, change_type, change_reason, changed_at)
SELECT
    s.id,
    s.product_id - 1,
    s.product_id,
    'upgrade',
    'Customer upgraded due to team growth',
    DATE_ADD(s.started_at, INTERVAL FLOOR(RAND() * 180) DAY)
FROM subscriptions s
WHERE s.status = 'active' AND s.product_id > 1
ORDER BY RAND()
LIMIT 20;

-- ============================================================================
-- CREATE HELPFUL VIEWS
-- ============================================================================

-- Monthly Revenue View
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
    DATE_FORMAT(i.created_at, '%Y-%m-01') as month,
    COUNT(DISTINCT i.organization_id) as customer_count,
    SUM(i.total) as total_revenue,
    AVG(i.total) as avg_invoice_amount
FROM invoices i
WHERE i.status = 'paid'
GROUP BY DATE_FORMAT(i.created_at, '%Y-%m-01')
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
LEFT JOIN usage_events ue ON o.id = ue.organization_id AND ue.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
LEFT JOIN support_tickets st ON o.id = st.organization_id AND st.status IN ('open', 'in_progress')
LEFT JOIN users u ON o.id = u.organization_id
GROUP BY o.id, o.name, p.name, s.status;

-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

SELECT 'Database created successfully!' as status;
SELECT CONCAT('Organizations: ', COUNT(*)) as info FROM organizations;
SELECT CONCAT('Users: ', COUNT(*)) as info FROM users;
SELECT CONCAT('Subscriptions: ', COUNT(*)) as info FROM subscriptions;
SELECT CONCAT('Invoices: ', COUNT(*)) as info FROM invoices;
SELECT CONCAT('Usage Events: ', COUNT(*)) as info FROM usage_events;
SELECT CONCAT('Support Tickets: ', COUNT(*)) as info FROM support_tickets;
