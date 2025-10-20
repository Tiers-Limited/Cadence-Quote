@echo off
REM Run Milestone 2 Database Migration (Windows)
REM This script runs the database migration for Milestone 2 features

echo Running Milestone 2 database migration...
echo Database: postgres (AWS RDS)
echo Host: database-1.cl2s6c0i4out.eu-north-1.rds.amazonaws.com
echo User: postgres
echo Make sure AWS RDS instance is accessible and credentials are correct.
echo.

REM Run the migration using AWS RDS connection
psql -h database-1.cl2s6c0i4out.eu-north-1.rds.amazonaws.com -U postgres -d postgres -f migrations/003-create-milestone2-tables.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Migration completed successfully!
    echo.
    echo Created tables:
    echo   - products (paint catalog)
    echo   - contractor_settings (global defaults)
    echo   - pricing_schemes (calculation models)
    echo   - lead_forms (form configurations)
    echo   - leads (lead submissions)
    echo.
    echo Also inserted default products for all tenants.
    echo.
    echo You can now start the backend server with: npm start
) else (
    echo.
    echo ❌ Migration failed. Please check:
    echo   1. AWS RDS instance is running and accessible
    echo   2. Database 'postgres' exists on RDS
    echo   3. User 'postgres' has access to RDS
    echo   4. Password is correct (check .env file)
    echo   5. Network connectivity to AWS RDS
    echo.
    pause
    exit /b 1
)