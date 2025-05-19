#!/bin/bash

# Включение режима отладки Gin
export GIN_MODE=debug

# Явная установка URI MongoDB (измените, если ваша конфигурация отличается)
export MONGODB_URI="mongodb://localhost:27017/dance-platform"

# Установка известного секретного ключа JWT
export JWT_SECRET="debug-secret-key-for-testing"

# Переход в директорию server/go и запуск сервера
cd "$(dirname "$0")/go"
echo "Starting Go server with debug settings..."
echo "MongoDB URI: $MONGODB_URI"
echo "JWT Secret: [set]"
echo "GIN Mode: $GIN_MODE"
echo "Current directory: $(pwd)"
echo "----------------------------"

# Убедимся, что мы находимся в правильной директории
if [ ! -d "uploads" ]; then
    echo "Error: uploads directory not found in $(pwd)"
    exit 1
fi

go run main.go 