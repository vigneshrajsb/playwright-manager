# -*- mode: Python -*-

docker_compose('./docker-compose.dev.yml')

docker_build(
    'pw-apps-dashboard',
    '.',
    dockerfile='./apps/dashboard/Dockerfile.dev',
    ignore=[
        '.next',
        'node_modules',
        '.git',
        '*.log',
        '.turbo',
        'charts',
        'specs',
    ],
    live_update=[
        sync('./apps/dashboard/app', '/app/apps/dashboard/app'),
        sync('./apps/dashboard/components', '/app/apps/dashboard/components'),
        sync('./apps/dashboard/lib', '/app/apps/dashboard/lib'),
        sync('./apps/dashboard/hooks', '/app/apps/dashboard/hooks'),
        sync('./apps/dashboard/types', '/app/apps/dashboard/types'),
        sync('./apps/dashboard/public', '/app/apps/dashboard/public'),
        run(
            'cd /app && pnpm install --filter @playwright-manager/dashboard',
            trigger=['./apps/dashboard/package.json']
        ),
    ],
)

dc_resource('db', labels=['database'])
dc_resource('minio', labels=['storage'])
dc_resource('minio-init', labels=['storage'], resource_deps=['minio'])
dc_resource('dashboard', labels=['app'], resource_deps=['db', 'minio-init'])

local_resource(
    'db-push',
    cmd='cd apps/dashboard && pnpm db:push',
    labels=['database'],
    resource_deps=['db'],
    auto_init=False,
)

local_resource(
    'db-seed',
    cmd='cd apps/dashboard && pnpm db:seed',
    labels=['database'],
    resource_deps=['db'],
    auto_init=False,
)

local_resource(
    'db-studio',
    serve_cmd='cd apps/dashboard && pnpm db:studio',
    labels=['database'],
    resource_deps=['db'],
    auto_init=False,
)

# Usage:
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
# Access MinIO Console (S3 storage):
#   http://localhost:9001
#   Login: minioadmin / minioadmin
#   Bucket: playwright-reports
#
