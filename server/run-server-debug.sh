#!/bin/bash

# Enable Gin debug mode
export GIN_MODE=debug

# Set MongoDB URI explicitly (update if yours is different)
export MONGODB_URI="mongodb://localhost:27017/dance-platform"

# Set a known JWT secret
export JWT_SECRET="debug-secret-key-for-testing"

# Go to the server/go directory and run the server
cd "$(dirname "$0")/go"
echo "Starting Go server with debug settings..."
echo "MongoDB URI: $MONGODB_URI"
echo "JWT Secret: [set]"
echo "GIN Mode: $GIN_MODE"
echo "----------------------------"
go run main.go 