#!/bin/bash

# Go to the correct directory
cd "$(dirname "$0")/go"

# Show menu
echo "======================================"
echo "Login Debug Tool"
echo "======================================"
echo "1) Test MongoDB connection"
echo "2) Create test user"
echo "3) Test login API"
echo "4) Run Go server with debug mode"
echo "5) Exit"
echo "======================================"
read -p "Enter your choice: " choice

case $choice in
  1)
    echo "======================================"
    echo "MongoDB Connection Test"
    echo "======================================"
    go run test-login.go
    ;;
  2)
    echo "======================================"
    echo "Creating Test User"
    echo "======================================"
    go run test-create-user.go
    ;;
  3)
    echo "======================================"
    echo "Auth API Test"
    echo "======================================"
    echo "Trying to login with test user..."
    go run test-auth.go
    ;;
  4)
    echo "======================================"
    echo "Running Go Server in Debug Mode"
    echo "======================================"
    cd ..
    bash run-server-debug.sh
    ;;
  5)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo "Invalid option"
    ;;
esac

echo ""
echo "======================================"
echo "Troubleshooting Tips:"
echo "======================================"
echo "1. If MongoDB connection fails, check if MongoDB is running with:"
echo "   sudo systemctl status mongod"
echo ""
echo "2. If you can connect to MongoDB but login fails, make sure you've created a test user."
echo ""
echo "3. If the test user exists but login still fails, check the database for the correct format:"
echo "   - MongoDB collection name should be 'users'"
echo "   - Username field should be 'username'"
echo "   - Password should be hashed with bcrypt"
echo ""
echo "4. Compare with JavaScript version by running:"
echo "   cd ../server_backup && npm start" 