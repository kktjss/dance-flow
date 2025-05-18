import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import VideoAnalyzer from '../../../client/src/components/VideoAnalyzer';

// Мокаем зависимости
jest.mock('axios');
jest.mock('../../../client/src/services/videoService', () => ({
    analyzeVideo: jest.fn().mockResolvedValue({
        data: {
            score: 85.5,
            feedback: "Great dance moves! Try to keep your posture more upright during turns.",
            key_points: [
                { timestamp: 1.5, score: 90, comment: "Excellent footwork" },
                { timestamp: 3.2, score: 75, comment: "Improve arm positions" },
                { timestamp: 5.8, score: 92, comment: "Excellent hip movement" }
            ],
            comparison: {
                timing: { score: 87, feedback: "Good timing, slightly early on some beats" },
                technique: { score: 84, feedback: "Good technique overall, work on posture" },
                rhythm: { score: 88, feedback: "Excellent rhythm maintenance throughout" }
            }
        }
    }),
    uploadReferenceVideo: jest.fn().mockResolvedValue({
        data: { message: "Reference video uploaded successfully", referenceId: "ref123" }
    }),
    getReferenceVideos: jest.fn().mockResolvedValue({
        data: [
            { _id: "ref1", name: "Basic Salsa Step", category: "salsa", difficulty: "beginner", url: "https://example.com/video1" },
            { _id: "ref2", name: "Basic Bachata Step", category: "bachata", difficulty: "beginner", url: "https://example.com/video2" }
        ]
    })
}));

// Мокаем MediaRecorder и связанные с видео объекты
global.MediaRecorder = jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    ondataavailable: jest.fn(),
    onerror: jest.fn(),
    state: '',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
}));

global.MediaStream = jest.fn();
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// Мокаем navigator.mediaDevices
global.navigator.mediaDevices = {
    getUserMedia: jest.fn().mockResolvedValue(new MediaStream()),
};

// Настраиваем мок-стор
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('VideoAnalyzer Component', () => {
    let store;

    beforeEach(() => {
        // Создаем начальное состояние стора
        store = mockStore({
            auth: {
                user: { _id: 'user1', username: 'testuser' },
                token: 'test.jwt.token',
                isAuthenticated: true
            },
            project: {
                currentProject: {
                    _id: 'project1',
                    name: 'Salsa Practice',
                    danceStyle: 'salsa',
                    difficulty: 'intermediate'
                },
                isLoading: false
            }
        });

        // Сбрасываем моки
        jest.clearAllMocks();
    });

    test('renders video analyzer component', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <VideoAnalyzer />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем основные элементы интерфейса
        expect(screen.getByText(/Dance Analysis/i)).toBeInTheDocument();
        expect(screen.getByText(/Record your dance/i)).toBeInTheDocument();
        expect(screen.getByText(/Choose reference video/i)).toBeInTheDocument();
    });

    test('loads reference videos on mount', async () => {
        const { getReferenceVideos } = require('../../../client/src/services/videoService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <VideoAnalyzer />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем, что загрузка референсных видео запустилась
        expect(getReferenceVideos).toHaveBeenCalled();

        // Ждем, пока загрузятся референсные видео
        await waitFor(() => {
            expect(screen.getByText('Basic Salsa Step')).toBeInTheDocument();
            expect(screen.getByText('Basic Bachata Step')).toBeInTheDocument();
        });
    });

    test('starts and stops recording', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <VideoAnalyzer />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем кнопку начала записи
        const startButton = screen.getByRole('button', { name: /Start Recording/i });
        expect(startButton).toBeInTheDocument();

        // Нажимаем кнопку начала записи
        await act(async () => {
            fireEvent.click(startButton);
        });

        // Проверяем, что запрашиваются медиа-устройства
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
            video: true,
            audio: true
        });

        // Проверяем, что MediaRecorder создан и запущен
        await waitFor(() => {
            expect(MediaRecorder).toHaveBeenCalled();
            expect(MediaRecorder.mock.instances[0].start).toHaveBeenCalled();
        });

        // Должна появиться кнопка остановки записи
        const stopButton = await screen.findByRole('button', { name: /Stop Recording/i });
        expect(stopButton).toBeInTheDocument();

        // Нажимаем кнопку остановки записи
        fireEvent.click(stopButton);

        // Проверяем, что запись остановлена
        expect(MediaRecorder.mock.instances[0].stop).toHaveBeenCalled();
    });

    test('selects reference video and analyzes dance', async () => {
        const { analyzeVideo } = require('../../../client/src/services/videoService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <VideoAnalyzer />
                </BrowserRouter>
            </Provider>
        );

        // Ждем, пока загрузятся референсные видео
        await waitFor(() => {
            expect(screen.getByText('Basic Salsa Step')).toBeInTheDocument();
        });

        // Имитируем, что есть записанное видео
        const mockFile = new File(['dummy content'], 'recording.webm', { type: 'video/webm' });
        const mockDataTransfer = {
            files: [mockFile],
            items: [{ kind: 'file', type: 'video/webm', getAsFile: () => mockFile }],
            types: ['Files']
        };

        // Находим элемент выбора референсного видео
        const referenceOption = screen.getByText('Basic Salsa Step');

        // Выбираем референсное видео
        fireEvent.click(referenceOption);

        // Имитируем загрузку записанного видео
        const dropzone = screen.getByTestId('video-dropzone');
        fireEvent.drop(dropzone, { dataTransfer: mockDataTransfer });

        // Нажимаем кнопку анализа
        const analyzeButton = screen.getByRole('button', { name: /Analyze Dance/i });
        fireEvent.click(analyzeButton);

        // Проверяем, что вызван метод анализа видео
        expect(analyzeVideo).toHaveBeenCalledWith(
            expect.any(FormData),
            'test.jwt.token'
        );

        // Ждем отображения результатов анализа
        await waitFor(() => {
            expect(screen.getByText(/Analysis Results/i)).toBeInTheDocument();
            expect(screen.getByText(/Overall Score: 85.5/i)).toBeInTheDocument();
            expect(screen.getByText(/Great dance moves!/i)).toBeInTheDocument();
        });

        // Проверяем детальные результаты
        expect(screen.getByText(/Timing: 87/i)).toBeInTheDocument();
        expect(screen.getByText(/Technique: 84/i)).toBeInTheDocument();
        expect(screen.getByText(/Rhythm: 88/i)).toBeInTheDocument();

        // Проверяем ключевые моменты
        expect(screen.getByText(/Excellent footwork/i)).toBeInTheDocument();
        expect(screen.getByText(/Improve arm positions/i)).toBeInTheDocument();
    });

    test('handles errors during video analysis', async () => {
        // Мокаем ошибку при анализе видео
        const { analyzeVideo } = require('../../../client/src/services/videoService');
        analyzeVideo.mockRejectedValueOnce({
            response: {
                data: { error: 'Error analyzing video' }
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <VideoAnalyzer />
                </BrowserRouter>
            </Provider>
        );

        // Имитируем выбор референсного видео и загрузку видео
        await waitFor(() => {
            expect(screen.getByText('Basic Salsa Step')).toBeInTheDocument();
        });

        // Выбираем референсное видео
        fireEvent.click(screen.getByText('Basic Salsa Step'));

        // Имитируем, что есть записанное видео
        const mockFile = new File(['dummy content'], 'recording.webm', { type: 'video/webm' });

        // Находим инпут для загрузки файла и загружаем видео
        const fileInput = screen.getByTestId('video-file-input');
        fireEvent.change(fileInput, { target: { files: [mockFile] } });

        // Нажимаем кнопку анализа
        const analyzeButton = screen.getByRole('button', { name: /Analyze Dance/i });
        fireEvent.click(analyzeButton);

        // Проверяем отображение ошибки
        await waitFor(() => {
            expect(screen.getByText(/Error analyzing video/i)).toBeInTheDocument();
        });
    });

    test('uploads custom reference video', async () => {
        const { uploadReferenceVideo } = require('../../../client/src/services/videoService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <VideoAnalyzer />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопку загрузки своего референсного видео
        const uploadButton = screen.getByRole('button', { name: /Upload Reference/i });
        fireEvent.click(uploadButton);

        // Проверяем, что открылась модалка загрузки
        await waitFor(() => {
            expect(screen.getByText(/Upload Reference Video/i)).toBeInTheDocument();
        });

        // Заполняем форму
        fireEvent.change(screen.getByLabelText(/Video Name/i), {
            target: { value: 'My Custom Reference' }
        });
        fireEvent.change(screen.getByLabelText(/Category/i), {
            target: { value: 'salsa' }
        });
        fireEvent.change(screen.getByLabelText(/Difficulty/i), {
            target: { value: 'intermediate' }
        });

        // Имитируем загрузку файла
        const mockFile = new File(['dummy content'], 'reference.mp4', { type: 'video/mp4' });
        const fileInput = screen.getByTestId('reference-file-input');
        fireEvent.change(fileInput, { target: { files: [mockFile] } });

        // Нажимаем кнопку сохранения
        const saveButton = screen.getByRole('button', { name: /Save Reference/i });
        fireEvent.click(saveButton);

        // Проверяем, что вызван метод загрузки
        expect(uploadReferenceVideo).toHaveBeenCalledWith(
            expect.any(FormData),
            'test.jwt.token'
        );

        // Проверяем отображение сообщения об успехе
        await waitFor(() => {
            expect(screen.getByText(/Reference video uploaded successfully/i)).toBeInTheDocument();
        });
    });

    test('displays progress indication during analysis', async () => {
        // Замедляем ответ API
        const { analyzeVideo } = require('../../../client/src/services/videoService');
        let resolveAnalysis;
        const analysisPromise = new Promise(resolve => {
            resolveAnalysis = resolve;
        });
        analyzeVideo.mockReturnValueOnce(analysisPromise);

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <VideoAnalyzer />
                </BrowserRouter>
            </Provider>
        );

        // Ждем, пока загрузятся референсные видео
        await waitFor(() => {
            expect(screen.getByText('Basic Salsa Step')).toBeInTheDocument();
        });

        // Выбираем референсное видео
        fireEvent.click(screen.getByText('Basic Salsa Step'));

        // Имитируем загрузку видео
        const mockFile = new File(['dummy content'], 'recording.webm', { type: 'video/webm' });
        const fileInput = screen.getByTestId('video-file-input');
        fireEvent.change(fileInput, { target: { files: [mockFile] } });

        // Нажимаем кнопку анализа
        const analyzeButton = screen.getByRole('button', { name: /Analyze Dance/i });
        fireEvent.click(analyzeButton);

        // Проверяем, что отображается индикатор загрузки
        await waitFor(() => {
            expect(screen.getByText(/Analyzing your dance.../i)).toBeInTheDocument();
            expect(screen.getByTestId('analysis-loader')).toBeInTheDocument();
        });

        // Завершаем анализ
        act(() => {
            resolveAnalysis({
                data: {
                    score: 85.5,
                    feedback: "Great dance moves!",
                    key_points: [],
                    comparison: {
                        timing: { score: 87, feedback: "" },
                        technique: { score: 84, feedback: "" },
                        rhythm: { score: 88, feedback: "" }
                    }
                }
            });
        });

        // Проверяем, что загрузчик исчез и появились результаты
        await waitFor(() => {
            expect(screen.queryByTestId('analysis-loader')).not.toBeInTheDocument();
            expect(screen.getByText(/Overall Score: 85.5/i)).toBeInTheDocument();
        });
    });

    test('supports various video formats', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <VideoAnalyzer />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем поддерживаемые форматы видео
        const supportedFormatsText = screen.getByText(/Supported formats/i);
        expect(supportedFormatsText).toBeInTheDocument();
        expect(supportedFormatsText.textContent).toContain('MP4');
        expect(supportedFormatsText.textContent).toContain('WebM');

        // Пытаемся загрузить неподдерживаемый формат
        const invalidFile = new File(['dummy content'], 'video.abc', { type: 'video/abc' });
        const fileInput = screen.getByTestId('video-file-input');
        fireEvent.change(fileInput, { target: { files: [invalidFile] } });

        // Проверяем сообщение об ошибке
        await waitFor(() => {
            expect(screen.getByText(/Unsupported file format/i)).toBeInTheDocument();
        });
    });
}); 