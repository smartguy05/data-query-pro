#!/bin/bash

# DataQuery Pro - PostgreSQL Setup Script for Podman
# This script creates and initializes the PostgreSQL container for multi-user mode

set -e

# Configuration (can be overridden via environment)
CONTAINER_NAME="${CONTAINER_NAME:-dataquery-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DATABASE="${POSTGRES_DATABASE:-dataquery_pro}"
POSTGRES_USERNAME="${POSTGRES_USERNAME:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme}"
POSTGRES_VERSION="${POSTGRES_VERSION:-15}"
VOLUME_NAME="${VOLUME_NAME:-dataquery-pgdata}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}DataQuery Pro - PostgreSQL Setup${NC}"
echo "=================================="
echo ""

# Check if Podman is installed
if ! command -v podman &> /dev/null; then
    echo -e "${RED}Error: Podman is not installed.${NC}"
    echo "Please install Podman first: https://podman.io/docs/installation"
    exit 1
fi

echo -e "${GREEN}✓${NC} Podman is installed"

# Check if container already exists
if podman container exists "$CONTAINER_NAME" 2>/dev/null; then
    echo -e "${YELLOW}Container '$CONTAINER_NAME' already exists.${NC}"
    read -p "Do you want to remove and recreate it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping and removing existing container..."
        podman stop "$CONTAINER_NAME" 2>/dev/null || true
        podman rm "$CONTAINER_NAME" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Existing container removed"
    else
        echo "Starting existing container..."
        podman start "$CONTAINER_NAME"
        echo -e "${GREEN}✓${NC} Container started"
        exit 0
    fi
fi

# Create the PostgreSQL container
echo ""
echo "Creating PostgreSQL container with named volume '$VOLUME_NAME'..."
podman run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_USER="$POSTGRES_USERNAME" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$POSTGRES_DATABASE" \
    -p "$POSTGRES_PORT:5432" \
    -v "$VOLUME_NAME:/var/lib/postgresql/data" \
    "docker.io/library/postgres:$POSTGRES_VERSION"

echo -e "${GREEN}✓${NC} Container created and started"

# Wait for PostgreSQL to be ready
echo ""
echo "Waiting for PostgreSQL to be ready..."
sleep 5

MAX_RETRIES=30
RETRY_COUNT=0
until podman exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USERNAME" -d "$POSTGRES_DATABASE" > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}Error: PostgreSQL did not become ready in time.${NC}"
        exit 1
    fi
    echo "  Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo -e "${GREEN}✓${NC} PostgreSQL is ready"

# Initialize the database schema
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_SQL="$SCRIPT_DIR/init-db.sql"

if [ -f "$INIT_SQL" ]; then
    echo ""
    echo "Initializing database schema..."
    podman exec -i "$CONTAINER_NAME" psql -U "$POSTGRES_USERNAME" -d "$POSTGRES_DATABASE" < "$INIT_SQL"
    echo -e "${GREEN}✓${NC} Database schema initialized"
else
    echo -e "${YELLOW}Warning: init-db.sql not found at $INIT_SQL${NC}"
    echo "You will need to run the schema initialization manually."
fi

# Generate encryption key if not set
if [ -z "$ENCRYPTION_KEY" ]; then
    NEW_KEY=$(openssl rand -hex 32)
    echo ""
    echo -e "${YELLOW}Generated new encryption key:${NC}"
    echo "$NEW_KEY"
    echo ""
    echo "Add this to your .env.local file:"
    echo "ENCRYPTION_KEY=$NEW_KEY"
fi

# Output configuration
echo ""
echo "=================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=================================="
echo ""
echo "Container: $CONTAINER_NAME"
echo "Port: $POSTGRES_PORT"
echo "Database: $POSTGRES_DATABASE"
echo "Username: $POSTGRES_USERNAME"
echo ""
echo "Add these environment variables to your .env.local file:"
echo ""
echo "MULTI_USER_ENABLED=true"
echo "NEXT_PUBLIC_MULTI_USER_ENABLED=true"
echo "POSTGRES_HOST=localhost"
echo "POSTGRES_PORT=$POSTGRES_PORT"
echo "POSTGRES_DATABASE=$POSTGRES_DATABASE"
echo "POSTGRES_USERNAME=$POSTGRES_USERNAME"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo ""
echo "Useful commands:"
echo "  podman start $CONTAINER_NAME   # Start the container"
echo "  podman stop $CONTAINER_NAME    # Stop the container"
echo "  podman logs $CONTAINER_NAME    # View logs"
echo "  podman exec -it $CONTAINER_NAME psql -U $POSTGRES_USERNAME -d $POSTGRES_DATABASE  # Connect to database"
echo ""
echo "Volume management:"
echo "  podman volume ls              # List volumes"
echo "  podman volume inspect $VOLUME_NAME  # Inspect the data volume"
echo "  podman volume rm $VOLUME_NAME  # Remove the data volume (WARNING: deletes all data)"
echo ""
