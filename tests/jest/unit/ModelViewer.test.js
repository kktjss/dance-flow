import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import ModelViewer from '../../../client/src/components/ModelViewer';

// Мокаем Three.js и связанные зависимости
jest.mock('three', () => {
    const actualThree = jest.requireActual('three');
    return {
        ...actualThree,
        WebGLRenderer: jest.fn().mockImplementation(() => ({
            setSize: jest.fn(),
            render: jest.fn(),
            domElement: document.createElement('canvas'),
            shadowMap: { enabled: false },
            setPixelRatio: jest.fn(),
            setClearColor: jest.fn(),
            dispose: jest.fn()
        })),
        Scene: jest.fn().mockImplementation(() => ({
            add: jest.fn(),
            background: null,
            children: [],
            remove: jest.fn()
        })),
        PerspectiveCamera: jest.fn().mockImplementation(() => ({
            position: { set: jest.fn() },
            lookAt: jest.fn()
        })),
        AmbientLight: jest.fn().mockImplementation(() => ({})),
        DirectionalLight: jest.fn().mockImplementation(() => ({
            position: { set: jest.fn() },
            castShadow: false
        })),
        Color: jest.fn(),
        GridHelper: jest.fn(),
        AxesHelper: jest.fn(),
        Box3: jest.fn().mockImplementation(() => ({
            setFromObject: jest.fn(),
            getCenter: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
            getSize: jest.fn().mockReturnValue({ x: 1, y: 1, z: 1 })
        })),
        Vector3: jest.fn().mockImplementation(() => ({
            set: jest.fn(),
            x: 0, y: 0, z: 0
        }))
    };
});

// Мокаем GLTFLoader и миксер анимаций
jest.mock('three/examples/jsm/loaders/GLTFLoader', () => ({
    GLTFLoader: jest.fn().mockImplementation(() => ({
        load: jest.fn((path, onLoad) => {
            // Имитируем загрузку модели
            const mockScene = { scene: {}, animations: [] };
            setTimeout(() => onLoad(mockScene), 100);
        })
    }))
}));

jest.mock('three/examples/jsm/controls/OrbitControls', () => ({
    OrbitControls: jest.fn().mockImplementation(() => ({
        update: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispose: jest.fn()
    }))
}));

// Мокаем сервисы
jest.mock('../../../client/src/services/modelService', () => ({
    getModels: jest.fn().mockResolvedValue({
        data: [
            { _id: 'model1', name: 'Male Dancer', type: 'dancer', url: 'models/male_dancer.glb' },
            { _id: 'model2', name: 'Female Dancer', type: 'dancer', url: 'models/female_dancer.glb' }
        ]
    }),
    getModelById: jest.fn().mockResolvedValue({
        data: { _id: 'model1', name: 'Male Dancer', type: 'dancer', url: 'models/male_dancer.glb' }
    })
}));

// Настраиваем мок-стор
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('ModelViewer Component', () => {
    let store;

    // Мокаем методы window, необходимые для Three.js
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;

    beforeEach(() => {
        store = mockStore({
            auth: {
                user: { _id: 'user1', username: 'testuser' },
                token: 'test.jwt.token',
                isAuthenticated: true
            },
            project: {
                currentProject: {
                    _id: 'project1',
                    name: 'Dance Project'
                }
            }
        });

        // Мокаем requestAnimationFrame и cancelAnimationFrame
        window.requestAnimationFrame = jest.fn().mockReturnValue(1);
        window.cancelAnimationFrame = jest.fn();

        // Мокаем Element.getBoundingClientRect для возврата размеров
        Element.prototype.getBoundingClientRect = jest.fn().mockReturnValue({
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            bottom: 600,
            right: 800
        });

        // Мокаем ResizeObserver
        global.ResizeObserver = jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            unobserve: jest.fn(),
            disconnect: jest.fn()
        }));

        jest.clearAllMocks();
    });

    afterEach(() => {
        // Восстанавливаем оригинальные функции
        window.requestAnimationFrame = originalRequestAnimationFrame;
        window.cancelAnimationFrame = originalCancelAnimationFrame;
    });

    test('renders ModelViewer component', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ModelViewer />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем наличие 3D-вьюпорта
        await waitFor(() => {
            expect(screen.getByTestId('model-viewport')).toBeInTheDocument();
        });
    });

    test('loads model list on mount', async () => {
        const { getModels } = require('../../../client/src/services/modelService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ModelViewer />
                </BrowserRouter>
            </Provider>
        );

        expect(getModels).toHaveBeenCalled();

        await waitFor(() => {
            expect(screen.getByText('Male Dancer')).toBeInTheDocument();
            expect(screen.getByText('Female Dancer')).toBeInTheDocument();
        });
    });

    test('loads a model when selected', async () => {
        const { getModelById } = require('../../../client/src/services/modelService');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ModelViewer />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки списка моделей
        await waitFor(() => {
            expect(screen.getByText('Male Dancer')).toBeInTheDocument();
        });

        // Выбираем модель
        fireEvent.click(screen.getByText('Male Dancer'));

        // Проверяем, что модель загружается
        expect(getModelById).toHaveBeenCalledWith('model1');

        // Проверяем появление индикатора загрузки
        await waitFor(() => {
            expect(screen.getByText(/Loading model/i)).toBeInTheDocument();
        });
    });

    test('handles animation controls', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ModelViewer />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки компонента
        await waitFor(() => {
            expect(screen.getByTestId('model-viewport')).toBeInTheDocument();
        });

        // Проверяем элементы управления анимацией
        const playButton = screen.getByRole('button', { name: /play/i });
        expect(playButton).toBeInTheDocument();

        // Переключаем анимацию
        fireEvent.click(playButton);

        // Проверяем управление скоростью анимации
        const speedSlider = screen.getByRole('slider');
        expect(speedSlider).toBeInTheDocument();

        // Меняем скорость анимации
        fireEvent.change(speedSlider, { target: { value: 1.5 } });
    });

    test('provides camera controls', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ModelViewer />
                </BrowserRouter>
            </Provider>
        );

        // Ждем загрузки компонента
        await waitFor(() => {
            expect(screen.getByTestId('model-viewport')).toBeInTheDocument();
        });

        // Проверяем наличие кнопки сброса вида
        const resetViewButton = screen.getByRole('button', { name: /reset view/i });
        expect(resetViewButton).toBeInTheDocument();

        // Сбрасываем вид камеры
        fireEvent.click(resetViewButton);
    });
}); 