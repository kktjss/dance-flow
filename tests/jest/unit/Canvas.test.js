import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import Canvas from '../../../client/src/components/Canvas';

// Мокаем зависимости
jest.mock('three', () => {
    return {
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
        Color: jest.fn(),
        Vector2: jest.fn().mockImplementation(() => ({
            x: 0,
            y: 0,
            set: jest.fn()
        })),
        Vector3: jest.fn().mockImplementation(() => ({
            set: jest.fn(),
            x: 0, y: 0, z: 0
        })),
        Raycaster: jest.fn().mockImplementation(() => ({
            setFromCamera: jest.fn(),
            intersectObjects: jest.fn().mockReturnValue([])
        })),
        GridHelper: jest.fn(),
        Group: jest.fn().mockImplementation(() => ({
            add: jest.fn(),
            children: [],
            position: { x: 0, y: 0, z: 0 }
        })),
        Box3: jest.fn().mockImplementation(() => ({
            setFromObject: jest.fn(),
            getCenter: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
            getSize: jest.fn().mockReturnValue({ x: 1, y: 1, z: 1 })
        })),
        MeshBasicMaterial: jest.fn(),
        LineBasicMaterial: jest.fn(),
        BoxGeometry: jest.fn(),
        Mesh: jest.fn()
    };
});

jest.mock('three/examples/jsm/controls/OrbitControls', () => ({
    OrbitControls: jest.fn().mockImplementation(() => ({
        update: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispose: jest.fn(),
        enabled: true
    }))
}));

// Мокаем сервисы элементов дизайна
jest.mock('../../../client/src/services/designElementService', () => ({
    getElements: jest.fn().mockResolvedValue({
        data: [
            { _id: 'element1', type: 'rectangle', position: { x: 10, y: 10 }, width: 100, height: 50, color: '#ff0000' },
            { _id: 'element2', type: 'circle', position: { x: 200, y: 150 }, radius: 30, color: '#0000ff' }
        ]
    }),
    createElement: jest.fn().mockResolvedValue({
        data: { _id: 'newElement', type: 'rectangle', position: { x: 10, y: 10 }, width: 100, height: 50, color: '#ff0000' }
    }),
    updateElement: jest.fn().mockResolvedValue({
        data: { message: 'Element updated successfully' }
    }),
    deleteElement: jest.fn().mockResolvedValue({
        data: { message: 'Element deleted successfully' }
    })
}));

// Мокаем сервис проектов
jest.mock('../../../client/src/services/projectService', () => ({
    getProject: jest.fn().mockResolvedValue({
        data: {
            _id: 'project1',
            name: 'Test Project',
            elements: [
                { _id: 'element1', type: 'rectangle', position: { x: 10, y: 10 }, width: 100, height: 50, color: '#ff0000' }
            ],
            timeline: {
                duration: 60,
                keyframes: []
            }
        }
    }),
    updateProject: jest.fn().mockResolvedValue({
        data: { message: 'Project updated successfully' }
    })
}));

// Настраиваем мок-стор
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Canvas Component', () => {
    let store;

    // Мокаем методы window
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;

    beforeEach(() => {
        // Создаем стор с начальным состоянием
        store = mockStore({
            auth: {
                isAuthenticated: true,
                user: { _id: 'user1', username: 'testuser' },
                token: 'test.jwt.token'
            },
            project: {
                currentProject: {
                    _id: 'project1',
                    name: 'Test Project',
                    elements: [],
                    timeline: {
                        duration: 60,
                        keyframes: []
                    }
                },
                isLoading: false
            },
            canvas: {
                mode: 'select',
                selectedElements: [],
                gridVisible: true,
                snapToGrid: true,
                zoom: 1
            }
        });

        // Мокаем requestAnimationFrame и cancelAnimationFrame
        window.requestAnimationFrame = jest.fn().mockReturnValue(1);
        window.cancelAnimationFrame = jest.fn();

        // Мокаем Element.getBoundingClientRect
        Element.prototype.getBoundingClientRect = jest.fn().mockReturnValue({
            width: 1000,
            height: 800,
            top: 0,
            left: 0,
            bottom: 800,
            right: 1000
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

    test('renders Canvas component', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Canvas />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем наличие контейнера canvas
        await waitFor(() => {
            expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
        });
    });

    test('handles tool mode changes', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Canvas />
                </BrowserRouter>
            </Provider>
        );

        // Find tool buttons
        const rectangleButton = screen.getByRole('button', { name: /rectangle/i });
        const circleButton = screen.getByRole('button', { name: /circle/i });
        const selectButton = screen.getByRole('button', { name: /select/i });

        // Switch to rectangle mode
        fireEvent.click(rectangleButton);

        // Dispatch action should have been called with the mode change
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'rectangle')).toBe(true);

        // Switch to circle mode
        fireEvent.click(circleButton);
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'circle')).toBe(true);

        // Switch back to select mode
        fireEvent.click(selectButton);
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'select')).toBe(true);
    });

    test('handles element creation', async () => {
        // Update store with rectangle mode
        store = mockStore({
            ...store.getState(),
            canvas: {
                ...store.getState().canvas,
                mode: 'rectangle'
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Canvas />
                </BrowserRouter>
            </Provider>
        );

        // Find canvas element
        const canvasElement = screen.getByTestId('canvas-container');

        // Simulate drawing a rectangle
        fireEvent.mouseDown(canvasElement, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(canvasElement, { clientX: 200, clientY: 200 });
        fireEvent.mouseUp(canvasElement);

        // Element creation should have been triggered
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'ADD_ELEMENT')).toBe(true);

        // Service should have been called
        const { createElement } = require('../../../client/src/services/designElementService');
        expect(createElement).toHaveBeenCalled();
    });

    test('handles element selection', async () => {
        // Update store with elements
        store = mockStore({
            ...store.getState(),
            project: {
                ...store.getState().project,
                currentProject: {
                    ...store.getState().project.currentProject,
                    elements: [
                        { _id: 'element1', type: 'rectangle', position: { x: 10, y: 10 }, width: 100, height: 50, color: '#ff0000' }
                    ]
                }
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Canvas />
                </BrowserRouter>
            </Provider>
        );

        // Find canvas element
        const canvasElement = screen.getByTestId('canvas-container');

        // Simulate clicking on an element
        fireEvent.mouseDown(canvasElement, { clientX: 50, clientY: 30 });
        fireEvent.mouseUp(canvasElement);

        // Selection action should have been dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SELECT_ELEMENT')).toBe(true);
    });

    test('handles element movement', async () => {
        // Update store with selected element
        store = mockStore({
            ...store.getState(),
            project: {
                ...store.getState().project,
                currentProject: {
                    ...store.getState().project.currentProject,
                    elements: [
                        { _id: 'element1', type: 'rectangle', position: { x: 10, y: 10 }, width: 100, height: 50, color: '#ff0000' }
                    ]
                }
            },
            canvas: {
                ...store.getState().canvas,
                selectedElements: ['element1']
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Canvas />
                </BrowserRouter>
            </Provider>
        );

        // Find canvas element
        const canvasElement = screen.getByTestId('canvas-container');

        // Simulate moving a selected element
        fireEvent.mouseDown(canvasElement, { clientX: 50, clientY: 30 });
        fireEvent.mouseMove(canvasElement, { clientX: 100, clientY: 80 });
        fireEvent.mouseUp(canvasElement);

        // Update action should have been dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'UPDATE_ELEMENT')).toBe(true);

        // Service should have been called
        const { updateElement } = require('../../../client/src/services/designElementService');
        expect(updateElement).toHaveBeenCalled();
    });

    test('handles element deletion', async () => {
        // Update store with selected element
        store = mockStore({
            ...store.getState(),
            project: {
                ...store.getState().project,
                currentProject: {
                    ...store.getState().project.currentProject,
                    elements: [
                        { _id: 'element1', type: 'rectangle', position: { x: 10, y: 10 }, width: 100, height: 50, color: '#ff0000' }
                    ]
                }
            },
            canvas: {
                ...store.getState().canvas,
                selectedElements: ['element1']
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Canvas />
                </BrowserRouter>
            </Provider>
        );

        // Simulate pressing delete key
        fireEvent.keyDown(document, { key: 'Delete' });

        // Delete action should have been dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'DELETE_ELEMENT')).toBe(true);

        // Service should have been called
        const { deleteElement } = require('../../../client/src/services/designElementService');
        expect(deleteElement).toHaveBeenCalled();
    });

    test('handles grid toggle', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Canvas />
                </BrowserRouter>
            </Provider>
        );

        // Find grid toggle button
        const gridToggleButton = screen.getByRole('button', { name: /toggle grid/i });

        // Toggle grid off
        fireEvent.click(gridToggleButton);

        // Action should have been dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'TOGGLE_GRID')).toBe(true);
    });

    test('handles zoom in and out', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Canvas />
                </BrowserRouter>
            </Provider>
        );

        // Find zoom buttons
        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
        const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });

        // Zoom in
        fireEvent.click(zoomInButton);

        // Action should have been dispatched
        let actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_ZOOM' && action.payload > 1)).toBe(true);

        // Zoom out
        fireEvent.click(zoomOutButton);

        // Action should have been dispatched
        actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_ZOOM' && action.payload < 1)).toBe(true);
    });

    test('handles undo and redo', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Canvas />
                </BrowserRouter>
            </Provider>
        );

        // Find undo/redo buttons
        const undoButton = screen.getByRole('button', { name: /undo/i });
        const redoButton = screen.getByRole('button', { name: /redo/i });

        // Trigger undo
        fireEvent.click(undoButton);

        // Action should have been dispatched
        let actions = store.getActions();
        expect(actions.some(action => action.type === 'UNDO')).toBe(true);

        // Trigger redo
        fireEvent.click(redoButton);

        // Action should have been dispatched
        actions = store.getActions();
        expect(actions.some(action => action.type === 'REDO')).toBe(true);
    });
}); 