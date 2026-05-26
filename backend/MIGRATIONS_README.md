# Database Migrations Quickstart (Windows / PowerShell)

These steps use psql to apply the latest schema updates needed by the app.

## Prerequisites
- PostgreSQL installed and `psql` available on your PATH
- Database connection info (host, port, user, password, db name)
  - Defaults from backend/config/database.js
    - host: localhost
    - port: 5432
    - user: postgres
    - password: password
    - database: civic_issues

## 1) Add admin work area columns (work_latitude/work_longitude)
```powershell
$env:PGPASSWORD = "password"
psql -h localhost -p 5432 -U postgres -d civic_issues -f backend/migrations/003_add_user_work_area.sql
```

## 2) Add citizen home location columns (home_latitude/home_longitude)
```powershell
$env:PGPASSWORD = "password"
psql -h localhost -p 5432 -U postgres -d civic_issues -f backend/migrations/005_add_user_home_location.sql
```

## 3) Create issue upvotes table
```powershell
$env:PGPASSWORD = "password"
psql -h localhost -p 5432 -U postgres -d civic_issues -f backend/migrations/006_create_issue_upvotes.sql
```

## Verify columns
```powershell
psql -h localhost -p 5432 -U postgres -d civic_issues -c "\d+ users"
```
Ensure you see work_latitude, work_longitude, home_latitude, home_longitude.

## Verify upvotes table
```powershell
psql -h localhost -p 5432 -U postgres -d civic_issues -c "\d+ issue_upvotes"
```

## 4) Restart backend
After applying migrations, restart your backend server so code and schema are in sync.

## 5) Smoke tests
- Health check:
  - http://localhost:5000/api/health
- Login payload should include workLatitude/workLongitude and homeLatitude/homeLongitude when set
- Issues endpoint with radius filter:
  - http://localhost:5000/api/issues?center=12.97,77.59&radius_m=5000

## Troubleshooting
- If login failed with: `column u.work_latitude does not exist`, migrations weren’t applied or you’re on a different DB.
- If frontend shows `Failed to fetch`, confirm backend is running on port 5000 and CORS origin matches (FRONTEND_URLS).
