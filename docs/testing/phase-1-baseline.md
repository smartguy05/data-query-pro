# Phase 1: Baseline Tests

Baseline feature testing with no rate limit and no server config.
See [Testing Plan](./README.md) for environment setup.

**Configuration:**
- `DEMO_RATE_LIMIT` not set or empty
- `config/databases.json` does NOT exist
- PostgreSQL container running

## 1.1 Landing Page (`/landing`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| L-01 | Page loads | Navigate to `/landing` | Page renders with hero section |
| L-02 | Navigation links | Check header links | All nav links present and clickable |
| L-03 | Theme toggle | Click theme button | Toggles between light/dark mode |
| L-04 | CTA buttons | Click "Get Started" | Navigates to dashboard |
| L-05 | Feature sections | Scroll page | All feature sections visible |
| L-06 | Footer links | Check footer | All links functional |

## 1.2 Dashboard Page (`/`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| D-01 | Empty state | Load with no connections | Shows setup progress, prompts to add connection |
| D-02 | Setup progress | Check progress indicators | Shows 4 steps: Connect, Introspect, AI Descriptions, Query |
| D-03 | Quick actions | Verify action cards | All 4 actions visible and clickable |
| D-04 | No suggestions state | Before AI setup | Shows "No suggestions yet" message |
| D-05 | AI suggestions | After schema upload | Shows 3-5 metric suggestions |
| D-06 | Click suggestion | Click suggested metric | Navigates to query page with pre-filled query |

## 1.3 Database Connection Page (`/database`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DB-01 | Page loads | Navigate to `/database` | Shows tabs: New/Existing, connection form |
| DB-02 | New connection tab | Click "New Connection" | Shows connection form |
| DB-03 | Database type dropdown | Open dropdown | Shows PostgreSQL, MySQL, SQL Server, SQLite |
| DB-04 | PostgreSQL form | Select PostgreSQL | Shows host, port (5432), database, username, password fields |
| DB-05 | Fill connection form | Enter demo PostgreSQL details | All fields accept input |
| DB-06 | Test connection | Click "Test Connection" | Shows success toast, API call succeeds |
| DB-07 | Save connection | Click "Save & Connect" | Connection saved, navigates to schema page |
| DB-08 | Existing connections tab | Click "Existing" | Shows saved connections list |
| DB-09 | Select existing | Click saved connection | Connection becomes active |
| DB-10 | Edit connection | Click edit button | Opens edit form with pre-filled data |
| DB-11 | Delete connection | Click delete button | Shows confirmation, removes on confirm |
| DB-12 | Export connections | Click export | Downloads JSON file with connections |
| DB-13 | Import connections | Upload JSON file | Imports and shows connections |
| DB-14 | Connection status | Check status indicators | Shows connected/disconnected status |

## 1.4 Schema Explorer Page (`/schema`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| S-01 | Page loads | Navigate to `/schema` | Shows schema explorer or prompt to connect |
| S-02 | No connection state | Without active connection | Shows "Connect to database" prompt |
| S-03 | Introspect schema | Click "Introspect Schema" | Starts introspection, shows progress |
| S-04 | Schema tree | After introspection | Shows table tree with all demo tables |
| S-05 | Expand table | Click table name | Shows columns with types |
| S-06 | Column details | Hover/click column | Shows data type, constraints, FK info |
| S-07 | Hide table | Click hide toggle on table | Table marked as hidden |
| S-08 | Hide column | Click hide toggle on column | Column marked as hidden |
| S-09 | Search tables | Type in search box | Filters tables by name |
| S-10 | Generate descriptions | Click "Generate AI Descriptions" | AI generates table/column descriptions |
| S-11 | Description display | After generation | Tables show AI-generated descriptions |
| S-12 | Manual description edit | Click edit on description | Opens edit modal, saves changes |
| S-13 | Upload schema | Click "Upload to OpenAI" | Uploads schema file, creates vector store |
| S-14 | Upload success | After upload | Shows success message, enables querying |
| S-15 | Unsaved changes warning | Make changes, try to leave | Shows warning dialog |
| S-16 | Re-introspect | Click introspect again | Detects schema changes, marks new items |

## 1.5 Query Page (`/query`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| Q-01 | Page loads | Navigate to `/query` | Shows query input area |
| Q-02 | No schema warning | Without uploaded schema | Shows "Upload schema first" message |
| Q-03 | Query input | Type natural language query | Input accepts text |
| Q-04 | Generate SQL | Click "Generate SQL" | AI generates SQL query |
| Q-05 | SQL display | After generation | Shows generated SQL with explanation |
| Q-06 | Confidence indicator | Check confidence level | Shows confidence % and warnings if low |
| Q-07 | Execute query | Click "Run Query" | Executes SQL, shows results |
| Q-08 | Results table | After execution | Shows data in table format |
| Q-09 | Results pagination | With many rows | Pagination controls work |
| Q-10 | Chart view | Click chart toggle | Switches to chart visualization |
| Q-11 | Chart types | Select different chart type | Renders bar, line, pie, area, scatter |
| Q-12 | Follow-up query | Type follow-up question | AI generates related query |
| Q-13 | Revise query | Click "Revise" | Opens revise modal, regenerates SQL |
| Q-14 | Query history | Check history | Shows previous queries |
| Q-15 | Save as report | Click "Save as Report" | Opens save dialog |
| Q-16 | Export results | Click export | Downloads CSV/JSON |
| Q-17 | Copy SQL | Click copy button | SQL copied to clipboard |

**Test Queries to Execute:**

| Query | Expected Behavior |
|-------|-------------------|
| "Show me total revenue by month" | Queries invoices table with DATE_TRUNC |
| "Which organizations have the most support tickets?" | Joins support_tickets with organizations |
| "Show user login activity over the past 30 days" | Queries usage_events with date filter |
| "What products are most popular?" | Queries subscriptions with products |
| "Show organizations by region and industry" | Joins organizations with regions/industries |
| "Count active users by organization" | Filters users WHERE is_active = true |

## 1.6 Reports Page (`/reports`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| R-01 | Page loads | Navigate to `/reports` | Shows reports list or empty state |
| R-02 | Empty state | No saved reports | Shows "No reports yet" message |
| R-03 | Create report | Save query as report | Report appears in list |
| R-04 | Report card | View saved report | Shows name, description, last run |
| R-05 | Run report | Click "Run" button | Executes report, shows results |
| R-06 | Edit report | Click edit button | Opens edit dialog |
| R-07 | Edit name | Change report name | Name updates successfully |
| R-08 | Edit description | Change description | Description saves |
| R-09 | Clone report | Click clone button | Creates copy with "(Copy)" suffix |
| R-10 | Delete report | Click delete button | Shows confirm, removes on confirm |
| R-11 | Search reports | Type in search | Filters reports by name/description |
| R-12 | Parameter config | Add parameter to report | Parameter saved to report |
| R-13 | Run with parameters | Run parameterized report | Shows parameter input dialog |
| R-14 | Parameter types | Create text/number/date params | Each type renders correctly |
| R-15 | Required parameters | Leave required empty | Shows validation error |
| R-16 | Export report | Export as JSON | Downloads report definition |

## 1.7 Navigation and Global Features

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| N-01 | Navigation bar | Check all pages | Nav bar visible on all pages |
| N-02 | Active link | Navigate between pages | Active page highlighted |
| N-03 | Connection indicator | Check header | Shows current connection name |
| N-04 | API key indicator | Check header | Shows key status (green checkmark if set) |
| N-05 | Theme persistence | Toggle theme, refresh | Theme persists after refresh |
| N-06 | Mobile responsive | Resize to mobile | Layout adapts, hamburger menu appears |
| N-07 | Keyboard navigation | Tab through elements | Focus visible, tab order logical |
| N-08 | Toast notifications | Trigger action | Toast appears and auto-dismisses |

---

## Error Handling Tests

| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| E-01 | Invalid connection | Wrong credentials | Shows connection error, doesn't crash |
| E-02 | Network error | Disconnect network | Shows network error message |
| E-03 | Invalid query | Generate invalid SQL | Shows error, allows retry |
| E-04 | Empty results | Query with no matches | Shows "No results" message |
| E-05 | Large results | Query returning 10000+ rows | Paginates, doesn't freeze |
| E-06 | API timeout | Long-running AI request | Shows timeout, allows retry |
| E-07 | Invalid schema | Corrupt localStorage | Handles gracefully, offers reset |
| E-08 | Vector store expired | OpenAI store deleted | Prompts to re-upload schema |

---

## Related Documentation
- [Testing Plan index](./README.md)
- [Phase 2: Server Configuration](./phase-2-server-config.md)
