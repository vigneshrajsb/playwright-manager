# -*- mode: Python -*-

# ============================================================================
# Playwright Test Manager - Tilt Configuration
# ============================================================================

# Load docker-compose for development
docker_compose('./docker-compose.dev.yml')

# Build dashboard image
# Note: Hot reload is provided by docker-compose volume mount, not Tilt live_update
docker_build(
    'pw-apps-dashboard',
    './apps/dashboard',
    dockerfile='./apps/dashboard/Dockerfile.dev',
    ignore=[
        '.next',
        'node_modules',
        '.git',
        '*.log',
        '.turbo',
    ],
)

# Configure resources
dc_resource('db', labels=['database'])
dc_resource(
    'dashboard',
    labels=['app'],
    resource_deps=['db'],
)

# Database migrations
local_resource(
    'db-push',
    cmd='cd apps/dashboard && pnpm db:push',
    labels=['database'],
    resource_deps=['db'],
    auto_init=False,
)

# Database seeding
local_resource(
    'db-seed',
    cmd='cd apps/dashboard && pnpm db:seed',
    labels=['database'],
    resource_deps=['db'],
    auto_init=False,
)

# Drizzle Studio (database GUI)
local_resource(
    'db-studio',
    serve_cmd='cd apps/dashboard && pnpm db:studio',
    labels=['database'],
    resource_deps=['db'],
    auto_init=False,
)

# ============================================================================
# Usage Instructions
# ============================================================================
#
# Start everything:
#   tilt up
#
# Run migrations (push schema to DB):
#   Click 'db-push' trigger in Tilt UI, or:
#   cd apps/dashboard && pnpm db:push
#
# Seed database:
#   Click 'db-seed' trigger in Tilt UI, or:
#   cd apps/dashboard && pnpm db:seed
#
# Open Drizzle Studio:
#   Enable 'db-studio' in Tilt UI, or:
#   cd apps/dashboard && pnpm db:studio
#
# Access dashboard:
#   http://localhost:3031
#
