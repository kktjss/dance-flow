#!/bin/bash

# Функция для замены импортов в файлах
fix_imports() {
  echo "Исправление импортов в $1"
  # Заменяем импорт dance-flow/server/go/ на github.com/kktjss/dance-flow/
  sed -i 's|"dance-flow/server/go/|"github.com/kktjss/dance-flow/|g' "$1"
}

# Находим все Go файлы в директориях тестов и исправляем импорты
find . -name "*.go" -type f | while read -r file; do
  fix_imports "$file"
done

echo "Импорты исправлены во всех файлах." 