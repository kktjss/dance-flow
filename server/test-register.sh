#!/bin/bash

# Server URL
SERVER_URL="http://localhost:5000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Registering new test user${NC}"

# Generate a unique username and email
TIMESTAMP=$(date +%s)
USERNAME="testuser${TIMESTAMP}"
EMAIL="test${TIMESTAMP}@example.com"
PASSWORD="password123"

echo -e "${BLUE}Registering user: ${USERNAME} / ${EMAIL}${NC}"

# Register user
REGISTER_RESPONSE=$(curl -s -X POST $SERVER_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"name\":\"Test User\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

echo $REGISTER_RESPONSE | jq

# Check if registration was successful
if echo $REGISTER_RESPONSE | grep -q "id"; then
  echo -e "${GREEN}Registration successful!${NC}"
  
  # Try to login with the new credentials
  echo -e "\n${BLUE}Logging in with new credentials...${NC}"
  LOGIN_RESPONSE=$(curl -s -X POST $SERVER_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")
  
  echo $LOGIN_RESPONSE | jq
  
  # Extract token
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')
  
  if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to get token after registration${NC}"
  else
    echo -e "${GREEN}Successfully logged in with new user${NC}"
    echo $TOKEN > auth_token.txt
    echo -e "${BLUE}Token saved to auth_token.txt${NC}"
  fi
else
  echo -e "${RED}Registration failed${NC}"
fi 