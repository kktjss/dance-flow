#!/bin/bash

# Функция для остановки всех серверов при выходе
function cleanup {
    echo "Останавливаем серверы..."
    kill $GO_PID 2>/dev/null
    kill $PYTHON_PID 2>/dev/null
    exit
}

# Регистрируем обработчик для SIGINT (Ctrl+C)
trap cleanup SIGINT SIGTERM

echo "Запускаем Dance Flow серверы..."

# Запускаем Go сервер в фоновом режиме
echo "Запускаем Go API сервер..."
cd go
go run main.go &
GO_PID=$!
cd ..

# Проверяем, запустился ли Go сервер
if [ $? -ne 0 ]; then
    echo "Ошибка при запуске Go сервера!"
    cleanup
fi

# Ждем немного, чтобы Go сервер успел запуститься
sleep 2
echo "Go API сервер запущен на порту 5000"

# Запускаем Python сервер в фоновом режиме
echo "Запускаем Python сервер анализа видео..."
cd python
python3.12 -m uvicorn video_analyzer.detector:app --host 0.0.0.0 --port 8000 &
PYTHON_PID=$!
cd ..

# Проверяем, запустился ли Python сервер
if [ $? -ne 0 ]; then
    echo "Ошибка при запуске Python сервера!"
    cleanup
fi

# Ждем немного, чтобы Python сервер успел запуститься
sleep 2
echo "Python сервер анализа видео запущен на порту 8000"

echo "Все серверы запущены!"
echo "Нажмите Ctrl+C для остановки серверов"

# Ждем, пока пользователь не нажмет Ctrl+C
wait