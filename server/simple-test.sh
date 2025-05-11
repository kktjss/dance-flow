#!/bin/bash
SERVER_URL="http://localhost:5000"
echo "Testing projects API..."
curl -X GET $SERVER_URL/health

echo "Step 1: Creating a test user..."
TIMESTAMP=$(date +%s)
USERNAME="testuser${TIMESTAMP}"
EMAIL="test${TIMESTAMP}@example.com"
PASSWORD="password123"
echo "Registering user: $USERNAME / $EMAIL"
curl -s -X POST $SERVER_URL/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"${USERNAME}\",\"name\":\"Test User\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"

echo "Step 2: Logging in with new user..."
LOGIN_RESPONSE=$(curl -s -X POST $SERVER_URL/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")
echo $LOGIN_RESPONSE
TOKEN=$(echo $LOGIN_RESPONSE | grep -o "\"token\":\"[^\"]*" | sed "s/\"token\":\"//")
echo "Token: $TOKEN"

echo "Step 3: Creating a project..."
PROJECT_RESPONSE=$(curl -s -X POST $SERVER_URL/api/projects -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"Test Project","description":"Created for API testing","isPrivate":false,"tags":["test","api"],"title":"Test API Project"}')
echo $PROJECT_RESPONSE
PROJECT_ID=$(echo $PROJECT_RESPONSE | grep -o "\"_id\":\"[^\"]*" | sed "s/\"_id\":\"//")
echo "Project ID: $PROJECT_ID"

echo "Step 4: Getting project details..."
curl -s -X GET $SERVER_URL/api/projects/$PROJECT_ID -H "Authorization: Bearer $TOKEN"

echo "Step 5: Updating project..."
curl -s -X PUT $SERVER_URL/api/projects/$PROJECT_ID -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"Updated Test Project","description":"Updated for API testing"}'

echo "Step 6: Deleting project..."
curl -s -X DELETE $SERVER_URL/api/projects/$PROJECT_ID -H "Authorization: Bearer $TOKEN"

echo "Testing complete!"
