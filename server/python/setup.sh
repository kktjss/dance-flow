#!/bin/bash
# Скрипт установки для Dance Flow Video Analyzer Backend

echo "Setting up Dance Flow Video Analyzer Backend..."

# Создание виртуального окружения
echo "Creating Python virtual environment..."
python3 -m venv venv

# Активация виртуального окружения
echo "Activating virtual environment..."
source venv/bin/activate

# Сначала установка базовых требований для сборки
echo "Installing build dependencies..."
pip install --upgrade pip wheel setuptools

# Установка зависимостей поэтапно для лучшего управления конфликтами
echo "Installing core dependencies..."
pip install fastapi uvicorn python-multipart

echo "Installing numpy and OpenCV..."
pip install numpy opencv-python

echo "Installing MediaPipe (this may take a while)..."
pip install --extra-index-url https://google-coral.github.io/py-repo/ mediapipe==0.10.5

echo "Installing remaining dependencies..."
pip install -r requirements.txt

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