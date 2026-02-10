#!/bin/bash
# =============================================================================
# Authentik Setup Script for DataQuery Pro Testing
# =============================================================================
# Configures Authentik with an OAuth2/OIDC provider, application,
# admin group, test users, and groups scope mapping via the Authentik API.
#
# Prerequisites:
#   - Containers running: podman-compose -f docker-compose.auth-test.yml up -d
#   - curl and python (or python3) available
#
# Usage: bash scripts/setup-authentik.sh
#
# Idempotent: safe to run multiple times (skips existing resources).
# =============================================================================

set -euo pipefail

AUTHENTIK_URL="http://localhost:9000"
API_TOKEN="test-api-token-for-setup"
APP_SLUG="dataquery-pro"
APP_CALLBACK_URL="http://localhost:3000/api/auth/callback/authentik"
ADMIN_GROUP_NAME="dataquery-admins"
CONTAINER_NAME="dashboard_authentik-db_1"

# Detect python binary (prefer python over python3 to avoid Windows Store stub)
PYTHON=$(command -v python 2>/dev/null || command -v python3 2>/dev/null || echo "")

info()  { echo "[INFO] $1"; }
warn()  { echo "[WARN] $1"; }
error() { echo "[ERROR] $1"; }

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
api() {
  local method=$1 endpoint=$2; shift 2
  local data="${1:-}"
  if [ -n "$data" ]; then
    curl -s -X "$method" "${AUTHENTIK_URL}/api/v3${endpoint}" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "${AUTHENTIK_URL}/api/v3${endpoint}" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: application/json"
  fi
}

# Save API response to a temp file. Use a file in the current directory
# because mktemp creates /tmp/ paths that Python on Windows can't read.
TMPFILE=".authentik-setup-tmp.json"
cleanup() { rm -f "$TMPFILE"; }
trap cleanup EXIT

api_to_file() {
  local method=$1 endpoint=$2; shift 2
  local data="${1:-}"
  if [ -n "$data" ]; then
    curl -s -X "$method" "${AUTHENTIK_URL}/api/v3${endpoint}" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$data" -o "$TMPFILE"
  else
    curl -s -X "$method" "${AUTHENTIK_URL}/api/v3${endpoint}" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: application/json" -o "$TMPFILE"
  fi
}

jq_file() {
  # Run a python expression against the saved temp file
  local expr=$1
  $PYTHON -c "
import json, sys, os
with open(os.path.join(os.getcwd(), '$TMPFILE')) as f:
    data = json.load(f)
$expr
" 2>/dev/null
}

# =============================================================================
# Pre-flight checks
# =============================================================================
if [ -z "$PYTHON" ]; then
  error "Python is required but not found. Install python or python3."
  exit 1
fi
info "Using Python: $PYTHON"

if ! command -v curl &>/dev/null; then
  error "curl is required but not found."
  exit 1
fi

# Detect container runtime
CONTAINER_RT=""
if command -v podman &>/dev/null; then
  CONTAINER_RT="podman"
elif command -v docker &>/dev/null; then
  CONTAINER_RT="docker"
else
  warn "Neither podman nor docker found. Cannot create API token via DB — script will attempt API-only setup."
fi

# =============================================================================
# Step 0+1: Create API token and wait for Authentik to be ready
# =============================================================================
# The token must be created via psql because AUTHENTIK_BOOTSTRAP_TOKEN is
# unreliable. We retry the insert inside the wait loop because both the DB
# and the akadmin user may not exist yet on a fresh start.
# =============================================================================
info "Waiting for Authentik to be ready..."
MAX_ATTEMPTS=90
ATTEMPT=0
TOKEN_CREATED=false
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  # Try to create the API token if we haven't yet
  if [ "$TOKEN_CREATED" = "false" ] && [ -n "$CONTAINER_RT" ]; then
    $CONTAINER_RT exec "$CONTAINER_NAME" psql -U authentik -d authentik -c "
      INSERT INTO authentik_core_token (token_uuid, identifier, key, user_id, intent, expiring, expires, description, managed)
      SELECT gen_random_uuid(), 'api-setup-token', '${API_TOKEN}',
             (SELECT id FROM authentik_core_user WHERE username='akadmin' LIMIT 1),
             'api', false, '2030-01-01', 'Setup API token', ''
      WHERE NOT EXISTS (SELECT 1 FROM authentik_core_token WHERE identifier='api-setup-token');
    " 2>/dev/null && TOKEN_CREATED=true
  fi

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${AUTHENTIK_URL}/api/v3/root/config/" \
    -H "Authorization: Bearer ${API_TOKEN}" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    info "Authentik is ready!"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  if [ $((ATTEMPT % 10)) -eq 0 ]; then
    info "Still waiting... (attempt ${ATTEMPT}/${MAX_ATTEMPTS}, HTTP ${HTTP_CODE})"
  fi
  sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  error "Authentik did not become ready in time."
  error "Start containers: podman-compose -f docker-compose.auth-test.yml up -d"
  exit 1
fi

# =============================================================================
# Step 2: Look up required flows
# =============================================================================
info "Looking up authorization and invalidation flows..."

# Flows may not be available immediately after the API becomes responsive.
# Retry for up to 60 seconds.
FLOW_ATTEMPTS=0
MAX_FLOW_ATTEMPTS=30
AUTH_FLOW_PK=""
INVAL_FLOW_PK=""
while [ $FLOW_ATTEMPTS -lt $MAX_FLOW_ATTEMPTS ]; do
  api_to_file GET "/flows/instances/?designation=authorization&ordering=slug"
  AUTH_FLOW_PK=$(jq_file "r=data.get('results',[]); print(r[0]['pk'] if r else '')")

  api_to_file GET "/flows/instances/?designation=invalidation&ordering=slug"
  INVAL_FLOW_PK=$(jq_file "
r = data.get('results',[])
# Prefer the provider-specific invalidation flow
pk = ''
for f in r:
    if 'provider' in f.get('slug',''):
        pk = f['pk']; break
if not pk and r:
    pk = r[0]['pk']
print(pk)
")

  if [ -n "$AUTH_FLOW_PK" ] && [ -n "$INVAL_FLOW_PK" ]; then
    break
  fi
  FLOW_ATTEMPTS=$((FLOW_ATTEMPTS + 1))
  if [ $((FLOW_ATTEMPTS % 5)) -eq 0 ]; then
    info "Waiting for flows to be available... (attempt ${FLOW_ATTEMPTS}/${MAX_FLOW_ATTEMPTS})"
  fi
  sleep 2
done

if [ -z "$AUTH_FLOW_PK" ] || [ -z "$INVAL_FLOW_PK" ]; then
  error "Could not find required flows after ${MAX_FLOW_ATTEMPTS} attempts."
  error "Authentik may still be initializing. Try again in a minute."
  exit 1
fi
info "Authorization flow: ${AUTH_FLOW_PK}"
info "Invalidation flow:  ${INVAL_FLOW_PK}"

# =============================================================================
# Step 3: Look up scope mappings (openid, email, profile)
# =============================================================================
info "Looking up OAuth2 scope mappings..."

api_to_file GET "/propertymappings/all/?ordering=name&page_size=100"
SCOPE_IDS=$($PYTHON -c "
import json, os
with open(os.path.join(os.getcwd(), '$TMPFILE')) as f:
    data = json.load(f)
needed = ['openid', 'email', 'profile']
# Match by managed field pattern (works across Authentik versions)
ids = []
for r in data.get('results', []):
    managed = r.get('managed') or ''
    for scope in needed:
        if f'scope-{scope}' in managed:
            ids.append(r['pk'])
            break
print(json.dumps(ids))
" 2>/dev/null)

info "Found scope mapping IDs: ${SCOPE_IDS}"

# =============================================================================
# Step 4: Create OAuth2/OIDC Provider
# =============================================================================
info "Creating OAuth2/OIDC provider..."

api_to_file GET "/providers/oauth2/?name=DataQuery+Pro+OIDC"
EXISTING_COUNT=$(jq_file "print(data.get('pagination',{}).get('count', data.get('count',0)))")

if [ "$EXISTING_COUNT" != "0" ]; then
  warn "OAuth2 provider already exists, skipping creation"
  PROVIDER_PK=$(jq_file "print(data['results'][0]['pk'])")
else
  api_to_file POST "/providers/oauth2/" "{
    \"name\": \"DataQuery Pro OIDC\",
    \"authorization_flow\": \"${AUTH_FLOW_PK}\",
    \"invalidation_flow\": \"${INVAL_FLOW_PK}\",
    \"client_type\": \"confidential\",
    \"client_id\": \"dataquery-pro\",
    \"client_secret\": \"dataquery-pro-test-secret\",
    \"redirect_uris\": [{\"matching_mode\": \"strict\", \"url\": \"${APP_CALLBACK_URL}\"}],
    \"sub_mode\": \"hashed_user_id\",
    \"include_claims_in_id_token\": true,
    \"property_mappings\": ${SCOPE_IDS}
  }"

  PROVIDER_PK=$(jq_file "print(data.get('pk',''))")
  if [ -z "$PROVIDER_PK" ]; then
    error "Failed to create OAuth2 provider:"
    cat "$TMPFILE"
    exit 1
  fi
  info "Created OAuth2 provider (pk: ${PROVIDER_PK})"
fi

# =============================================================================
# Step 5: Create Application
# =============================================================================
info "Creating application..."

api_to_file GET "/core/applications/?slug=${APP_SLUG}"
APP_COUNT=$(jq_file "print(data.get('pagination',{}).get('count', data.get('count',0)))")

if [ "$APP_COUNT" != "0" ]; then
  warn "Application already exists, skipping creation"
else
  api_to_file POST "/core/applications/" "{
    \"name\": \"DataQuery Pro\",
    \"slug\": \"${APP_SLUG}\",
    \"provider\": ${PROVIDER_PK},
    \"meta_launch_url\": \"http://localhost:3000\",
    \"policy_engine_mode\": \"any\"
  }"

  CREATED_SLUG=$(jq_file "print(data.get('slug',''))")
  if [ -z "$CREATED_SLUG" ]; then
    error "Failed to create application:"
    cat "$TMPFILE"
    exit 1
  fi
  info "Created application: ${APP_SLUG}"
fi

# =============================================================================
# Step 6: Create admin group
# =============================================================================
info "Creating admin group: ${ADMIN_GROUP_NAME}..."

api_to_file GET "/core/groups/?name=${ADMIN_GROUP_NAME}"
GROUP_COUNT=$(jq_file "print(data.get('pagination',{}).get('count', data.get('count',0)))")

if [ "$GROUP_COUNT" != "0" ]; then
  warn "Admin group already exists, skipping creation"
  GROUP_PK=$(jq_file "print(data['results'][0]['pk'])")
else
  api_to_file POST "/core/groups/" "{
    \"name\": \"${ADMIN_GROUP_NAME}\",
    \"is_superuser\": false
  }"

  GROUP_PK=$(jq_file "print(data.get('pk',''))")
  if [ -z "$GROUP_PK" ]; then
    error "Failed to create admin group:"
    cat "$TMPFILE"
    exit 1
  fi
  info "Created admin group (pk: ${GROUP_PK})"
fi

# =============================================================================
# Step 7: Create test users
# =============================================================================
create_user() {
  local username=$1 email=$2 name=$3 password=$4 group_pk=$5

  info "Creating user: ${username}..."

  api_to_file GET "/core/users/?username=${username}"
  local count=$(jq_file "print(data.get('pagination',{}).get('count', data.get('count',0)))")

  if [ "$count" != "0" ]; then
    warn "User ${username} already exists, skipping"
    return 0
  fi

  local groups_json="[]"
  [ -n "$group_pk" ] && groups_json="[\"${group_pk}\"]"

  api_to_file POST "/core/users/" "{
    \"username\": \"${username}\",
    \"email\": \"${email}\",
    \"name\": \"${name}\",
    \"is_active\": true,
    \"groups\": ${groups_json}
  }"

  local user_pk=$(jq_file "print(data.get('pk',''))")
  if [ -z "$user_pk" ]; then
    error "Failed to create user ${username}:"
    cat "$TMPFILE"
    return 1
  fi
  info "Created user ${username} (pk: ${user_pk})"

  # Set password
  api POST "/core/users/${user_pk}/set_password/" "{\"password\": \"${password}\"}" >/dev/null
  info "Password set for ${username}"
}

create_user "testadmin" "testadmin@example.com" "Test Admin" "testadmin123" "$GROUP_PK"
create_user "testuser"  "testuser@example.com"  "Test User"  "testuser123"  ""

# =============================================================================
# Step 8: Create groups scope mapping and attach to provider
# =============================================================================
info "Checking groups scope mapping..."

api_to_file GET "/propertymappings/all/?ordering=name&page_size=100"
GROUPS_EXISTS=$($PYTHON -c "
import json, os
with open(os.path.join(os.getcwd(), '$TMPFILE')) as f:
    data = json.load(f)
found = [r['pk'] for r in data.get('results',[]) if r.get('name','') == 'Groups Scope' or 'scope-groups' in (r.get('managed') or '')]
print(found[0] if found else '')
" 2>/dev/null)

if [ -n "$GROUPS_EXISTS" ]; then
  info "Groups scope mapping already exists (pk: ${GROUPS_EXISTS})"
  GROUPS_MAPPING_PK="$GROUPS_EXISTS"
else
  info "Creating custom groups scope mapping..."
  api_to_file POST "/propertymappings/provider/scope/" "{
    \"name\": \"Groups Scope\",
    \"scope_name\": \"groups\",
    \"expression\": \"return {\\\"groups\\\": [group.name for group in request.user.ak_groups.all()]}\",
    \"description\": \"Returns user group names\"
  }"

  GROUPS_MAPPING_PK=$(jq_file "print(data.get('pk',''))")
  if [ -z "$GROUPS_MAPPING_PK" ]; then
    warn "Could not create groups scope mapping:"
    cat "$TMPFILE"
  else
    info "Created groups scope mapping (pk: ${GROUPS_MAPPING_PK})"
  fi
fi

# Attach groups mapping to provider if not already present
if [ -n "$GROUPS_MAPPING_PK" ] && [ -n "$PROVIDER_PK" ]; then
  api_to_file GET "/providers/oauth2/${PROVIDER_PK}/"
  UPDATED_MAPPINGS=$($PYTHON -c "
import json, os
with open(os.path.join(os.getcwd(), '$TMPFILE')) as f:
    data = json.load(f)
current = data.get('property_mappings', [])
# Normalize to list of PK strings
pks = [m['pk'] if isinstance(m, dict) else m for m in current]
extra = '${GROUPS_MAPPING_PK}'
if extra not in pks:
    pks.append(extra)
print(json.dumps(pks))
" 2>/dev/null)

  api PATCH "/providers/oauth2/${PROVIDER_PK}/" "{\"property_mappings\": ${UPDATED_MAPPINGS}}" >/dev/null
  info "Provider scope mappings updated"
fi

# =============================================================================
# Generate secrets for .env.local
# =============================================================================
if command -v openssl &>/dev/null; then
  AUTH_SECRET=$(openssl rand -hex 32)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
else
  AUTH_SECRET=$($PYTHON -c "import secrets; print(secrets.token_hex(32))")
  ENCRYPTION_KEY=$($PYTHON -c "import secrets; print(secrets.token_hex(32))")
fi

# =============================================================================
# Output
# =============================================================================
cat <<EOF

=============================================================================
  Authentik setup complete!
=============================================================================

Authentik Admin UI:  ${AUTHENTIK_URL}/if/admin/
  Username: akadmin
  Password: admin

Test Users:
  Admin:   testadmin / testadmin123  (member of ${ADMIN_GROUP_NAME})
  Regular: testuser  / testuser123

Add these to your .env.local:
=============================================================================

AUTH_OIDC_ISSUER=${AUTHENTIK_URL}/application/o/${APP_SLUG}/
AUTH_OIDC_CLIENT_ID=dataquery-pro
AUTH_OIDC_CLIENT_SECRET=dataquery-pro-test-secret
AUTH_SECRET=${AUTH_SECRET}
AUTH_ADMIN_GROUP=${ADMIN_GROUP_NAME}
AUTH_URL=http://localhost:3000

APP_DATABASE_URL=postgres://dataquery:dataquery@localhost:5432/dataquery_app
APP_ENCRYPTION_KEY=${ENCRYPTION_KEY}

=============================================================================

Demo database (for testing queries):
  Host: localhost  Port: 5433  DB: cloudmetrics  User: demo  Password: demo

EOF
