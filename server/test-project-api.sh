#!/bin/bash

# Server URL
SERVER_URL="http://localhost:5000"
TOKEN_FILE="auth_token.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Dance Flow API - Projects Module${NC}"

# Login and get token
echo -e "\n${BLUE}Logging in to get auth token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $SERVER_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}')

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get token. Login response: $LOGIN_RESPONSE${NC}"
  exit 1
else
  echo -e "${GREEN}Successfully authenticated${NC}"
  echo $TOKEN > $TOKEN_FILE
  echo -e "${BLUE}Token saved to $TOKEN_FILE${NC}"
fi

# Test GET all projects
echo -e "\n${BLUE}Getting all projects...${NC}"
curl -s -X GET $SERVER_URL/api/projects \
  -H "Authorization: Bearer $TOKEN" | jq

# Test Create project
echo -e "\n${BLUE}Creating a new project...${NC}"
PROJECT_RESPONSE=$(curl -s -X POST $SERVER_URL/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Project","description":"Created for API testing","isPrivate":false,"tags":["test","api"],"title":"Test API Project"}')

echo $PROJECT_RESPONSE | jq

# Extract project ID from response
PROJECT_ID=$(echo $PROJECT_RESPONSE | grep -o '"_id":"[^"]*' | sed 's/"_id":"//')

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Failed to extract project ID${NC}"
else
  # Test GET specific project
  echo -e "\n${BLUE}Getting project with ID $PROJECT_ID...${NC}"
  curl -s -X GET $SERVER_URL/api/projects/$PROJECT_ID \
    -H "Authorization: Bearer $TOKEN" | jq
    
  # Test UPDATE project
  echo -e "\n${BLUE}Updating project...${NC}"
  curl -s -X PUT $SERVER_URL/api/projects/$PROJECT_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Updated Test Project","description":"Updated for API testing"}' | jq
    
  # Test DELETE project
  echo -e "\n${BLUE}Deleting project...${NC}"
  curl -s -X DELETE $SERVER_URL/api/projects/$PROJECT_ID \
    -H "Authorization: Bearer $TOKEN" | jq
fi

echo -e "\n${GREEN}Testing complete!${NC}" 