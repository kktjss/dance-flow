import {
    formatTime,
    formatDuration,
    parseTimeInput,
    convertToSeconds,
    interpolateValue
} from '../../utils/timeUtils';

describe('Утилиты работы со временем', () => {
    describe('formatTime', () => {
        it('должен форматировать секунды в формат MM:SS', () => {
            expect(formatTime(0)).toBe('00:00');
            expect(formatTime(30)).toBe('00:30');
            expect(formatTime(60)).toBe('01:00');
            expect(formatTime(90)).toBe('01:30');
            expect(formatTime(3600)).toBe('60:00');
            expect(formatTime(3661)).toBe('61:01');
        });

        it('должен правильно обрабатывать отрицательное время', () => {
            expect(formatTime(-5)).toBe('00:00');
        });

        it('должен правильно обрабатывать дробные значения', () => {
            expect(formatTime(30.5)).toBe('00:31'); // Округление до ближайшей секунды
            expect(formatTime(59.9)).toBe('01:00'); // Округление до ближайшей секунды
        });
    });

    describe('formatDuration', () => {
        it('должен форматировать секунды в читаемую строку', () => {
            expect(formatDuration(30)).toBe('30 сек');
            expect(formatDuration(60)).toBe('1 мин');
            expect(formatDuration(90)).toBe('1 мин 30 сек');
            expect(formatDuration(3600)).toBe('1 час');
            expect(formatDuration(3661)).toBe('1 час 1 мин 1 сек');
            expect(formatDuration(7325)).toBe('2 часа 2 мин 5 сек');
        });

        it('должен правильно склонять часы, минуты и секунды', () => {
            expect(formatDuration(1)).toBe('1 сек');
            expect(formatDuration(2)).toBe('2 сек');
            expect(formatDuration(5)).toBe('5 сек');
            expect(formatDuration(21)).toBe('21 сек');

            expect(formatDuration(60)).toBe('1 мин');
            expect(formatDuration(120)).toBe('2 мин');
            expect(formatDuration(300)).toBe('5 мин');

            expect(formatDuration(3600)).toBe('1 час');
            expect(formatDuration(7200)).toBe('2 часа');
            expect(formatDuration(18000)).toBe('5 часов');
        });

        it('должен скрывать нулевые значения', () => {
            expect(formatDuration(60)).toBe('1 мин'); // Без "0 сек"
            expect(formatDuration(3600)).toBe('1 час'); // Без "0 мин 0 сек"
            expect(formatDuration(3660)).toBe('1 час 1 мин'); // Без "0 сек"
        });
    });

    describe('parseTimeInput', () => {
        it('должен разбирать строку времени в формате MM:SS', () => {
            expect(parseTimeInput('00:00')).toBe(0);
            expect(parseTimeInput('00:30')).toBe(30);
            expect(parseTimeInput('01:00')).toBe(60);
            expect(parseTimeInput('01:30')).toBe(90);
            expect(parseTimeInput('60:00')).toBe(3600);
        });

        it('должен обрабатывать неверные форматы времени', () => {
            expect(parseTimeInput('invalid')).toBe(0);
            expect(parseTimeInput('1:2')).toBe(62); // Интерпретация как 1 мин 2 сек
            expect(parseTimeInput('100')).toBe(100); // Только секунды
        });

        it('должен обрабатывать время с пробелами', () => {
            expect(parseTimeInput(' 01:30 ')).toBe(90);
        });
    });

    describe('convertToSeconds', () => {
        it('должен конвертировать объект времени в секунды', () => {
            expect(convertToSeconds({ hours: 0, minutes: 0, seconds: 0 })).toBe(0);
            expect(convertToSeconds({ hours: 0, minutes: 0, seconds: 30 })).toBe(30);
            expect(convertToSeconds({ hours: 0, minutes: 1, seconds: 0 })).toBe(60);
            expect(convertToSeconds({ hours: 0, minutes: 1, seconds: 30 })).toBe(90);
            expect(convertToSeconds({ hours: 1, minutes: 0, seconds: 0 })).toBe(3600);
            expect(convertToSeconds({ hours: 1, minutes: 1, seconds: 1 })).toBe(3661);
        });

        it('должен обрабатывать отрицательные значения', () => {
            expect(convertToSeconds({ hours: 0, minutes: 0, seconds: -10 })).toBe(0);
            expect(convertToSeconds({ hours: 0, minutes: -1, seconds: 30 })).toBe(30);
        });

        it('должен обрабатывать дробные значения', () => {
            expect(convertToSeconds({ hours: 0, minutes: 0, seconds: 30.5 })).toBe(31); // Округление
            expect(convertToSeconds({ hours: 0, minutes: 1.5, seconds: 0 })).toBe(90); // 1.5 мин = 90 сек
        });
    });

    describe('interpolateValue', () => {
        it('должен интерполировать значение между двумя точками времени', () => {
            // Для линейной интерполяции между 0 и 100 за 10 секунд
            expect(interpolateValue(0, 100, 0, 10, 0)).toBe(0); // В начале
            expect(interpolateValue(0, 100, 0, 10, 5)).toBe(50); // В середине
            expect(interpolateValue(0, 100, 0, 10, 10)).toBe(100); // В конце
            expect(interpolateValue(0, 100, 0, 10, 2.5)).toBe(25); // 25% пути
            expect(interpolateValue(0, 100, 0, 10, 7.5)).toBe(75); // 75% пути
        });

        it('должен обрабатывать значения вне диапазона', () => {
            expect(interpolateValue(0, 100, 0, 10, -5)).toBe(0); // До начала
            expect(interpolateValue(0, 100, 0, 10, 15)).toBe(100); // После конца
        });

        it('должен интерполировать между отрицательными значениями', () => {
            expect(interpolateValue(-100, 100, 0, 10, 5)).toBe(0); // В середине
            expect(interpolateValue(100, -100, 0, 10, 5)).toBe(0); // В середине, обратный порядок
        });

        it('должен интерполировать координаты и размеры', () => {
            // Интерполяция координаты x от 10 до 50 за 20 секунд
            expect(interpolateValue(10, 50, 0, 20, 10)).toBe(30);

            // Интерполяция размера от 100 до 200 за 10 секунд
            expect(interpolateValue(100, 200, 0, 10, 7.5)).toBe(175);
        });
    });
}); 