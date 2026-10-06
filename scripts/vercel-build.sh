#!/bin/sh
# Vercel runs `vercel-build` instead of `build` when it exists.
# Production deploys apply migrations before the new build goes live (over the direct, unpooled
# connection; see drizzle.config.ts) and seed only an empty database. A failure stops the deploy,
# so the previous version keeps serving. Preview/dev builds never touch the database.
set -e
if [ "$VERCEL_ENV" = "production" ]; then
  echo "▶ production build: applying migrations"
  pnpm db:migrate
  echo "▶ seeding if empty"
  pnpm db:seed:if-empty
fi
pnpm build
