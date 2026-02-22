# Refactor Database Layer

## Overview

Migrate from raw SQL queries to an ORM for better type safety and maintainability.

## Step 1: Setup ORM

### Overview

Install and configure Drizzle ORM with the existing PostgreSQL database.

### File Changes

- **src/db/schema.ts**: Define database schema using Drizzle table definitions
- **src/db/client.ts**: Create the database client connection pool
- **drizzle.config.ts**: Drizzle CLI configuration for migrations

### Success Criteria:

#### Automated Verification:
- [ ] Schema generates valid SQL: `npx drizzle-kit generate`

## Step 2: Migrate Queries

### Overview

Replace all raw SQL queries with Drizzle query builder calls.

### File Changes

- **src/repositories/users.ts**: Migrate user queries to Drizzle
- **src/repositories/posts.ts**: Migrate post queries to Drizzle
- **src/repositories/comments.ts**: Migrate comment queries to Drizzle

### Success Criteria:

#### Automated Verification:
- [ ] All existing tests pass: `npm test`

#### Manual Verification:
- [ ] API responses unchanged
