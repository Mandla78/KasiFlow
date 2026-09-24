-- Akayza: create the database role and databases (PostgreSQL 16+).
--
-- Run ONCE per laptop, as the postgres admin user, from the repo root:
--
--   psql -U postgres -h localhost -v app_password="YOUR-DB-PASSWORD" -f backend/scripts/setup_db.sql
--
-- Safe to run again: it only creates what is missing, never drops or
-- changes anything. Use the same password in backend/.env
-- (POSTGRES_PASSWORD). Schemas and tables are NOT created here: run
-- `flask db upgrade` afterwards, which builds them from the migrations.

\set ON_ERROR_STOP on

SELECT format('CREATE ROLE akayza LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'akayza')
\gexec

SELECT 'CREATE DATABASE akayza_dev OWNER akayza'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'akayza_dev')
\gexec

SELECT 'CREATE DATABASE akayza_test OWNER akayza'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'akayza_test')
\gexec

\echo 'Done: role akayza, databases akayza_dev and akayza_test are ready. Next: flask db upgrade'
