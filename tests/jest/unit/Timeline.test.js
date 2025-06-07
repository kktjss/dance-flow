import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import Timeline from '../../../client/src/components/Timeline';

// Мокаем компоненты Material UI
jest.mock('@mui/material/Slider', () => props => (
    <div data-testid="mock-slider" onClick={props.onChange}>
        <input
            type="range"
            min={props.min}
            max={props.max}
            value={props.value}
            onChange={props.onChange}
            data-testid={props['data-testid'] || 'timeline-slider'}
        />
        {props.children}
    </div>
));

jest.mock('@mui/icons-material/PlayArrow', () => () => <div data-testid="play-icon">▶</div>);
jest.mock('@mui/icons-material/Pause', () => () => <div data-testid="pause-icon">⏸</div>);
jest.mock('@mui/icons-material/Add', () => () => <div data-testid="add-icon">+</div>);
jest.mock('@mui/icons-material/Delete', () => () => <div data-testid="delete-icon">×</div>);
jest.mock('@mui/icons-material/KeyboardArrowLeft', () => () => <div data-testid="prev-icon">←</div>);
jest.mock('@mui/icons-material/KeyboardArrowRight', () => () => <div data-testid="next-icon">→</div>);

// Настраиваем мок-стор
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Timeline Component', () => {
    let store;

    beforeEach(() => {
        // Создаем стор с начальным состоянием
        store = mockStore({
            auth: {
                isAuthenticated: true,
                user: { _id: 'user1', username: 'testuser' },
                token: 'test.jwt.token'
            },
            projects: {
                currentProject: {
                    _id: 'project1',
                    name: 'Test Project',
                    timeline: {
                        duration: 60, // 60 секунд длительность
                        keyframes: [
                            {
                                id: 'keyframe1',
                                time: 10, // на 10 секунде
                                elements: [
                                    { elementId: 'element1', properties: { position: { x: 100, y: 100 } } }
                                ]
                            },
                            {
                                id: 'keyframe2',
                                time: 30, // на 30 секунде
                                elements: [
                                    { elementId: 'element1', properties: { position: { x: 200, y: 200 } } }
                                ]
                            }
                        ]
                    },
                    elements: [
                        { _id: 'element1', type: 'rectangle', position: { x: 10, y: 10 }, width: 100, height: 50, color: '#ff0000' }
                    ]
                },
                isLoading: false
            },
            timeline: {
                currentTime: 0,
                isPlaying: false,
                selectedKeyframe: null,
                playbackSpeed: 1
            }
        });

        jest.clearAllMocks();

        // Мокаем requestAnimationFrame и cancelAnimationFrame
        window.requestAnimationFrame = jest.fn().mockReturnValue(1);
        window.cancelAnimationFrame = jest.fn();

        // Мокаем performance.now
        window.performance.now = jest.fn().mockReturnValue(0);

        // Мокаем Date.now
        const originalNow = Date.now;
        let currentTime = 0;
        Date.now = jest.fn().mockImplementation(() => {
            currentTime += 100; // Увеличиваем на 100мс при каждом вызове
            return currentTime;
        });

        // Восстанавливаем после тестов
        afterEach(() => {
            Date.now = originalNow;
        });
    });

    test('renders Timeline component', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем наличие основного контейнера таймлайна
        expect(screen.getByTestId('timeline-container')).toBeInTheDocument();

        // Проверяем наличие слайдера таймлайна
        expect(screen.getByTestId('timeline-slider')).toBeInTheDocument();

        // Проверяем наличие кнопки воспроизведения
        expect(screen.getByTestId('play-icon')).toBeInTheDocument();

        // Проверяем наличие кнопки добавления ключевого кадра
        expect(screen.getByTestId('add-icon')).toBeInTheDocument();

        // Проверяем, что ключевые кадры отображаются
        expect(screen.getByText('00:10')).toBeInTheDocument();
        expect(screen.getByText('00:30')).toBeInTheDocument();
    });

    test('plays and pauses timeline', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопку воспроизведения
        const playButton = screen.getByRole('button', { name: /play/i });

        // Нажимаем для начала воспроизведения
        fireEvent.click(playButton);

        // Проверяем, что действие воспроизведения было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_TIMELINE_PLAYING' && action.payload === true)).toBe(true);

        // Теперь должна отображаться кнопка паузы
        const pauseButton = screen.getByRole('button', { name: /pause/i });

        // Нажимаем для паузы воспроизведения
        fireEvent.click(pauseButton);

        // Проверяем, что действие паузы было отправлено
        expect(actions.some(action => action.type === 'SET_TIMELINE_PLAYING' && action.payload === false)).toBe(true);
    });

    test('handles timeline scrubbing', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Находим слайдер таймлайна
        const timelineSlider = screen.getByTestId('timeline-slider');

        // Меняем время на 20 секунд
        fireEvent.change(timelineSlider, { target: { value: '20' } });

        // Проверяем, что действие установки времени было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_TIMELINE_CURRENT_TIME' && action.payload === 20)).toBe(true);
    });

    test('adds a new keyframe', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Сначала устанавливаем текущее время на 15 секунд
        const timelineSlider = screen.getByTestId('timeline-slider');
        fireEvent.change(timelineSlider, { target: { value: '15' } });

        // Находим кнопку добавления ключевого кадра
        const addKeyframeButton = screen.getByRole('button', { name: /add keyframe/i });

        // Нажимаем для добавления ключевого кадра на текущем времени
        fireEvent.click(addKeyframeButton);

        // Проверяем, что действие добавления ключевого кадра было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'ADD_KEYFRAME' && action.payload.time === 15)).toBe(true);
    });

    test('selects a keyframe when clicked', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Находим маркер ключевого кадра
        const keyframeMarker = screen.getByText('00:10'); // ключевой кадр на 10 секунде

        // Нажимаем на ключевой кадр
        fireEvent.click(keyframeMarker);

        // Проверяем, что действие выбора ключевого кадра было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SELECT_KEYFRAME' && action.payload === 'keyframe1')).toBe(true);
    });

    test('deletes a keyframe', () => {
        // Обновляем стор с выбранным ключевым кадром
        store = mockStore({
            ...store.getState(),
            timeline: {
                ...store.getState().timeline,
                selectedKeyframe: 'keyframe1'
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопку удаления ключевого кадра (должна быть видима, когда кадр выбран)
        const deleteKeyframeButton = screen.getByRole('button', { name: /delete keyframe/i });

        // Нажимаем для удаления выбранного ключевого кадра
        fireEvent.click(deleteKeyframeButton);

        // Проверяем, что действие удаления ключевого кадра было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'DELETE_KEYFRAME' && action.payload === 'keyframe1')).toBe(true);
    });

    test('navigates to previous keyframe', () => {
        // Устанавливаем текущее время между ключевыми кадрами
        store = mockStore({
            ...store.getState(),
            timeline: {
                ...store.getState().timeline,
                currentTime: 20
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопку предыдущего ключевого кадра
        const prevKeyframeButton = screen.getByRole('button', { name: /previous keyframe/i });

        // Нажимаем для перехода к предыдущему ключевому кадру
        fireEvent.click(prevKeyframeButton);

        // Проверяем, что действие установки времени было отправлено со временем предыдущего кадра
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_TIMELINE_CURRENT_TIME' && action.payload === 10)).toBe(true);
    });

    test('navigates to next keyframe', () => {
        // Устанавливаем текущее время между ключевыми кадрами
        store = mockStore({
            ...store.getState(),
            timeline: {
                ...store.getState().timeline,
                currentTime: 20
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопку следующего ключевого кадра
        const nextKeyframeButton = screen.getByRole('button', { name: /next keyframe/i });

        // Нажимаем для перехода к следующему ключевому кадру
        fireEvent.click(nextKeyframeButton);

        // Проверяем, что действие установки времени было отправлено со временем следующего кадра
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_TIMELINE_CURRENT_TIME' && action.payload === 30)).toBe(true);
    });

    test('formats time correctly', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Время должно отображаться как 00:00 изначально
        expect(screen.getByText('00:00 / 01:00')).toBeInTheDocument();

        // Меняем время на 25 секунд
        const timelineSlider = screen.getByTestId('timeline-slider');
        fireEvent.change(timelineSlider, { target: { value: '25' } });

        // Отображение времени должно обновиться
        expect(screen.getByText('00:25 / 01:00')).toBeInTheDocument();

        // Меняем время на 65 секунд (больше длительности)
        fireEvent.change(timelineSlider, { target: { value: '65' } });

        // Время должно быть ограничено длительностью
        expect(screen.getByText('01:00 / 01:00')).toBeInTheDocument();
    });

    test('updates timeline duration', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Находим поле ввода длительности
        const durationInput = screen.getByLabelText(/duration/i);

        // Меняем длительность на 120 секунд
        fireEvent.change(durationInput, { target: { value: '120' } });
        fireEvent.blur(durationInput);

        // Проверяем, что действие обновления таймлайна было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'UPDATE_TIMELINE' && action.payload.duration === 120)).toBe(true);
    });

    test('handles playback with animation frame', async () => {
        // Мокаем, что таймлайн воспроизводится
        store = mockStore({
            ...store.getState(),
            timeline: {
                ...store.getState().timeline,
                isPlaying: true,
                currentTime: 5
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Симулируем прошедшее время
        act(() => {
            // Запускаем колбэк анимации
            // Находим вызов requestAnimationFrame и выполняем его колбэк
            const animationCallback = window.requestAnimationFrame.mock.calls[0][0];
            // Симулируем прошедшую 1 секунду
            window.performance.now.mockReturnValue(1000);
            animationCallback(1000);
        });

        // Проверяем, что текущее время было обновлено
        const actions = store.getActions();
        // Должно увеличиться примерно на 1 секунду
        expect(actions.some(action =>
            action.type === 'SET_TIMELINE_CURRENT_TIME' &&
            action.payload > 5 &&
            action.payload <= 6
        )).toBe(true);
    });

    test('stops playback at the end of timeline', async () => {
        // Мокаем, что таймлайн воспроизводится и близок к концу
        store = mockStore({
            ...store.getState(),
            timeline: {
                ...store.getState().timeline,
                isPlaying: true,
                currentTime: 59 // 1 секунда до конца
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Симулируем прошедшее время, которое выйдет за пределы длительности
        act(() => {
            const animationCallback = window.requestAnimationFrame.mock.calls[0][0];
            window.performance.now.mockReturnValue(2000); // прошло 2 секунды
            animationCallback(2000);
        });

        // Проверяем, что воспроизведение остановилось в конце
        const actions = store.getActions();

        // Должно установить время на длительность (60)
        expect(actions.some(action =>
            action.type === 'SET_TIMELINE_CURRENT_TIME' &&
            action.payload === 60
        )).toBe(true);

        // Должно установить воспроизведение в false
        expect(actions.some(action =>
            action.type === 'SET_TIMELINE_PLAYING' &&
            action.payload === false
        )).toBe(true);
    });
}); 