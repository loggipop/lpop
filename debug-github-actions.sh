#!/bin/bash

echo "Building GitHub Actions exact environment..."
docker compose -f docker-compose.github.yml build ubuntu-exact

echo "Starting GitHub Actions environment..."
docker compose -f docker-compose.github.yml up -d ubuntu-exact

echo "Waiting for container to be ready..."
sleep 5

echo "GitHub Actions environment is running!"
echo ""
echo "SSH into it with:"
echo "ssh -p 2224 runner@localhost"
echo "Password: password"
echo ""
echo "Then run tests:"
echo "cd /home/runner/work/lpop/lpop && bun test"
echo ""
echo "To stop:"
echo "docker compose -f docker-compose.github.yml down"