FROM postgres:16-alpine

# Replace these placeholders here or override them at runtime with `docker run -e` / docker-compose.
ENV POSTGRES_DB=your-db-name \
    POSTGRES_USER=your-db-user \
    POSTGRES_PASSWORD=your-db-password

COPY 001_initial_schema.sql /docker-entrypoint-initdb.d/01-init.sql
COPY 002_seed_services.sql /docker-entrypoint-initdb.d/02-seed-services.sql

EXPOSE 5432

