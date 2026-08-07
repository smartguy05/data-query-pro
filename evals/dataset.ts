// Golden dataset for the NL→SQL eval harness against the CloudMetrics demo DB
// (scripts/demo-database.sql, PostgreSQL). Questions are phrased the way a
// business user would type them; goldenSql is the authored reference answer.

import type { EvalQuestion } from "./types";

export const QUESTIONS: EvalQuestion[] = [
  // ── Simple counts ─────────────────────────────────────────────────────────
  {
    id: "Q01",
    question: "How many organizations are there?",
    goldenSql: "SELECT COUNT(*) FROM organizations",
    mode: "scalar",
    tags: ["count", "phase4"],
  },
  {
    id: "Q02",
    question: "How many active users do we have?",
    goldenSql: "SELECT COUNT(*) FROM users WHERE is_active = true",
    mode: "scalar",
    tags: ["count", "filter"],
  },
  {
    id: "Q03",
    question: "What is the total number of teams?",
    goldenSql: "SELECT COUNT(*) FROM teams",
    mode: "scalar",
    tags: ["count"],
  },

  // ── Filters ───────────────────────────────────────────────────────────────
  {
    id: "Q04",
    question: "List all of our regions and their timezones.",
    goldenSql: "SELECT name, timezone FROM regions",
    mode: "unordered",
    tags: ["filter", "lookup"],
  },
  {
    id: "Q05",
    question: "Which products cost more than $100 per month?",
    // Names only: "which products" doesn't oblige the model to also return the
    // price, and golden columns must all be present in the generated result.
    goldenSql: "SELECT name FROM products WHERE monthly_price > 100",
    mode: "unordered",
    tags: ["filter"],
  },
  {
    id: "Q06",
    question: "Show me all the cancelled subscriptions.",
    goldenSql: "SELECT id FROM subscriptions WHERE status = 'cancelled'",
    mode: "row-count",
    tags: ["filter"],
  },
  {
    id: "Q07",
    question: "What are the different team names used across the company?",
    goldenSql: "SELECT DISTINCT name FROM teams",
    mode: "unordered",
    tags: ["filter", "distinct"],
  },

  // ── Single joins ──────────────────────────────────────────────────────────
  {
    id: "Q08",
    question: "Which organizations are in the Technology industry?",
    goldenSql:
      "SELECT o.name FROM organizations o JOIN industries i ON o.industry_id = i.id WHERE i.name = 'Technology'",
    mode: "unordered",
    tags: ["join", "phase4"],
  },
  {
    id: "Q09",
    question:
      "How many active subscriptions does each product have? Only include products that have at least one active subscription.",
    // Starter and Professional have zero active subscriptions in the seed data,
    // so an unqualified question would make a LEFT JOIN (4 rows, with zeros)
    // just as correct as this inner join (2 rows).
    goldenSql:
      "SELECT p.name, COUNT(*) AS active_subscriptions FROM subscriptions s JOIN products p ON s.product_id = p.id WHERE s.status = 'active' GROUP BY p.name",
    mode: "unordered",
    tags: ["join", "group-by"],
  },
  {
    id: "Q10",
    question:
      "Show the first 10 users sorted by email address, along with the name of the organization each belongs to.",
    goldenSql:
      "SELECT u.email, o.name FROM users u JOIN organizations o ON u.organization_id = o.id ORDER BY u.email LIMIT 10",
    mode: "ordered",
    tags: ["join", "top-n"],
  },
  {
    id: "Q11",
    question: "How many active Enterprise subscriptions are there?",
    goldenSql:
      "SELECT COUNT(*) FROM subscriptions s JOIN products p ON s.product_id = p.id WHERE s.status = 'active' AND p.name = 'Enterprise'",
    mode: "scalar",
    tags: ["join", "count", "phase4"],
  },

  // ── Multi-joins ───────────────────────────────────────────────────────────
  {
    id: "Q12",
    // "open" alone is ambiguous against status values {open, in_progress,
    // resolved, closed} — "open ticket" colloquially means unresolved, and the
    // schema file does not enumerate status values, so the wording pins the
    // literal 'open' status explicitly. Likewise the priority display name is
    // stored capitalized ('Critical'); casing is unknowable from a
    // structure-only schema, so the wording quotes it verbatim.
    question:
      "Which organizations currently have support tickets with the 'Critical' priority and status 'open'?",
    goldenSql:
      "SELECT DISTINCT o.name FROM organizations o JOIN support_tickets st ON st.organization_id = o.id JOIN ticket_priorities tp ON st.priority_id = tp.id WHERE st.status = 'open' AND tp.code = 'P1'",
    mode: "unordered",
    tags: ["join", "multi-join"],
  },
  {
    id: "Q13",
    question: "What is our total paid invoice revenue broken down by industry?",
    goldenSql:
      "SELECT ind.name, SUM(inv.total) AS revenue FROM invoices inv JOIN organizations o ON inv.organization_id = o.id JOIN industries ind ON o.industry_id = ind.id WHERE inv.status = 'paid' GROUP BY ind.name",
    mode: "unordered",
    tags: ["join", "multi-join", "group-by"],
  },
  {
    id: "Q14",
    question: "How many support tickets are there in each category?",
    goldenSql:
      "SELECT tc.name, COUNT(*) AS ticket_count FROM support_tickets st JOIN ticket_categories tc ON st.category_id = tc.id GROUP BY tc.name",
    mode: "unordered",
    tags: ["join", "group-by"],
  },
  {
    id: "Q15",
    question: "Who are the top 5 users with the most support tickets?",
    goldenSql:
      "SELECT u.email, COUNT(*) AS ticket_count FROM support_tickets st JOIN users u ON st.created_by = u.id GROUP BY u.id, u.email ORDER BY COUNT(*) DESC LIMIT 5",
    mode: "row-count",
    tags: ["join", "top-n", "phase4"],
  },

  // ── Aggregations ──────────────────────────────────────────────────────────
  {
    id: "Q16",
    question: "What is our total revenue from paid invoices?",
    goldenSql: "SELECT SUM(total) FROM invoices WHERE status = 'paid'",
    mode: "scalar",
    tags: ["aggregation"],
  },
  {
    id: "Q17",
    question:
      "What is the average employee count of our customers in each region?",
    goldenSql:
      "SELECT r.name, AVG(o.employee_count) AS avg_employees FROM organizations o JOIN regions r ON o.region_id = r.id GROUP BY r.name",
    mode: "unordered",
    tags: ["aggregation", "group-by", "join"],
  },
  {
    id: "Q18",
    question:
      "What is the average customer satisfaction rating for each support ticket priority level?",
    goldenSql:
      "SELECT tp.name, AVG(st.satisfaction_rating) AS avg_rating FROM support_tickets st JOIN ticket_priorities tp ON st.priority_id = tp.id WHERE st.satisfaction_rating IS NOT NULL GROUP BY tp.name",
    mode: "unordered",
    tags: ["aggregation", "group-by", "join"],
  },
  {
    id: "Q19",
    question: "What is the average invoice total for each payment method?",
    goldenSql:
      "SELECT payment_method, AVG(total) AS avg_total FROM invoices WHERE payment_method IS NOT NULL GROUP BY payment_method",
    mode: "unordered",
    tags: ["aggregation", "group-by"],
  },

  // ── Date math (volatile: NOW()-relative) ─────────────────────────────────
  {
    id: "Q20",
    question: "How many usage events happened in the last 7 days?",
    goldenSql:
      "SELECT COUNT(*) FROM usage_events WHERE created_at > NOW() - INTERVAL '7 days'",
    mode: "scalar",
    volatile: true,
    tags: ["date", "count", "phase4"],
  },
  {
    id: "Q21",
    question: "How many users have logged in during the last 7 days?",
    goldenSql:
      "SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '7 days'",
    mode: "scalar",
    volatile: true,
    tags: ["date", "count"],
  },
  {
    id: "Q22",
    // "between ... and ..." reads as inclusive on both ends, matching the
    // golden; due_date is a DATE, so an off-by-one boundary reading could
    // otherwise change the count on days when invoices fall exactly on an edge.
    question:
      "How many invoices have a due date between today and 30 days from now?",
    goldenSql:
      "SELECT COUNT(*) FROM invoices WHERE due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + INTERVAL '30 days'",
    mode: "scalar",
    volatile: true,
    tags: ["date", "count"],
  },

  // ── Top-N (ordered) ───────────────────────────────────────────────────────
  {
    id: "Q23",
    question: "What are the top 10 organizations by annual revenue?",
    goldenSql:
      "SELECT name, annual_revenue FROM organizations ORDER BY annual_revenue DESC LIMIT 10",
    mode: "ordered",
    tags: ["top-n", "phase4"],
  },
  {
    id: "Q24",
    question:
      "Looking only at paid invoices, which 3 organizations have paid us the most, from highest to lowest?",
    goldenSql:
      "SELECT o.name, SUM(i.total) AS total_paid FROM invoices i JOIN organizations o ON i.organization_id = o.id WHERE i.status = 'paid' GROUP BY o.id, o.name ORDER BY SUM(i.total) DESC LIMIT 3",
    mode: "ordered",
    tags: ["top-n", "join", "group-by"],
  },
  {
    id: "Q25",
    question:
      "Show me the 5 most recent support tickets with their subject and when they were created.",
    goldenSql:
      "SELECT subject, created_at FROM support_tickets ORDER BY created_at DESC LIMIT 5",
    mode: "ordered",
    tags: ["top-n", "date"],
  },

  // ── Views ─────────────────────────────────────────────────────────────────
  {
    id: "Q26",
    question:
      "What is our total revenue from paid invoices for each month, based on when each invoice was issued?",
    // Project only the revenue column: the view's month is a truncated
    // timestamp ("2024-08-01 00:00:00"), while a correct answer may format the
    // month as '2024-08' via to_char, which the comparator's date parsing does
    // NOT normalize (no yyyy-mm-dd prefix) — the month column would never
    // match. The wording pins "paid" (paid vs all invoices differ) and
    // "issued" (created_at vs paid_at grouping differ).
    goldenSql: "SELECT total_revenue FROM monthly_revenue",
    mode: "unordered",
    tags: ["view", "group-by", "phase4"],
  },
  {
    id: "Q27",
    // NOTE: schema introspection reads pg_catalog.pg_tables, which EXCLUDES
    // views — the model never sees customer_health (or monthly_revenue), so a
    // view-anchored question is unanswerable. This question instead tests the
    // same aggregation from base tables, quoting both status literals verbatim
    // ('in_progress' uses an underscore, undiscoverable from a structure-only
    // schema). Golden matches the view's open_tickets semantics.
    question:
      "For each organization that has support tickets with status 'open' or 'in_progress', show how many such tickets it has.",
    goldenSql:
      "SELECT o.name, COUNT(*) FROM organizations o JOIN support_tickets st ON st.organization_id = o.id WHERE st.status IN ('open', 'in_progress') GROUP BY o.name",
    mode: "unordered",
    tags: ["join", "group-by"],
  },

  // ── NULL handling ─────────────────────────────────────────────────────────
  {
    id: "Q28",
    question: "Which products have no limit on the number of users?",
    goldenSql: "SELECT name FROM products WHERE max_users IS NULL",
    mode: "unordered",
    tags: ["null", "filter"],
  },
  {
    id: "Q29",
    question:
      "How many support tickets never received a satisfaction rating?",
    goldenSql:
      "SELECT COUNT(*) FROM support_tickets WHERE satisfaction_rating IS NULL",
    mode: "scalar",
    tags: ["null", "count"],
  },

  // ── Ambiguous (any non-empty result passes) ───────────────────────────────
  {
    id: "Q30",
    question: "Show me everything",
    goldenSql: "SELECT * FROM organizations LIMIT 50",
    mode: "non-empty",
    tags: ["ambiguous", "phase4"],
  },
  {
    id: "Q31",
    question: "How is the business doing?",
    goldenSql:
      "SELECT month, customer_count, total_revenue FROM monthly_revenue ORDER BY month",
    mode: "non-empty",
    tags: ["ambiguous"],
  },
  {
    id: "Q32",
    question: "Give me some interesting insights about our customers",
    goldenSql:
      "SELECT organization_name, product_name, subscription_status, usage_events_30d, open_tickets FROM customer_health",
    mode: "non-empty",
    tags: ["ambiguous"],
  },
];
