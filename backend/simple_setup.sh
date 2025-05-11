#!/bin/bash
# Simple setup script for Dance Flow Video Analyzer Backend

echo "Setting up Dance Flow Video Analyzer Backend..."

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install critical dependencies directly
echo "Installing core dependencies..."
pip install --upgrade pip wheel setuptools

# Install MediaPipe and OpenCV separately
echo "Installing MediaPipe and OpenCV..."
pip install mediapipe==0.10.5 opencv-python

# Install FastAPI components
echo "Installing FastAPI and dependencies..."
pip install fastapi uvicorn python-multipart

# Install utilities
echo "Installing utilities..."
pip install psutil

# Create model directory if it doesn't exist
echo "Creating model directory..."
mkdir -p .models

echo ""
echo "Setup complete!"
echo "To run the backend server:"
echo "  1. Activate the virtual environment: source venv/bin/activate"
echo "  2. Run the server: python run_server.py"
echo ""
echo "The server will be available at http://localhost:8000" 