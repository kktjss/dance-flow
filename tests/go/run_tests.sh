#!/bin/bash

# Скрипт для запуска Go тестов с различными опциями
# Использование: ./run_tests.sh [тип_тестов] [опции]

set -e

# Переходим в директорию Go тестов
cd "$(dirname "$0")"

# Проверяем, что go.mod существует
if [ ! -f "go.mod" ]; then
  echo "❌ Ошибка: go.mod не найден. Запустите скрипт из директории tests/go"
  exit 1
fi

# Определяем цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Функция для вывода цветного текста
print_status() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${PURPLE}ℹ️  $1${NC}"
}

# Показываем справку
show_help() {
    echo "Использование: $0 [ТИП_ТЕСТОВ] [ОПЦИИ]"
    echo ""
    echo "Типы тестов:"
    echo "  unit         - Только unit тесты"
    echo "  integration  - Только интеграционные тесты"
    echo "  e2e          - Только E2E тесты"
    echo "  performance  - Только тесты производительности"
    echo "  separate     - Только отдельные тесты (отдельный модуль)"
    echo "  all          - Все тесты (по умолчанию)"
    echo ""
    echo "Опции:"
    echo "  -v, --verbose     - Подробный вывод"
    echo "  -c, --coverage    - Сбор покрытия кода"
    echo "  -r, --race        - Детекция гонок (race conditions)"
    echo "  -b, --bench       - Запуск бенчмарков"
    echo "  -s, --short       - Короткие тесты (пропуск длительных)"
    echo "  --cleanup         - Очистка тестовых данных"
    echo "  -h, --help        - Показать эту справку"
    echo ""
    echo "Переменные окружения:"
    echo "  MONGO_TEST_URI           - URI для тестовой MongoDB"
    echo "  TEST_API_URL             - URL для тестирования API"
    echo "  RUN_PERFORMANCE_TESTS    - Включить тесты производительности"
    echo "  TEST_TIMEOUT             - Таймаут для тестов (по умолчанию 10m)"
}

# Парсим аргументы командной строки
TEST_TYPE="all"
VERBOSE=""
COVERAGE=""
RACE=""
BENCH=""
SHORT=""
CLEANUP=""
TIMEOUT="10m"

while [[ $# -gt 0 ]]; do
    case $1 in
        unit|integration|e2e|performance|separate|all)
            TEST_TYPE="$1"
            shift
            ;;
        -v|--verbose)
            VERBOSE="-v"
            shift
            ;;
        -c|--coverage)
            COVERAGE="-cover -coverprofile=coverage.out"
            shift
            ;;
        -r|--race)
            RACE="-race"
            shift
            ;;
        -b|--bench)
            BENCH="-bench=."
            shift
            ;;
        -s|--short)
            SHORT="-short"
            shift
            ;;
        --cleanup)
            CLEANUP="true"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Неизвестная опция: $1"
            show_help
            exit 1
            ;;
    esac
done

# Устанавливаем переменные окружения по умолчанию
export TEST_ENV=${TEST_ENV:-"test"}
export MONGO_TEST_URI=${MONGO_TEST_URI:-"mongodb://localhost:27017"}
export TEST_API_URL=${TEST_API_URL:-"http://localhost:5000"}
export TEST_TIMEOUT=${TEST_TIMEOUT:-$TIMEOUT}

print_info "Настройки тестирования:"
print_info "  Тип тестов: $TEST_TYPE"
print_info "  MongoDB URI: $MONGO_TEST_URI"
print_info "  API URL: $TEST_API_URL"
print_info "  Таймаут: $TEST_TIMEOUT"

# Функция очистки тестовых данных
cleanup_test_data() {
    if [ "$CLEANUP" = "true" ]; then
        print_status "Очистка тестовых данных..."
        # Удаляем временные файлы
        rm -rf tmp/* 2>/dev/null || true
        # Очищаем coverage файлы
        rm -f coverage.out coverage.html 2>/dev/null || true
        print_success "Тестовые данные очищены"
    fi
}

# Функция для подготовки тестовой среды
setup_test_environment() {
    print_status "Подготовка тестовой среды..."
    
    # Создаем директорию для временных файлов
    mkdir -p tmp
    
    # Синхронизируем зависимости
    print_status "Синхронизация зависимостей..."
    go mod tidy
    
    # Проверяем подключение к MongoDB (если тесты требуют БД)
    if [[ "$TEST_TYPE" == "integration" || "$TEST_TYPE" == "e2e" || "$TEST_TYPE" == "all" ]]; then
        print_status "Проверка подключения к MongoDB..."
        if ! timeout 5 bash -c "echo > /dev/tcp/localhost/27017" 2>/dev/null; then
            print_warning "MongoDB недоступна по адресу localhost:27017"
            print_warning "Интеграционные и E2E тесты могут быть пропущены"
        else
            print_success "MongoDB доступна"
        fi
    fi
}

# Функция для запуска определенного типа тестов
run_tests() {
    local test_path="$1"
    local test_name="$2"
    
    print_status "Запуск $test_name тестов..."
    
    # Формируем команду запуска тестов
    local cmd="go test"
    cmd="$cmd -timeout=$TEST_TIMEOUT"
    cmd="$cmd $VERBOSE"
    cmd="$cmd $COVERAGE"
    cmd="$cmd $RACE"
    cmd="$cmd $SHORT"
    cmd="$cmd $BENCH"
    cmd="$cmd $test_path"
    
    print_info "Команда: $cmd"
    
    if eval $cmd; then
        print_success "$test_name тесты прошли успешно!"
        return 0
    else
        print_error "$test_name тесты завершились с ошибкой!"
        return 1
    fi
}

# Функция для запуска отдельного модуля
run_separate_tests() {
    print_status "Запуск Отдельные тестов..."
    
    # Переходим в каталог separate (отдельный модуль)
    if [ ! -d "separate" ]; then
        print_warning "Каталог separate не найден, пропускаем отдельные тесты"
        return 0
    fi
    
    print_info "Переход в каталог separate..."
    cd separate
    
    # Проверяем наличие go.mod
    if [ ! -f "go.mod" ]; then
        print_error "go.mod не найден в каталоге separate"
        cd ..
        return 1
    fi
    
    # Синхронизируем зависимости отдельного модуля
    print_info "Синхронизация зависимостей отдельного модуля..."
    go mod tidy
    
    # Формируем команду запуска тестов для отдельного модуля
    local cmd="go test"
    cmd="$cmd -timeout=$TEST_TIMEOUT"
    cmd="$cmd $VERBOSE"
    cmd="$cmd $RACE"
    cmd="$cmd $SHORT"
    cmd="$cmd $BENCH"
    cmd="$cmd ."  # Запускаем тесты в текущем каталоге
    
    print_info "Команда: $cmd"
    
    local result=0
    if eval $cmd; then
        print_success "Отдельные тесты прошли успешно!"
    else
        print_error "Отдельные тесты завершились с ошибкой!"
        result=1
    fi
    
    # Возвращаемся в основной каталог
    cd ..
    return $result
}

# Основная функция запуска тестов
main() {
    local failed=0
    
    # Очистка данных перед запуском (если указано)
    cleanup_test_data
    
    # Подготовка среды
    setup_test_environment
    
    print_status "Начало тестирования..."
    
    case $TEST_TYPE in
        "unit")
            run_tests "./unit/..." "Unit" || failed=1
            ;;
        "integration")
            export RUN_PERFORMANCE_TESTS=""  # Отключаем performance тесты
            run_tests "./integration/..." "Интеграционные" || failed=1
            ;;
        "e2e")
            run_tests "./e2e/..." "E2E" || failed=1
            ;;
        "performance")
            export RUN_PERFORMANCE_TESTS="true"
            run_tests "./integration/..." "Производительность" || failed=1
            ;;
        "separate")
            run_separate_tests || failed=1
            ;;
        "all")
            # Запускаем все типы тестов последовательно
            run_tests "./unit/..." "Unit" || failed=1
            
            export RUN_PERFORMANCE_TESTS=""
            run_tests "./integration/..." "Интеграционные" || failed=1
            
            run_tests "./e2e/..." "E2E" || failed=1
            
            run_separate_tests || failed=1
            
            # Performance тесты запускаем только если явно указано
            if [ "$RUN_PERFORMANCE_TESTS" = "true" ]; then
                export RUN_PERFORMANCE_TESTS="true"
                run_tests "./integration/..." "Производительность" || failed=1
            fi
            ;;
    esac
    
    # Обрабатываем coverage, если собирали
    if [ -n "$COVERAGE" ] && [ -f "coverage.out" ]; then
        print_status "Генерация отчета покрытия..."
        go tool cover -html=coverage.out -o coverage.html
        print_success "Отчет покрытия сохранен в coverage.html"
        
        # Показываем общее покрытие
        local coverage_percent=$(go tool cover -func=coverage.out | grep total | awk '{print $3}')
        print_info "Общее покрытие кода: $coverage_percent"
    fi
    
    # Очистка данных после завершения (если указано)
    cleanup_test_data
    
    # Итоговый результат
    if [ $failed -eq 0 ]; then
        print_success "🎉 Все тесты завершились успешно!"
        exit 0
    else
        print_error "💥 Некоторые тесты завершились с ошибкой!"
        exit 1
    fi
}

# Запускаем основную функцию
main 