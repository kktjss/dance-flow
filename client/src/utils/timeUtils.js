/**
 * Форматирует время в секундах в строку MM:SS
 * @param {number} seconds - время в секундах
 * @returns {string} - отформатированное время в виде MM:SS
 */
export const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;

    // Округляем до ближайшей секунды
    seconds = Math.round(seconds);

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Склоняет слово в зависимости от числа
 * @param {number} number - число
 * @param {Array<string>} words - массив слов для склонения (1, 2-4, 5-20)
 * @returns {string} - правильно склоненное слово
 */
const declensionWord = (number, words) => {
    const cases = [2, 0, 1, 1, 1, 2];
    return words[
        number % 100 > 4 && number % 100 < 20
            ? 2
            : cases[Math.min(number % 10, 5)]
    ];
};

/**
 * Форматирует длительность в читаемую строку с правильным склонением
 * @param {number} seconds - время в секундах
 * @returns {string} - отформатированная длительность
 */
export const formatDuration = (seconds) => {
    if (seconds < 0) seconds = 0;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    let result = '';

    if (hours > 0) {
        result += `${hours} ${declensionWord(hours, ['час', 'часа', 'часов'])}`;
    }

    if (minutes > 0) {
        if (result.length > 0) result += ' ';
        result += `${minutes} ${declensionWord(minutes, ['мин', 'мин', 'мин'])}`;
    }

    if (remainingSeconds > 0 || (hours === 0 && minutes === 0)) {
        if (result.length > 0) result += ' ';
        result += `${remainingSeconds} ${declensionWord(remainingSeconds, ['сек', 'сек', 'сек'])}`;
    }

    return result;
};

/**
 * Разбирает строку времени в формате MM:SS в секунды
 * @param {string} timeString - строка времени в формате MM:SS
 * @returns {number} - время в секундах
 */
export const parseTimeInput = (timeString) => {
    timeString = timeString.trim();

    // Если строка пустая, возвращаем 0
    if (!timeString) return 0;

    // Если строка содержит двоеточие, разбираем как MM:SS
    if (timeString.includes(':')) {
        const [minutes, seconds] = timeString.split(':').map(part => {
            const num = parseInt(part.trim(), 10);
            return isNaN(num) ? 0 : num;
        });

        return minutes * 60 + seconds;
    }

    // Если строка не содержит двоеточие, интерпретируем как секунды
    const seconds = parseInt(timeString, 10);
    return isNaN(seconds) ? 0 : seconds;
};

/**
 * Конвертирует объект времени в секунды
 * @param {Object} timeObj - объект времени {hours, minutes, seconds}
 * @returns {number} - время в секундах
 */
export const convertToSeconds = (timeObj) => {
    const { hours = 0, minutes = 0, seconds = 0 } = timeObj;

    // Обрабатываем отрицательные значения
    const h = Math.max(0, hours);
    const m = Math.max(0, minutes);
    const s = Math.max(0, seconds);

    // Округляем до ближайшей секунды
    return Math.round(h * 3600 + m * 60 + s);
};

/**
 * Интерполирует значение между двумя точками
 * @param {number} startValue - начальное значение
 * @param {number} endValue - конечное значение
 * @param {number} startTime - время начала (в секундах)
 * @param {number} endTime - время конца (в секундах)
 * @param {number} currentTime - текущее время (в секундах)
 * @returns {number} - интерполированное значение
 */
export const interpolateValue = (startValue, endValue, startTime, endTime, currentTime) => {
    // Обработка значений вне диапазона
    if (currentTime <= startTime) return startValue;
    if (currentTime >= endTime) return endValue;

    // Если время не изменяется, возвращаем начальное значение
    if (endTime === startTime) return startValue;

    // Вычисляем процент прогресса
    const progress = (currentTime - startTime) / (endTime - startTime);

    // Линейная интерполяция
    return startValue + (endValue - startValue) * progress;
}; 