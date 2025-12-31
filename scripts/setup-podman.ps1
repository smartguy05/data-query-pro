# DataQuery Pro - PostgreSQL Setup Script for Podman (Windows PowerShell)
# This script creates and initializes the PostgreSQL container for multi-user mode

param(
    [string]$ContainerName = "dataquery-postgres",
    [int]$PostgresPort = 5432,
    [string]$PostgresDatabase = "dataquery_pro",
    [string]$PostgresUsername = "postgres",
    [string]$PostgresPassword = "postgres",
    [string]$PostgresVersion = "15",
    [string]$VolumeName = "dataquery-pgdata"
)

$ErrorActionPreference = "Stop"

Write-Host "DataQuery Pro - PostgreSQL Setup" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# Check if Podman is installed
try {
    $podmanVersion = podman --version
    Write-Host "Podman is installed: $podmanVersion" -ForegroundColor Green
}
catch {
    Write-Host "Error: Podman is not installed." -ForegroundColor Red
    Write-Host "Please install Podman first: https://podman.io/docs/installation"
    exit 1
}

# Check if container already exists
$null = podman container exists $ContainerName 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Container '$ContainerName' already exists." -ForegroundColor Yellow
    $response = Read-Host "Do you want to remove and recreate it? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "Stopping and removing existing container..."
        $null = podman stop $ContainerName 2>$null
        $null = podman rm $ContainerName 2>$null
        Write-Host "Existing container removed" -ForegroundColor Green
    }
    else {
        Write-Host "Starting existing container..."
        podman start $ContainerName
        Write-Host "Container started" -ForegroundColor Green
        exit 0
    }
}

# Create the PostgreSQL container
Write-Host ""
Write-Host "Creating PostgreSQL container with named volume '$VolumeName'..."

$runArgs = @(
    "run", "-d",
    "--name", $ContainerName,
    "-e", "POSTGRES_USER=$PostgresUsername",
    "-e", "POSTGRES_PASSWORD=$PostgresPassword",
    "-e", "POSTGRES_DB=$PostgresDatabase",
    "-p", "${PostgresPort}:5432",
    "-v", "${VolumeName}:/var/lib/postgresql/data",
    "docker.io/library/postgres:$PostgresVersion"
)

& podman @runArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to create container" -ForegroundColor Red
    exit 1
}

Write-Host "Container created and started" -ForegroundColor Green

# Wait for PostgreSQL to be ready
Write-Host ""
Write-Host "Waiting for PostgreSQL to be ready..."
Start-Sleep -Seconds 5

$maxRetries = 30
$retryCount = 0

while ($retryCount -lt $maxRetries) {
    $null = podman exec $ContainerName pg_isready -U $PostgresUsername -d $PostgresDatabase 2>$null
    if ($LASTEXITCODE -eq 0) {
        break
    }
    $retryCount++
    Write-Host "  Waiting... ($retryCount/$maxRetries)"
    Start-Sleep -Seconds 2
}

if ($retryCount -ge $maxRetries) {
    Write-Host "Error: PostgreSQL did not become ready in time." -ForegroundColor Red
    exit 1
}

Write-Host "PostgreSQL is ready" -ForegroundColor Green

# Initialize the database schema
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$initSql = Join-Path $scriptDir "init-db.sql"

if (Test-Path $initSql) {
    Write-Host ""
    Write-Host "Initializing database schema..."
    Get-Content $initSql | podman exec -i $ContainerName psql -U $PostgresUsername -d $PostgresDatabase
    Write-Host "Database schema initialized" -ForegroundColor Green
}
else {
    Write-Host "Warning: init-db.sql not found at $initSql" -ForegroundColor Yellow
    Write-Host "You will need to run the schema initialization manually."
}

# Generate encryption key
$keyBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($keyBytes)
$newKey = [System.BitConverter]::ToString($keyBytes) -replace '-', ''
$newKey = $newKey.ToLower()

Write-Host ""
Write-Host "Generated new encryption key:" -ForegroundColor Yellow
Write-Host $newKey
Write-Host ""
Write-Host "Add this to your .env.local file:"
Write-Host "ENCRYPTION_KEY=$newKey"

# Output configuration
Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Container: $ContainerName"
Write-Host "Port: $PostgresPort"
Write-Host "Database: $PostgresDatabase"
Write-Host "Username: $PostgresUsername"
Write-Host ""
Write-Host "Add these environment variables to your .env.local file:"
Write-Host ""
Write-Host "MULTI_USER_ENABLED=true"
Write-Host "NEXT_PUBLIC_MULTI_USER_ENABLED=true"
Write-Host "POSTGRES_HOST=localhost"
Write-Host "POSTGRES_PORT=$PostgresPort"
Write-Host "POSTGRES_DATABASE=$PostgresDatabase"
Write-Host "POSTGRES_USERNAME=$PostgresUsername"
Write-Host "POSTGRES_PASSWORD=$PostgresPassword"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  podman start $ContainerName   # Start the container"
Write-Host "  podman stop $ContainerName    # Stop the container"
Write-Host "  podman logs $ContainerName    # View logs"
Write-Host "  podman exec -it $ContainerName psql -U $PostgresUsername -d $PostgresDatabase  # Connect to database"
Write-Host ""
Write-Host "Volume management:"
Write-Host "  podman volume ls              # List volumes"
Write-Host "  podman volume inspect $VolumeName  # Inspect the data volume"
Write-Host "  podman volume rm $VolumeName  # Remove the data volume (WARNING: deletes all data)"
Write-Host ""
