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

# Generate a unique username and email for testing
TIMESTAMP=$(date +%s)
USERNAME="testuser${TIMESTAMP}"
EMAIL="test${TIMESTAMP}@example.com"
PASSWORD="password123"

# Step 1: Register a new user
echo -e "\n${BLUE}Step 1: Registering new test user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST $SERVER_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"name\":\"Test User\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

echo $REGISTER_RESPONSE | jq

# Step 2: Login with new user
echo -e "\n${BLUE}Step 2: Logging in with new user...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $SERVER_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

echo $LOGIN_RESPONSE | jq

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

# Step 3: Get all projects (should be empty initially)
echo -e "\n${BLUE}Step 3: Getting all projects (should be empty)...${NC}"
curl -s -X GET $SERVER_URL/api/projects \
  -H "Authorization: Bearer $TOKEN" | jq

# Step 4: Create a new project
echo -e "\n${BLUE}Step 4: Creating a new project...${NC}"
PROJECT_RESPONSE=$(curl -s -X POST $SERVER_URL/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Project","description":"Created for API testing","isPrivate":false,"tags":["test","api"],"title":"Test API Project"}')

echo $PROJECT_RESPONSE | jq

# Extract project ID from response
PROJECT_ID=$(echo $PROJECT_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Failed to extract project ID${NC}"
  exit 1
fi

# Step 5: Get all projects (should now have one)
echo -e "\n${BLUE}Step 5: Getting all projects (should have one)...${NC}"
curl -s -X GET $SERVER_URL/api/projects \
  -H "Authorization: Bearer $TOKEN" | jq

# Step 6: Get specific project
echo -e "\n${BLUE}Step 6: Getting project with ID $PROJECT_ID...${NC}"
curl -s -X GET $SERVER_URL/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" | jq
  
# Step 7: Update project
echo -e "\n${BLUE}Step 7: Updating project...${NC}"
curl -s -X PUT $SERVER_URL/api/projects/$PROJECT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Updated Test Project","description":"Updated for API testing","videoUrl":"https://example.com/video.mp4","tags":["test","api","updated"],"isPrivate":true}' | jq
  
# Step 8: Get updated project
echo -e "\n${BLUE}Step 8: Getting updated project...${NC}"
curl -s -X GET $SERVER_URL/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" | jq
  
# Step 9: Delete project
echo -e "\n${BLUE}Step 9: Deleting project...${NC}"
curl -s -X DELETE $SERVER_URL/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" | jq

# Step 10: Verify project is deleted
echo -e "\n${BLUE}Step 10: Verifying project is deleted...${NC}"
DELETE_VERIFY=$(curl -s -X GET $SERVER_URL/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN")

if echo $DELETE_VERIFY | grep -q "not found"; then
  echo -e "${GREEN}Project successfully deleted${NC}"
else
  echo -e "${RED}Project may not have been deleted properly${NC}"
  echo $DELETE_VERIFY | jq
fi

echo -e "\n${GREEN}Testing complete!${NC}" 