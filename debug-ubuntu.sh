#!/bin/bash

echo "Building Ubuntu debug environment..."
docker compose -f docker-compose.debug.yml build

echo "Starting Ubuntu debug environment..."
docker compose -f docker-compose.debug.yml up -d

echo "Waiting for container to be ready..."
sleep 5

echo "Container is running. You can now SSH into it:"
echo "ssh -p 2222 root@localhost"
echo "Password: password"
echo ""
echo "Once connected, run:"
echo "cd /app && bun test"
echo ""
echo "To stop the container, run:"
echo "docker compose -f docker-compose.debug.yml down"