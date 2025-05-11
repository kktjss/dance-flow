#!/bin/bash
# Setup script for Dance Flow Video Analyzer Backend

echo "Setting up Dance Flow Video Analyzer Backend..."

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install base build requirements first
echo "Installing build dependencies..."
pip install --upgrade pip wheel setuptools

# Install dependencies in stages to better handle conflicts
echo "Installing core dependencies..."
pip install fastapi uvicorn python-multipart

echo "Installing numpy and OpenCV..."
pip install numpy opencv-python

echo "Installing MediaPipe (this may take a while)..."
pip install --extra-index-url https://google-coral.github.io/py-repo/ mediapipe==0.10.5

echo "Installing remaining dependencies..."
pip install -r requirements.txt

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