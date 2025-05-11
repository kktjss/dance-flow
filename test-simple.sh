#!/bin/bash

# Server URL
SERVER_URL="http://localhost:5000"
TOKEN=$(cat auth_token.txt)

echo "Testing with token: $TOKEN"

# Test GET all projects
echo -e "\nGetting all projects..."
curl -s -X GET $SERVER_URL/api/projects \
  -H "Authorization: Bearer $TOKEN"

# Test Create project
echo -e "\n\nCreating a new project..."
PROJECT_RESPONSE=$(curl -s -X POST $SERVER_URL/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Project","description":"Created for API testing","isPrivate":false,"tags":["test","api"],"title":"Test API Project"}')

echo $PROJECT_RESPONSE

# Extract project ID from response
PROJECT_ID=$(echo $PROJECT_RESPONSE | grep -o '"_id":"[^"]*' | sed 's/"_id":"//')

echo -e "\n\nProject ID: $PROJECT_ID"

# Test GET specific project
echo -e "\nGetting project with ID $PROJECT_ID..."
curl -s -X GET $SERVER_URL/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN"
  
# Test UPDATE project
echo -e "\n\nUpdating project..."
curl -s -X PUT $SERVER_URL/api/projects/$PROJECT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Updated Test Project","description":"Updated for API testing"}'
  
# Test DELETE project
echo -e "\n\nDeleting project..."
curl -s -X DELETE $SERVER_URL/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\nTesting complete!" 