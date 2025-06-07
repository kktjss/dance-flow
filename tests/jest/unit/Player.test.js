import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import Player from '../../../client/src/components/Player';

// Мокаем поведение видео-элемента
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation(function () {
        this.paused = false;
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
    })
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation(function () {
        this.paused = true;
        this.dispatchEvent(new Event('pause'));
    })
});

// Добавляем отсутствующие свойства в HTMLMediaElement
Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    writable: true,
    value: 100
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    writable: true,
    value: 0
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'volume', {
    configurable: true,
    writable: true,
    value: 1
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'muted', {
    configurable: true,
    writable: true,
    value: false
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'playbackRate', {
    configurable: true,
    writable: true,
    value: 1
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get() { return 4; }  // HAVE_ENOUGH_DATA
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    writable: true,
    value: true
});

// Мокаем requestVideoFrameCallback для современных браузеров
if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
        configurable: true,
        writable: true,
        value: jest.fn().mockImplementation(callback => {
            return setTimeout(() => callback(performance.now(), { width: 640, height: 480 }), 16.7);
        })
    });
}

// Мокаем объект URL для источника видео
window.URL.createObjectURL = jest.fn().mockReturnValue('blob:https://example.com/mock-video');
window.URL.revokeObjectURL = jest.fn();

// Настраиваем мок-стор
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Player Component', () => {
    let store;
    let mockVideo;

    beforeEach(() => {
        // Создаем мок-файл видео
        mockVideo = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });

        // Создаем стор с начальным состоянием
        store = mockStore({
            auth: {
                isAuthenticated: true,
                user: { _id: 'user1', username: 'testuser' },
                token: 'test.jwt.token'
            },
            video: {
                currentVideo: {
                    url: URL.createObjectURL(mockVideo),
                    name: 'test-video.mp4'
                },
                isPlaying: false,
                currentTime: 0,
                duration: 100,
                volume: 1,
                playbackRate: 1
            },
            player: {
                showControls: true,
                loop: false,
                annotations: []
            }
        });

        jest.clearAllMocks();
    });

    test('renders Player component with video', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Player videoSrc={URL.createObjectURL(mockVideo)} />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем наличие видео-элемента
        const videoElement = await screen.findByTestId('video-player');
        expect(videoElement).toBeInTheDocument();

        // Проверяем наличие элементов управления видео
        expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
        expect(screen.getByRole('slider', { name: /time slider/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /volume/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /fullscreen/i })).toBeInTheDocument();
    });

    test('plays and pauses video', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Player videoSrc={URL.createObjectURL(mockVideo)} />
                </BrowserRouter>
            </Provider>
        );

        // Получаем видео-элемент и кнопку воспроизведения
        const videoElement = await screen.findByTestId('video-player');
        const playButton = screen.getByRole('button', { name: /play/i });

        // Изначально видео должно быть на паузе
        expect(videoElement.paused).toBe(true);

        // Нажимаем кнопку воспроизведения
        fireEvent.click(playButton);

        // Видео должно воспроизводиться
        expect(videoElement.play).toHaveBeenCalled();
        expect(videoElement.paused).toBe(false);

        // Кнопка должна измениться на паузу
        const pauseButton = screen.getByRole('button', { name: /pause/i });
        expect(pauseButton).toBeInTheDocument();

        // Нажимаем кнопку паузы
        fireEvent.click(pauseButton);

        // Видео должно быть на паузе
        expect(videoElement.pause).toHaveBeenCalled();
        expect(videoElement.paused).toBe(true);
    });

    test('handles time slider changes', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Player videoSrc={URL.createObjectURL(mockVideo)} />
                </BrowserRouter>
            </Provider>
        );

        // Получаем видео-элемент и ползунок времени
        const videoElement = await screen.findByTestId('video-player');
        const timeSlider = screen.getByRole('slider', { name: /time slider/i });

        // Изначально время должно быть 0
        expect(videoElement.currentTime).toBe(0);

        // Меняем значение ползунка времени на 50% (50 секунд для 100-секундного видео)
        fireEvent.change(timeSlider, { target: { value: '50' } });

        // Видео должно перейти к новому времени
        expect(videoElement.currentTime).toBe(50);
    });

    test('handles volume controls', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Player videoSrc={URL.createObjectURL(mockVideo)} />
                </BrowserRouter>
            </Provider>
        );

        // Получаем видео-элемент и кнопку громкости
        const videoElement = await screen.findByTestId('video-player');
        const volumeButton = screen.getByRole('button', { name: /volume/i });

        // Изначально громкость должна быть 1 (максимум)
        expect(videoElement.volume).toBe(1);
        expect(videoElement.muted).toBe(false);

        // Нажимаем кнопку громкости для отображения ползунка
        fireEvent.click(volumeButton);

        // Находим ползунок громкости
        const volumeSlider = screen.getByRole('slider', { name: /volume slider/i });
        expect(volumeSlider).toBeInTheDocument();

        // Меняем громкость на 50%
        fireEvent.change(volumeSlider, { target: { value: '0.5' } });

        // Громкость видео должна измениться
        expect(videoElement.volume).toBe(0.5);

        // Нажимаем кнопку громкости снова для отключения звука
        fireEvent.click(volumeButton);

        // Видео должно быть без звука
        expect(videoElement.muted).toBe(true);

        // Нажимаем еще раз для включения звука
        fireEvent.click(volumeButton);

        // Звук должен быть включен
        expect(videoElement.muted).toBe(false);
    });

    test('toggles fullscreen mode', async () => {
        // Мокаем API полноэкранного режима
        const mockRequestFullscreen = jest.fn();
        const mockExitFullscreen = jest.fn();

        document.documentElement.requestFullscreen = mockRequestFullscreen;
        document.exitFullscreen = mockExitFullscreen;

        // Мокаем состояние полноэкранного режима
        let isFullscreen = false;
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => isFullscreen ? document.documentElement : null
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Player videoSrc={URL.createObjectURL(mockVideo)} />
                </BrowserRouter>
            </Provider>
        );

        // Получаем кнопку полноэкранного режима
        const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });

        // Нажимаем для входа в полноэкранный режим
        fireEvent.click(fullscreenButton);

        // Должен быть вызван запрос на полноэкранный режим
        expect(mockRequestFullscreen).toHaveBeenCalled();

        // Имитируем вход в полноэкранный режим
        isFullscreen = true;

        // Отправляем событие изменения полноэкранного режима
        fireEvent(document, new Event('fullscreenchange'));

        // Нажимаем для выхода из полноэкранного режима
        fireEvent.click(fullscreenButton);

        // Должен быть вызван выход из полноэкранного режима
        expect(mockExitFullscreen).toHaveBeenCalled();
    });

    test('shows video time correctly', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Player videoSrc={URL.createObjectURL(mockVideo)} />
                </BrowserRouter>
            </Provider>
        );

        // Получаем видео-элемент
        const videoElement = await screen.findByTestId('video-player');

        // Начальное отображение времени должно быть 0:00 / 1:40 (для 100-секундного видео)
        expect(screen.getByText('0:00 / 1:40')).toBeInTheDocument();

        // Обновляем текущее время до 30 секунд
        act(() => {
            videoElement.currentTime = 30;
            videoElement.dispatchEvent(new Event('timeupdate'));
        });

        // Отображение времени должно обновиться
        expect(screen.getByText('0:30 / 1:40')).toBeInTheDocument();

        // Обновляем текущее время до 70 секунд
        act(() => {
            videoElement.currentTime = 70;
            videoElement.dispatchEvent(new Event('timeupdate'));
        });

        // Отображение времени должно обновиться до 1:10 / 1:40
        expect(screen.getByText('1:10 / 1:40')).toBeInTheDocument();
    });

    test('changes playback speed', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Player videoSrc={URL.createObjectURL(mockVideo)} />
                </BrowserRouter>
            </Provider>
        );

        // Получаем видео-элемент
        const videoElement = await screen.findByTestId('video-player');

        // Изначальная скорость воспроизведения должна быть 1x
        expect(videoElement.playbackRate).toBe(1);

        // Находим кнопку скорости воспроизведения
        const speedButton = screen.getByRole('button', { name: /1x/i });

        // Нажимаем для изменения скорости на 1.5x
        fireEvent.click(speedButton);

        // Скорость воспроизведения должна измениться
        expect(videoElement.playbackRate).toBe(1.5);

        // Кнопка должна обновиться и показать новую скорость
        expect(screen.getByRole('button', { name: /1.5x/i })).toBeInTheDocument();

        // Нажимаем снова для изменения на 2x
        const speed1_5Button = screen.getByRole('button', { name: /1.5x/i });
        fireEvent.click(speed1_5Button);

        // Скорость воспроизведения должна измениться
        expect(videoElement.playbackRate).toBe(2);

        // Кнопка должна обновиться
        expect(screen.getByRole('button', { name: /2x/i })).toBeInTheDocument();
    });

    test('handles keyboard shortcuts', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Player videoSrc={URL.createObjectURL(mockVideo)} />
                </BrowserRouter>
            </Provider>
        );

        // Получаем видео-элемент
        const videoElement = await screen.findByTestId('video-player');

        // Изначально видео должно быть на паузе
        expect(videoElement.paused).toBe(true);

        // Нажимаем пробел для воспроизведения
        fireEvent.keyDown(document, { key: ' ' });

        // Видео должно воспроизводиться
        expect(videoElement.play).toHaveBeenCalled();
        expect(videoElement.paused).toBe(false);

        // Нажимаем пробел для паузы
        fireEvent.keyDown(document, { key: ' ' });

        // Видео должно быть на паузе
        expect(videoElement.pause).toHaveBeenCalled();
        expect(videoElement.paused).toBe(true);

        // Нажимаем стрелку вправо для перемотки вперед
        const initialTime = videoElement.currentTime;
        fireEvent.keyDown(document, { key: 'ArrowRight' });

        // Время должно увеличиться
        expect(videoElement.currentTime).toBeGreaterThan(initialTime);

        // Нажимаем стрелку влево для перемотки назад
        const currentTime = videoElement.currentTime;
        fireEvent.keyDown(document, { key: 'ArrowLeft' });

        // Время должно уменьшиться
        expect(videoElement.currentTime).toBeLessThan(currentTime);

        // Нажимаем 'm' для отключения звука
        fireEvent.keyDown(document, { key: 'm' });

        // Видео должно быть без звука
        expect(videoElement.muted).toBe(true);

        // Нажимаем 'm' снова для включения звука
        fireEvent.keyDown(document, { key: 'm' });

        // Звук должен быть включен
        expect(videoElement.muted).toBe(false);
    });

    test('handles video end event', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Player videoSrc={URL.createObjectURL(mockVideo)} />
                </BrowserRouter>
            </Provider>
        );

        // Получаем видео-элемент
        const videoElement = await screen.findByTestId('video-player');

        // Имитируем окончание видео
        act(() => {
            videoElement.dispatchEvent(new Event('ended'));
        });

        // Должна отображаться кнопка воспроизведения
        expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();

        // Экшены должны включать событие окончания видео
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'VIDEO_ENDED')).toBe(true);
    });
}); 