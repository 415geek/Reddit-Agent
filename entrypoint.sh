#!/bin/sh
set -e
echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy
echo "Migrations complete. Starting app..."
exec node server.js
