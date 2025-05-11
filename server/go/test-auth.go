package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

// LoginRequest represents the login request body
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	User  interface{} `json:"user"`
	Token string      `json:"token"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

func main() {
	// Set the server URL
	serverURL := "http://localhost:5000"
	if os.Getenv("SERVER_URL") != "" {
		serverURL = os.Getenv("SERVER_URL")
	}

	// Test health endpoint first
	fmt.Println("Testing health endpoint...")
	resp, err := http.Get(serverURL + "/health")
	if err != nil {
		log.Fatalf("Failed to connect to server: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Failed to read response body: %v", err)
	}

	fmt.Printf("Health check status: %d\nResponse: %s\n\n", resp.StatusCode, string(body))

	// Test auth test endpoint
	fmt.Println("Testing auth test endpoint...")
	resp, err = http.Get(serverURL + "/api/auth/test")
	if err != nil {
		log.Fatalf("Failed to connect to auth test endpoint: %v", err)
	}
	defer resp.Body.Close()

	body, err = io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Failed to read response body: %v", err)
	}

	fmt.Printf("Auth test status: %d\nResponse: %s\n\n", resp.StatusCode, string(body))

	// Create a login request
	fmt.Println("Testing login...")
	
	// Use a test account or create one if needed
	username := "testuser"
	password := "password123"
	
	if os.Getenv("TEST_USERNAME") != "" {
		username = os.Getenv("TEST_USERNAME")
	}
	
	if os.Getenv("TEST_PASSWORD") != "" {
		password = os.Getenv("TEST_PASSWORD")
	}
	
	loginReq := LoginRequest{
		Username: username,
		Password: password,
	}
	
	jsonData, err := json.Marshal(loginReq)
	if err != nil {
		log.Fatalf("Failed to marshal login request: %v", err)
	}
	
	// Set timeout for the request
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	
	// Make the login request
	req, err := http.NewRequest("POST", serverURL+"/api/auth/login", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Fatalf("Failed to create request: %v", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	// Send the request
	fmt.Printf("Attempting to login with username: %s\n", username)
	resp, err = client.Do(req)
	if err != nil {
		log.Fatalf("Login request failed: %v", err)
	}
	defer resp.Body.Close()
	
	// Read the response
	body, err = io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Failed to read login response: %v", err)
	}
	
	// Check the response status
	fmt.Printf("Login status: %d\n", resp.StatusCode)
	
	if resp.StatusCode == http.StatusOK {
		var loginResp LoginResponse
		if err := json.Unmarshal(body, &loginResp); err != nil {
			fmt.Printf("Failed to parse login response: %v\n", err)
			fmt.Printf("Raw response: %s\n", string(body))
		} else {
			fmt.Printf("Login successful! Token received.\n")
			fmt.Printf("User: %v\n", loginResp.User)
		}
	} else {
		var errorResp ErrorResponse
		if err := json.Unmarshal(body, &errorResp); err != nil {
			fmt.Printf("Failed to parse error response: %v\n", err)
			fmt.Printf("Raw response: %s\n", string(body))
		} else {
			fmt.Printf("Login failed: %s\n", errorResp.Error)
		}
	}
} 