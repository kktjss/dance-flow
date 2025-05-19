import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import axios from 'axios';
import ConstructorPage from '../../../client/src/pages/ConstructorPage';

// Мокаем axios
jest.mock('axios');

// Мокаем модули, которые взаимодействуют с API
jest.mock('../../../client/src/services/api', () => ({
    processVideoFrame: jest.fn().mockImplementation((frameData, options) => {
        // Имитируем ответ API для обнаружения поз
        return Promise.resolve({
            data: {
                found: true,
                image: 'data:image/jpeg;base64,test',
                poses: [
                    {
                        landmarks: Array(33).fill(0).map((_, i) => ({
                            x: Math.random(),
                            y: Math.random(),
                            z: Math.random(),
                            v: 0.9  // видимость
                        })),
                        score: 0.95,
                        bbox: { x1: 100, y1: 100, x2: 300, y2: 400 }
                    }
                ],
                selected_pose_idx: options.click_x && options.click_y ? 0 : -1
            }
        });
    })
}));

// Мокаем функциональность элемента видео
window.HTMLVideoElement.prototype.play = jest.fn().mockImplementation(function () {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
});

window.HTMLVideoElement.prototype.pause = jest.fn().mockImplementation(function () {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
});

// Создаем мок для URL.createObjectURL
URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/test');
URL.revokeObjectURL = jest.fn();

// Настраиваем мок-стор
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Dancer Detection Integration Test', () => {
    let store;

    beforeEach(() => {
        // Сбрасываем моки
        jest.clearAllMocks();

        // Создаем мок для canvas
        window.HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
            drawImage: jest.fn(),
            getImageData: jest.fn().mockReturnValue({ data: new Uint8ClampedArray(100) }),
            putImageData: jest.fn(),
            clearRect: jest.fn(),
            beginPath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            arc: jest.fn(),
            closePath: jest.fn(),
            stroke: jest.fn(),
            fill: jest.fn()
        });

        // Мокаем Element.prototype.getBoundingClientRect
        Element.prototype.getBoundingClientRect = jest.fn().mockReturnValue({
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            right: 800,
            bottom: 600
        });

        // Создаем мок-стор Redux с начальным состоянием
        store = mockStore({
            auth: {
                isAuthenticated: true,
                user: { _id: 'user1', username: 'testuser' },
                token: 'test.jwt.token'
            },
            project: {
                currentProject: {
                    _id: 'project1',
                    name: 'Dance Project',
                    danceStyle: 'salsa'
                },
                isLoading: false
            }
        });
    });

    test('end-to-end dancer detection workflow', async () => {
        // Мокаем видео
        const mockFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });
        const mockUrl = URL.createObjectURL(mockFile);

        // Рендерим страницу конструктора
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ConstructorPage />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки страницы
        await waitFor(() => {
            expect(screen.getByTestId('constructor-page')).toBeInTheDocument();
        });

        // Нажимаем на кнопку загрузки/добавления видео
        const uploadButton = screen.getByRole('button', { name: /Add Video/i });
        fireEvent.click(uploadButton);

        // Находим поле ввода файла и загружаем видеофайл
        const fileInput = screen.getByTestId('video-upload-input');
        fireEvent.change(fileInput, { target: { files: [mockFile] } });

        // Ждем загрузки видео
        await waitFor(() => {
            expect(screen.getByTestId('video-player')).toBeInTheDocument();
        });

        // Нажимаем на кнопку "Найти танцора", чтобы войти в режим обнаружения танцора
        const findDancerButton = screen.getByRole('button', { name: /Find Dancer/i });
        fireEvent.click(findDancerButton);

        // Проверяем, что видео приостановлено для выбора танцора
        const videoElement = screen.getByTestId('video-player');
        expect(videoElement.paused).toBe(true);

        // Кликаем на видео для обнаружения танцора
        const canvasOverlay = screen.getByTestId('video-analyzer-canvas');
        fireEvent.click(canvasOverlay, { clientX: 400, clientY: 300 });

        // Ждем запроса на обнаружение танцора и обработку
        await waitFor(() => {
            // Проверяем, что processVideoFrame был вызван с правильными параметрами
            const { processVideoFrame } = require('../../../client/src/services/api');
            expect(processVideoFrame).toHaveBeenCalledWith(
                expect.any(Blob),
                expect.objectContaining({
                    click_x: expect.any(Number),
                    click_y: expect.any(Number)
                })
            );
        });

        // Проверяем, что танцор был обнаружен и выделен
        const dancerOutline = screen.getByTestId('dancer-outline');
        expect(dancerOutline).toBeInTheDocument();

        // Проверяем, что показаны элементы управления выбором танцора
        expect(screen.getByText(/Selected Dancer/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Clear Selection/i })).toBeInTheDocument();

        // Нажимаем, чтобы очистить выбор танцора
        const clearButton = screen.getByRole('button', { name: /Clear Selection/i });
        fireEvent.click(clearButton);

        // Проверяем, что выбор танцора был очищен
        await waitFor(() => {
            expect(screen.queryByTestId('dancer-outline')).not.toBeInTheDocument();
        });

        // Выходим из режима обнаружения танцора
        const exitButton = screen.getByRole('button', { name: /Exit Dancer Detection/i });
        fireEvent.click(exitButton);

        // Проверяем, что мы вернулись в обычный режим
        await waitFor(() => {
            expect(screen.queryByText(/Selected Dancer/i)).not.toBeInTheDocument();
            expect(findDancerButton).toBeInTheDocument();
        });
    });

    test('persists dancer detection across video playback', async () => {
        // Мокаем видеофайл и URL
        const mockFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });
        const mockUrl = URL.createObjectURL(mockFile);

        // Мокаем временные метки видео и текущее время
        let currentTime = 0;
        Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
            get: function () { return currentTime; },
            set: function (newTime) { currentTime = newTime; }
        });

        // Рендерим страницу конструктора
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ConstructorPage />
                </BrowserRouter>
            </Provider>
        );

        // Загружаем видео
        const uploadButton = screen.getByRole('button', { name: /Add Video/i });
        fireEvent.click(uploadButton);

        const fileInput = screen.getByTestId('video-upload-input');
        fireEvent.change(fileInput, { target: { files: [mockFile] } });

        // Ждем загрузки видео
        await waitFor(() => {
            expect(screen.getByTestId('video-player')).toBeInTheDocument();
        });

        // Переходим в режим обнаружения танцора
        const findDancerButton = screen.getByRole('button', { name: /Find Dancer/i });
        fireEvent.click(findDancerButton);

        // Выбираем танцора
        const canvasOverlay = screen.getByTestId('video-analyzer-canvas');
        fireEvent.click(canvasOverlay, { clientX: 400, clientY: 300 });

        // Ждем обнаружение танцора
        await waitFor(() => {
            expect(screen.getByTestId('dancer-outline')).toBeInTheDocument();
        });

        // Выходим из режима обнаружения танцора
        const exitButton = screen.getByRole('button', { name: /Exit Dancer Detection/i });
        fireEvent.click(exitButton);

        // Воспроизводим видео
        const playButton = screen.getByRole('button', { name: /Play/i });
        fireEvent.click(playButton);

        // Симулируем событие обновления времени
        const videoElement = screen.getByTestId('video-player');
        act(() => {
            currentTime = 2.0;
            videoElement.dispatchEvent(new Event('timeupdate'));
        });

        // Проверяем, что контур танцора остается видимым во время воспроизведения
        expect(screen.getByTestId('dancer-outline')).toBeInTheDocument();

        // Останавливаем видео
        const pauseButton = screen.getByRole('button', { name: /Pause/i });
        fireEvent.click(pauseButton);

        // Переходим к другому времени
        act(() => {
            currentTime = 5.0;
            videoElement.dispatchEvent(new Event('seeked'));
        });

        // Проверяем, что контур танцора обновляется для новой временной позиции
        await waitFor(() => {
            const { processVideoFrame } = require('../../../client/src/services/api');
            expect(processVideoFrame).toHaveBeenCalledTimes(2);
        });

        // Контур танцора должен остаться видимым
        expect(screen.getByTestId('dancer-outline')).toBeInTheDocument();
    });
}); 