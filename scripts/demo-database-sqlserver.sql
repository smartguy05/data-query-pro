-- DataQuery Pro Demo Database (SQL Server Version)
-- A comprehensive SaaS company database for demonstrating analytics capabilities
-- Company: "CloudMetrics Inc." - A fictional B2B analytics platform

-- ============================================================================
-- CLEANUP (Drop tables if they exist)
-- ============================================================================
IF OBJECT_ID('support_ticket_comments', 'U') IS NOT NULL DROP TABLE support_ticket_comments;
IF OBJECT_ID('support_tickets', 'U') IS NOT NULL DROP TABLE support_tickets;
IF OBJECT_ID('invoice_line_items', 'U') IS NOT NULL DROP TABLE invoice_line_items;
IF OBJECT_ID('invoices', 'U') IS NOT NULL DROP TABLE invoices;
IF OBJECT_ID('usage_events', 'U') IS NOT NULL DROP TABLE usage_events;
IF OBJECT_ID('subscription_history', 'U') IS NOT NULL DROP TABLE subscription_history;
IF OBJECT_ID('subscriptions', 'U') IS NOT NULL DROP TABLE subscriptions;
IF OBJECT_ID('user_roles', 'U') IS NOT NULL DROP TABLE user_roles;
IF OBJECT_ID('users', 'U') IS NOT NULL DROP TABLE users;
IF OBJECT_ID('teams', 'U') IS NOT NULL DROP TABLE teams;
IF OBJECT_ID('organizations', 'U') IS NOT NULL DROP TABLE organizations;
IF OBJECT_ID('product_features', 'U') IS NOT NULL DROP TABLE product_features;
IF OBJECT_ID('products', 'U') IS NOT NULL DROP TABLE products;
IF OBJECT_ID('feature_flags', 'U') IS NOT NULL DROP TABLE feature_flags;
IF OBJECT_ID('regions', 'U') IS NOT NULL DROP TABLE regions;
IF OBJECT_ID('industries', 'U') IS NOT NULL DROP TABLE industries;
IF OBJECT_ID('ticket_categories', 'U') IS NOT NULL DROP TABLE ticket_categories;
IF OBJECT_ID('ticket_priorities', 'U') IS NOT NULL DROP TABLE ticket_priorities;

-- Drop views if they exist
IF OBJECT_ID('monthly_revenue', 'V') IS NOT NULL DROP VIEW monthly_revenue;
IF OBJECT_ID('customer_health', 'V') IS NOT NULL DROP VIEW customer_health;
GO

-- ============================================================================
-- LOOKUP/REFERENCE TABLES
-- ============================================================================

-- Regions for geographic analysis
CREATE TABLE regions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    code NVARCHAR(10) NOT NULL UNIQUE,
    timezone NVARCHAR(50) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);

INSERT INTO regions (name, code, timezone) VALUES
('North America', 'NA', 'America/New_York'),
('Europe', 'EU', 'Europe/London'),
('Asia Pacific', 'APAC', 'Asia/Singapore'),
('Latin America', 'LATAM', 'America/Sao_Paulo'),
('Middle East & Africa', 'MEA', 'Asia/Dubai');

-- Industries for customer segmentation
CREATE TABLE industries (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    code NVARCHAR(20) NOT NULL UNIQUE,
    description NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
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
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    code NVARCHAR(20) NOT NULL UNIQUE,
    description NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
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
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(50) NOT NULL,
    code NVARCHAR(20) NOT NULL UNIQUE,
    sla_hours INT NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
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
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    code NVARCHAR(20) NOT NULL UNIQUE,
    description NVARCHAR(MAX),
    monthly_price DECIMAL(10, 2) NOT NULL,
    annual_price DECIMAL(10, 2) NOT NULL,
    max_users INT NULL,
    max_data_gb INT NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

INSERT INTO products (name, code, description, monthly_price, annual_price, max_users, max_data_gb) VALUES
('Starter', 'STARTER', 'Perfect for small teams getting started with analytics', 29.00, 290.00, 5, 10),
('Professional', 'PRO', 'Advanced features for growing businesses', 99.00, 990.00, 25, 100),
('Business', 'BIZ', 'Full-featured solution for established companies', 249.00, 2490.00, 100, 500),
('Enterprise', 'ENT', 'Custom solution for large organizations', 599.00, 5990.00, NULL, NULL);

-- Feature flags available in products
CREATE TABLE feature_flags (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    code NVARCHAR(50) NOT NULL UNIQUE,
    description NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
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
    id INT IDENTITY(1,1) PRIMARY KEY,
    product_id INT NOT NULL,
    feature_id INT NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT UQ_product_feature UNIQUE (product_id, feature_id),
    CONSTRAINT FK_product_features_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT FK_product_features_feature FOREIGN KEY (feature_id) REFERENCES feature_flags(id)
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
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    domain NVARCHAR(100),
    industry_id INT,
    region_id INT,
    employee_count INT,
    annual_revenue DECIMAL(15, 2),
    website NVARCHAR(255),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_organizations_industry FOREIGN KEY (industry_id) REFERENCES industries(id),
    CONSTRAINT FK_organizations_region FOREIGN KEY (region_id) REFERENCES regions(id)
);

CREATE TABLE teams (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(MAX),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_teams_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    team_id INT,
    email NVARCHAR(255) NOT NULL UNIQUE,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    title NVARCHAR(100),
    phone NVARCHAR(50),
    is_active BIT DEFAULT 1,
    is_admin BIT DEFAULT 0,
    last_login_at DATETIME2,
    login_count INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT FK_users_team FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE TABLE user_roles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    role_name NVARCHAR(50) NOT NULL,
    granted_at DATETIME2 DEFAULT GETDATE(),
    granted_by INT,
    CONSTRAINT FK_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT FK_user_roles_granted_by FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE subscriptions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    product_id INT NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'active',
    billing_cycle NVARCHAR(20) NOT NULL DEFAULT 'monthly',
    current_price DECIMAL(10, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    trial_ends_at DATETIME2,
    started_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    cancelled_at DATETIME2,
    next_billing_date DATE,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_subscriptions_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT FK_subscriptions_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE subscription_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    subscription_id INT NOT NULL,
    previous_product_id INT,
    new_product_id INT,
    change_type NVARCHAR(50) NOT NULL,
    change_reason NVARCHAR(MAX),
    changed_at DATETIME2 DEFAULT GETDATE(),
    changed_by INT,
    CONSTRAINT FK_subscription_history_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    CONSTRAINT FK_subscription_history_prev_product FOREIGN KEY (previous_product_id) REFERENCES products(id),
    CONSTRAINT FK_subscription_history_new_product FOREIGN KEY (new_product_id) REFERENCES products(id),
    CONSTRAINT FK_subscription_history_user FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- ============================================================================
-- INVOICES
-- ============================================================================

CREATE TABLE invoices (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    subscription_id INT,
    invoice_number NVARCHAR(50) NOT NULL UNIQUE,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending',
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    currency NVARCHAR(3) DEFAULT 'USD',
    due_date DATE NOT NULL,
    paid_at DATETIME2,
    payment_method NVARCHAR(50),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_invoices_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT FK_invoices_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE TABLE invoice_line_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    invoice_id INT NOT NULL,
    description NVARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_invoice_line_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- ============================================================================
-- USAGE TRACKING
-- ============================================================================

CREATE TABLE usage_events (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    user_id INT,
    event_type NVARCHAR(50) NOT NULL,
    event_data NVARCHAR(MAX),
    data_processed_mb DECIMAL(10, 2),
    duration_ms INT,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_usage_events_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT FK_usage_events_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for faster queries on usage_events
CREATE INDEX idx_usage_events_org_date ON usage_events(organization_id, created_at);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);

-- ============================================================================
-- SUPPORT TICKETS
-- ============================================================================

CREATE TABLE support_tickets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    created_by INT NOT NULL,
    assigned_to INT,
    category_id INT NOT NULL,
    priority_id INT NOT NULL,
    subject NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'open',
    resolution NVARCHAR(MAX),
    first_response_at DATETIME2,
    resolved_at DATETIME2,
    satisfaction_rating INT CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_support_tickets_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT FK_support_tickets_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT FK_support_tickets_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id),
    CONSTRAINT FK_support_tickets_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id),
    CONSTRAINT FK_support_tickets_priority FOREIGN KEY (priority_id) REFERENCES ticket_priorities(id)
);

CREATE TABLE support_ticket_comments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    comment NVARCHAR(MAX) NOT NULL,
    is_internal BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_support_ticket_comments_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
    CONSTRAINT FK_support_ticket_comments_user FOREIGN KEY (user_id) REFERENCES users(id)
);
GO

-- ============================================================================
-- GENERATE DEMO DATA
-- ============================================================================

-- Generate 50 organizations across different industries and regions
INSERT INTO organizations (name, domain, industry_id, region_id, employee_count, annual_revenue, website, created_at)
VALUES
('Nexus Technologies', 'nexustechnologies.com', 1, 1, 450, 15000000.00, 'https://www.nexustechnologies.com', DATEADD(DAY, -400, GETDATE())),
('Quantum Dynamics', 'quantumdynamics.com', 1, 2, 820, 28000000.00, 'https://www.quantumdynamics.com', DATEADD(DAY, -380, GETDATE())),
('Stellar Innovations', 'stellarinnovations.com', 1, 3, 150, 5000000.00, 'https://www.stellarinnovations.com', DATEADD(DAY, -360, GETDATE())),
('Peak Performance Co', 'peakperformanceco.com', 2, 1, 1200, 45000000.00, 'https://www.peakperformanceco.com', DATEADD(DAY, -340, GETDATE())),
('Blue Ocean Ventures', 'blueoceanventures.com', 3, 2, 380, 22000000.00, 'https://www.blueoceanventures.com', DATEADD(DAY, -320, GETDATE())),
('Summit Analytics', 'summitanalytics.com', 1, 1, 95, 3500000.00, 'https://www.summitanalytics.com', DATEADD(DAY, -300, GETDATE())),
('Horizon Labs', 'horizonlabs.com', 2, 3, 620, 18000000.00, 'https://www.horizonlabs.com', DATEADD(DAY, -280, GETDATE())),
('Velocity Systems', 'velocitysystems.com', 1, 4, 210, 8000000.00, 'https://www.velocitysystems.com', DATEADD(DAY, -260, GETDATE())),
('Apex Solutions', 'apexsolutions.com', 8, 1, 45, 2200000.00, 'https://www.apexsolutions.com', DATEADD(DAY, -240, GETDATE())),
('Pinnacle Group', 'pinnaclegroup.com', 3, 2, 1800, 75000000.00, 'https://www.pinnaclegroup.com', DATEADD(DAY, -220, GETDATE())),
('Aurora Digital', 'auroradigital.com', 7, 1, 280, 12000000.00, 'https://www.auroradigital.com', DATEADD(DAY, -200, GETDATE())),
('Zenith Corp', 'zenithcorp.com', 5, 3, 3200, 120000000.00, 'https://www.zenithcorp.com', DATEADD(DAY, -180, GETDATE())),
('Vanguard Tech', 'vanguardtech.com', 1, 1, 520, 19000000.00, 'https://www.vanguardtech.com', DATEADD(DAY, -160, GETDATE())),
('Phoenix Industries', 'phoenixindustries.com', 5, 4, 890, 35000000.00, 'https://www.phoenixindustries.com', DATEADD(DAY, -140, GETDATE())),
('Catalyst Partners', 'catalystpartners.com', 8, 2, 120, 6500000.00, 'https://www.catalystpartners.com', DATEADD(DAY, -120, GETDATE())),
('Momentum Inc', 'momentuminc.com', 4, 1, 450, 25000000.00, 'https://www.momentuminc.com', DATEADD(DAY, -100, GETDATE())),
('Synergy Solutions', 'synergysolutions.com', 1, 5, 180, 7000000.00, 'https://www.synergysolutions.com', DATEADD(DAY, -80, GETDATE())),
('Elevate Digital', 'elevatedigital.com', 7, 1, 95, 4200000.00, 'https://www.elevatedigital.com', DATEADD(DAY, -60, GETDATE())),
('Precision Systems', 'precisionsystems.com', 5, 2, 1500, 55000000.00, 'https://www.precisionsystems.com', DATEADD(DAY, -40, GETDATE())),
('Vector Analytics', 'vectoranalytics.com', 1, 3, 75, 2800000.00, 'https://www.vectoranalytics.com', DATEADD(DAY, -20, GETDATE())),
('Nova Enterprises', 'novaenterprises.com', 4, 1, 680, 28000000.00, 'https://www.novaenterprises.com', DATEADD(DAY, -350, GETDATE())),
('Atlas Corporation', 'atlascorporation.com', 5, 2, 2400, 95000000.00, 'https://www.atlascorporation.com', DATEADD(DAY, -330, GETDATE())),
('Frontier Tech', 'frontiertech.com', 1, 4, 320, 11000000.00, 'https://www.frontiertech.com', DATEADD(DAY, -310, GETDATE())),
('Pulse Digital', 'pulsedigital.com', 7, 1, 140, 5500000.00, 'https://www.pulsedigital.com', DATEADD(DAY, -290, GETDATE())),
('Core Dynamics', 'coredynamics.com', 1, 3, 410, 16000000.00, 'https://www.coredynamics.com', DATEADD(DAY, -270, GETDATE())),
('Fusion Labs', 'fusionlabs.com', 2, 2, 560, 21000000.00, 'https://www.fusionlabs.com', DATEADD(DAY, -250, GETDATE())),
('Impact Solutions', 'impactsolutions.com', 8, 1, 85, 3800000.00, 'https://www.impactsolutions.com', DATEADD(DAY, -230, GETDATE())),
('Matrix Systems', 'matrixsystems.com', 1, 5, 720, 27000000.00, 'https://www.matrixsystems.com', DATEADD(DAY, -210, GETDATE())),
('Orbit Technologies', 'orbittechnologies.com', 1, 1, 190, 7500000.00, 'https://www.orbittechnologies.com', DATEADD(DAY, -190, GETDATE())),
('Prism Analytics', 'prismanalytics.com', 1, 2, 65, 2400000.00, 'https://www.prismanalytics.com', DATEADD(DAY, -170, GETDATE())),
('Spark Innovations', 'sparkinnovations.com', 1, 3, 230, 9000000.00, 'https://www.sparkinnovations.com', DATEADD(DAY, -150, GETDATE())),
('Titan Corp', 'titancorp.com', 5, 4, 4500, 180000000.00, 'https://www.titancorp.com', DATEADD(DAY, -130, GETDATE())),
('Unity Digital', 'unitydigital.com', 7, 1, 175, 6800000.00, 'https://www.unitydigital.com', DATEADD(DAY, -110, GETDATE())),
('Wave Technologies', 'wavetechnologies.com', 1, 2, 340, 13000000.00, 'https://www.wavetechnologies.com', DATEADD(DAY, -90, GETDATE())),
('Xcel Partners', 'xcelpartners.com', 8, 1, 55, 2900000.00, 'https://www.xcelpartners.com', DATEADD(DAY, -70, GETDATE())),
('Zephyr Systems', 'zephyrsystems.com', 1, 5, 480, 18500000.00, 'https://www.zephyrsystems.com', DATEADD(DAY, -50, GETDATE())),
('Alpha Ventures', 'alphaventures.com', 3, 1, 920, 42000000.00, 'https://www.alphaventures.com', DATEADD(DAY, -30, GETDATE())),
('Beta Solutions', 'betasolutions.com', 1, 2, 135, 5200000.00, 'https://www.betasolutions.com', DATEADD(DAY, -10, GETDATE())),
('Delta Corp', 'deltacorp.com', 5, 3, 1100, 48000000.00, 'https://www.deltacorp.com', DATEADD(DAY, -365, GETDATE())),
('Gamma Industries', 'gammaindustries.com', 5, 4, 2800, 110000000.00, 'https://www.gammaindustries.com', DATEADD(DAY, -345, GETDATE())),
('Omega Tech', 'omegatech.com', 1, 1, 395, 15500000.00, 'https://www.omegatech.com', DATEADD(DAY, -325, GETDATE())),
('Sigma Partners', 'sigmapartners.com', 8, 2, 70, 3200000.00, 'https://www.sigmapartners.com', DATEADD(DAY, -305, GETDATE())),
('Theta Labs', 'thetalabs.com', 2, 3, 445, 17000000.00, 'https://www.thetalabs.com', DATEADD(DAY, -285, GETDATE())),
('Lambda Systems', 'lambdasystems.com', 1, 1, 260, 10000000.00, 'https://www.lambdasystems.com', DATEADD(DAY, -265, GETDATE())),
('Epsilon Digital', 'epsilondigital.com', 7, 5, 110, 4500000.00, 'https://www.epsilondigital.com', DATEADD(DAY, -245, GETDATE())),
('Kappa Innovations', 'kappainnovations.com', 1, 2, 185, 7200000.00, 'https://www.kappainnovations.com', DATEADD(DAY, -225, GETDATE())),
('Rho Analytics', 'rhoanalytics.com', 1, 1, 50, 1900000.00, 'https://www.rhoanalytics.com', DATEADD(DAY, -205, GETDATE())),
('Tau Corporation', 'taucorporation.com', 3, 3, 1350, 58000000.00, 'https://www.taucorporation.com', DATEADD(DAY, -185, GETDATE())),
('Upsilon Tech', 'upsilontech.com', 1, 4, 305, 12500000.00, 'https://www.upsilontech.com', DATEADD(DAY, -165, GETDATE())),
('Iota Solutions', 'iotasolutions.com', 8, 1, 40, 1800000.00, 'https://www.iotasolutions.com', DATEADD(DAY, -145, GETDATE()));

-- Generate teams for each organization
INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Engineering', 'Team responsible for engineering', DATEADD(DAY, 5, o.created_at)
FROM organizations o;

INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Marketing', 'Team responsible for marketing', DATEADD(DAY, 10, o.created_at)
FROM organizations o WHERE o.id % 3 <> 0;

INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Sales', 'Team responsible for sales', DATEADD(DAY, 15, o.created_at)
FROM organizations o WHERE o.id % 4 <> 0;

INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Analytics', 'Team responsible for analytics', DATEADD(DAY, 20, o.created_at)
FROM organizations o WHERE o.id % 2 = 0;

INSERT INTO teams (organization_id, name, description, created_at)
SELECT o.id, 'Operations', 'Team responsible for operations', DATEADD(DAY, 25, o.created_at)
FROM organizations o WHERE o.id % 5 <> 0;

-- Generate users for organizations (5 users per org)
INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT TOP 1 t.id FROM teams t WHERE t.organization_id = o.id ORDER BY NEWID()),
    CONCAT('admin@', o.domain),
    'Admin',
    'User',
    'Administrator',
    1,
    ABS(CHECKSUM(NEWID())) % 500,
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 30), GETDATE()),
    DATEADD(DAY, 1, o.created_at)
FROM organizations o;

INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT TOP 1 t.id FROM teams t WHERE t.organization_id = o.id ORDER BY NEWID()),
    CONCAT('james.smith@', o.domain),
    'James',
    'Smith',
    'Manager',
    0,
    ABS(CHECKSUM(NEWID())) % 300,
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 30), GETDATE()),
    DATEADD(DAY, 5, o.created_at)
FROM organizations o;

INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT TOP 1 t.id FROM teams t WHERE t.organization_id = o.id ORDER BY NEWID()),
    CONCAT('mary.johnson@', o.domain),
    'Mary',
    'Johnson',
    'Analyst',
    0,
    ABS(CHECKSUM(NEWID())) % 200,
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 30), GETDATE()),
    DATEADD(DAY, 10, o.created_at)
FROM organizations o;

INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT TOP 1 t.id FROM teams t WHERE t.organization_id = o.id ORDER BY NEWID()),
    CONCAT('robert.williams@', o.domain),
    'Robert',
    'Williams',
    'Engineer',
    0,
    ABS(CHECKSUM(NEWID())) % 250,
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 30), GETDATE()),
    DATEADD(DAY, 15, o.created_at)
FROM organizations o;

INSERT INTO users (organization_id, team_id, email, first_name, last_name, title, is_admin, login_count, last_login_at, created_at)
SELECT
    o.id,
    (SELECT TOP 1 t.id FROM teams t WHERE t.organization_id = o.id ORDER BY NEWID()),
    CONCAT('patricia.brown@', o.domain),
    'Patricia',
    'Brown',
    'Specialist',
    0,
    ABS(CHECKSUM(NEWID())) % 150,
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 30), GETDATE()),
    DATEADD(DAY, 20, o.created_at)
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
    CASE WHEN o.id % 4 = 0 THEN (ABS(CHECKSUM(NEWID())) % 20 + 5) ELSE 0 END,
    DATEADD(DAY, ABS(CHECKSUM(NEWID())) % 30, o.created_at),
    DATEADD(DAY, ABS(CHECKSUM(NEWID())) % 30, GETDATE())
FROM organizations o;

-- Generate invoices (3 invoices per subscription)
INSERT INTO invoices (organization_id, subscription_id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, payment_method, created_at)
SELECT
    s.organization_id,
    s.id,
    CONCAT('INV-', 10000 + (s.id * 3)),
    'paid',
    s.current_price * (1 - s.discount_percent/100),
    s.current_price * 0.08,
    s.current_price * (1 - s.discount_percent/100) * 1.08,
    DATEADD(DAY, 30, s.started_at),
    DATEADD(DAY, ABS(CHECKSUM(NEWID())) % 25 + 1, s.started_at),
    CASE WHEN s.id % 3 <> 0 THEN 'credit_card' ELSE 'bank_transfer' END,
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
    DATEADD(DAY, 60, s.started_at),
    DATEADD(DAY, ABS(CHECKSUM(NEWID())) % 25 + 31, s.started_at),
    CASE WHEN s.id % 3 <> 0 THEN 'credit_card' ELSE 'bank_transfer' END,
    DATEADD(DAY, 30, s.started_at)
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
    DATEADD(DAY, 15, GETDATE()),
    NULL,
    NULL,
    DATEADD(DAY, 60, s.started_at)
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

-- Generate usage events (20 events per user using a numbers table approach)
-- First, create a numbers table
;WITH Numbers AS (
    SELECT 1 as n
    UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
    UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
    UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
    UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
)
INSERT INTO usage_events (organization_id, user_id, event_type, data_processed_mb, duration_ms, created_at)
SELECT
    u.organization_id,
    u.id,
    CASE ABS(CHECKSUM(NEWID())) % 7
        WHEN 0 THEN 'login'
        WHEN 1 THEN 'report_view'
        WHEN 2 THEN 'export'
        WHEN 3 THEN 'api_call'
        WHEN 4 THEN 'query_run'
        WHEN 5 THEN 'dashboard_view'
        ELSE 'data_import'
    END,
    ROUND(RAND(CHECKSUM(NEWID())) * 100, 2),
    ABS(CHECKSUM(NEWID())) % 5000 + 100,
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 90), GETDATE())
FROM users u
CROSS JOIN Numbers
WHERE u.is_active = 1;

-- Generate support tickets (2 tickets per organization)
INSERT INTO support_tickets (organization_id, created_by, category_id, priority_id, subject, description, status, first_response_at, resolved_at, satisfaction_rating, created_at)
SELECT
    o.id,
    (SELECT TOP 1 u.id FROM users u WHERE u.organization_id = o.id),
    ABS(CHECKSUM(NEWID())) % 6 + 1,
    ABS(CHECKSUM(NEWID())) % 4 + 1,
    CASE ABS(CHECKSUM(NEWID())) % 10
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
    CASE ABS(CHECKSUM(NEWID())) % 4
        WHEN 0 THEN 'open'
        WHEN 1 THEN 'in_progress'
        WHEN 2 THEN 'resolved'
        ELSE 'closed'
    END,
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 170), GETDATE()),
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 165), GETDATE()),
    ABS(CHECKSUM(NEWID())) % 2 + 4,
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 180), GETDATE())
FROM organizations o;

INSERT INTO support_tickets (organization_id, created_by, category_id, priority_id, subject, description, status, created_at)
SELECT
    o.id,
    (SELECT TOP 1 u.id FROM users u WHERE u.organization_id = o.id),
    ABS(CHECKSUM(NEWID())) % 6 + 1,
    ABS(CHECKSUM(NEWID())) % 4 + 1,
    CASE ABS(CHECKSUM(NEWID())) % 10
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
    DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 30), GETDATE())
FROM organizations o;

-- Generate subscription history for some subscriptions
INSERT INTO subscription_history (subscription_id, previous_product_id, new_product_id, change_type, change_reason, changed_at)
SELECT TOP 20
    s.id,
    s.product_id - 1,
    s.product_id,
    'upgrade',
    'Customer upgraded due to team growth',
    DATEADD(DAY, ABS(CHECKSUM(NEWID())) % 180, s.started_at)
FROM subscriptions s
WHERE s.status = 'active' AND s.product_id > 1
ORDER BY NEWID();
GO

-- ============================================================================
-- CREATE HELPFUL VIEWS
-- ============================================================================

CREATE VIEW monthly_revenue AS
SELECT
    DATEFROMPARTS(YEAR(i.created_at), MONTH(i.created_at), 1) as month,
    COUNT(DISTINCT i.organization_id) as customer_count,
    SUM(i.total) as total_revenue,
    AVG(i.total) as avg_invoice_amount
FROM invoices i
WHERE i.status = 'paid'
GROUP BY DATEFROMPARTS(YEAR(i.created_at), MONTH(i.created_at), 1);
GO

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
LEFT JOIN usage_events ue ON o.id = ue.organization_id AND ue.created_at > DATEADD(DAY, -30, GETDATE())
LEFT JOIN support_tickets st ON o.id = st.organization_id AND st.status IN ('open', 'in_progress')
LEFT JOIN users u ON o.id = u.organization_id
GROUP BY o.id, o.name, p.name, s.status;
GO

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
