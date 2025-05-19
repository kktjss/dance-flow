#!/bin/bash
# Простой скрипт установки для Dance Flow Video Analyzer Backend

echo "Setting up Dance Flow Video Analyzer Backend..."

# Создание виртуального окружения
echo "Creating Python virtual environment..."
python3 -m venv venv

# Активация виртуального окружения
echo "Activating virtual environment..."
source venv/bin/activate

# Установка критически важных зависимостей напрямую
echo "Installing core dependencies..."
pip install --upgrade pip wheel setuptools

# Установка MediaPipe и OpenCV отдельно
echo "Installing MediaPipe and OpenCV..."
pip install mediapipe==0.10.5 opencv-python

# Установка компонентов FastAPI
echo "Installing FastAPI and dependencies..."
pip install fastapi uvicorn python-multipart

# Установка утилит
echo "Installing utilities..."
pip install psutil

# Создание директории для моделей, если она не существует
echo "Creating model directory..."
mkdir -p .models

echo ""
echo "Setup complete!"
echo "To run the backend server:"
echo "  1. Activate the virtual environment: source venv/bin/activate"
echo "  2. Run the server: python run_server.py"
echo ""
echo "The server will be available at http://localhost:8000" 