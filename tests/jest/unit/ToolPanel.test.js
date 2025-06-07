import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import ToolPanel from '../../../client/src/components/ToolPanel';

// Мокаем иконки Material UI во избежание проблем
jest.mock('@mui/icons-material/Undo', () => () => <div data-testid="undo-icon">Undo</div>);
jest.mock('@mui/icons-material/Redo', () => () => <div data-testid="redo-icon">Redo</div>);
jest.mock('@mui/icons-material/Delete', () => () => <div data-testid="delete-icon">Delete</div>);
jest.mock('@mui/icons-material/ContentCut', () => () => <div data-testid="cut-icon">Cut</div>);
jest.mock('@mui/icons-material/ContentCopy', () => () => <div data-testid="copy-icon">Copy</div>);
jest.mock('@mui/icons-material/ContentPaste', () => () => <div data-testid="paste-icon">Paste</div>);
jest.mock('@mui/icons-material/GridOn', () => () => <div data-testid="grid-icon">Grid</div>);
jest.mock('@mui/icons-material/GridOff', () => () => <div data-testid="grid-off-icon">Grid Off</div>);
jest.mock('@mui/icons-material/ZoomIn', () => () => <div data-testid="zoom-in-icon">Zoom In</div>);
jest.mock('@mui/icons-material/ZoomOut', () => () => <div data-testid="zoom-out-icon">Zoom Out</div>);
jest.mock('@mui/icons-material/PanTool', () => () => <div data-testid="pan-icon">Pan</div>);
jest.mock('@mui/icons-material/HighlightAlt', () => () => <div data-testid="select-icon">Select</div>);
jest.mock('@mui/icons-material/Rectangle', () => () => <div data-testid="rectangle-icon">Rectangle</div>);
jest.mock('@mui/icons-material/RadioButtonUnchecked', () => () => <div data-testid="circle-icon">Circle</div>);
jest.mock('@mui/icons-material/Timeline', () => () => <div data-testid="line-icon">Line</div>);
jest.mock('@mui/icons-material/TextFields', () => () => <div data-testid="text-icon">Text</div>);
jest.mock('@mui/icons-material/Image', () => () => <div data-testid="image-icon">Image</div>);
jest.mock('@mui/icons-material/Layers', () => () => <div data-testid="layers-icon">Layers</div>);

// Настраиваем мок-стор
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('ToolPanel Component', () => {
    let store;

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
                    elements: [
                        { _id: 'element1', type: 'rectangle', position: { x: 10, y: 10 }, width: 100, height: 50, color: '#ff0000' }
                    ]
                },
                isLoading: false
            },
            canvas: {
                mode: 'select',
                selectedElements: ['element1'],
                clipboard: null,
                history: {
                    past: [{}, {}],
                    future: []
                },
                gridVisible: true,
                snapToGrid: true,
                zoom: 1,
                panMode: false
            }
        });

        jest.clearAllMocks();
    });

    test('renders ToolPanel component', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем наличие основного контейнера панели инструментов
        expect(screen.getByTestId('tool-panel')).toBeInTheDocument();

        // Проверяем наличие групп инструментов
        expect(screen.getByTestId('edit-tools')).toBeInTheDocument();
        expect(screen.getByTestId('drawing-tools')).toBeInTheDocument();
        expect(screen.getByTestId('view-tools')).toBeInTheDocument();
    });

    test('handles mode selection tools', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопки инструментов выбора
        const selectButton = screen.getByRole('button', { name: /select/i });
        const rectangleButton = screen.getByRole('button', { name: /rectangle/i });
        const circleButton = screen.getByRole('button', { name: /circle/i });
        const lineButton = screen.getByRole('button', { name: /line/i });
        const textButton = screen.getByRole('button', { name: /text/i });

        // Нажимаем на инструмент прямоугольника
        fireEvent.click(rectangleButton);

        // Проверяем, что действие смены режима было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'rectangle')).toBe(true);

        // Нажимаем на инструмент круга
        fireEvent.click(circleButton);
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'circle')).toBe(true);

        // Нажимаем на инструмент линии
        fireEvent.click(lineButton);
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'line')).toBe(true);

        // Нажимаем на инструмент текста
        fireEvent.click(textButton);
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'text')).toBe(true);

        // Нажимаем на инструмент выделения
        fireEvent.click(selectButton);
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'select')).toBe(true);
    });

    test('handles edit tools (undo, redo, delete)', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопки инструментов редактирования
        const undoButton = screen.getByRole('button', { name: /undo/i });
        const redoButton = screen.getByRole('button', { name: /redo/i });
        const deleteButton = screen.getByRole('button', { name: /delete/i });

        // Кнопка отмены должна быть активна (есть прошлые действия)
        expect(undoButton).not.toBeDisabled();

        // Кнопка повтора должна быть неактивна (нет будущих действий)
        expect(redoButton).toBeDisabled();

        // Кнопка удаления должна быть активна (есть выбранные элементы)
        expect(deleteButton).not.toBeDisabled();

        // Нажимаем отмену
        fireEvent.click(undoButton);

        // Проверяем, что действие отмены было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'UNDO')).toBe(true);

        // Нажимаем удаление
        fireEvent.click(deleteButton);

        // Проверяем, что действие удаления было отправлено для выбранного элемента
        expect(actions.some(action => action.type === 'DELETE_ELEMENTS' &&
            action.payload.includes('element1'))).toBe(true);
    });

    test('handles clipboard operations (cut, copy, paste)', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопки буфера обмена
        const cutButton = screen.getByRole('button', { name: /cut/i });
        const copyButton = screen.getByRole('button', { name: /copy/i });
        const pasteButton = screen.getByRole('button', { name: /paste/i });

        // Кнопки вырезать/копировать должны быть активны (есть выбранные элементы)
        expect(cutButton).not.toBeDisabled();
        expect(copyButton).not.toBeDisabled();

        // Кнопка вставки должна быть неактивна (буфер обмена пуст)
        expect(pasteButton).toBeDisabled();

        // Нажимаем копировать
        fireEvent.click(copyButton);

        // Проверяем, что действие копирования было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'COPY_ELEMENTS' &&
            action.payload.includes('element1'))).toBe(true);

        // Обновляем стор для имитации элемента в буфере обмена
        store = mockStore({
            ...store.getState(),
            canvas: {
                ...store.getState().canvas,
                clipboard: [{
                    _id: 'element1',
                    type: 'rectangle',
                    position: { x: 10, y: 10 },
                    width: 100,
                    height: 50,
                    color: '#ff0000'
                }]
            }
        });

        // Перерендериваем с обновленным стором
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопку вставки снова
        const pasteButtonEnabled = screen.getByRole('button', { name: /paste/i });

        // Кнопка вставки теперь должна быть активна
        expect(pasteButtonEnabled).not.toBeDisabled();

        // Нажимаем вставить
        fireEvent.click(pasteButtonEnabled);

        // Проверяем, что действие вставки было отправлено
        const updatedActions = store.getActions();
        expect(updatedActions.some(action => action.type === 'PASTE_ELEMENTS')).toBe(true);
    });

    test('handles view tools (grid, zoom, pan)', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопки инструментов просмотра
        const gridButton = screen.getByRole('button', { name: /grid/i });
        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
        const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
        const panButton = screen.getByRole('button', { name: /pan/i });

        // Нажимаем кнопку сетки для её отключения
        fireEvent.click(gridButton);

        // Проверяем, что действие переключения сетки было отправлено
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'TOGGLE_GRID')).toBe(true);

        // Нажимаем увеличить масштаб
        fireEvent.click(zoomInButton);

        // Проверяем, что действие увеличения масштаба было отправлено
        expect(actions.some(action => action.type === 'ZOOM_IN')).toBe(true);

        // Нажимаем уменьшить масштаб
        fireEvent.click(zoomOutButton);

        // Проверяем, что действие уменьшения масштаба было отправлено
        expect(actions.some(action => action.type === 'ZOOM_OUT')).toBe(true);

        // Нажимаем инструмент панорамирования
        fireEvent.click(panButton);

        // Проверяем, что действие режима панорамирования было отправлено
        expect(actions.some(action => action.type === 'TOGGLE_PAN_MODE')).toBe(true);
    });

    test('shows tooltips on hover', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Наводим на инструмент выделения
        const selectButton = screen.getByRole('button', { name: /select/i });
        fireEvent.mouseOver(selectButton);

        // Ждем появления подсказки
        await waitFor(() => {
            expect(screen.getByText('Select (V)')).toBeInTheDocument();
        });

        // Наводим на инструмент прямоугольника
        const rectangleButton = screen.getByRole('button', { name: /rectangle/i });
        fireEvent.mouseOver(rectangleButton);

        // Ждем появления подсказки
        await waitFor(() => {
            expect(screen.getByText('Rectangle (R)')).toBeInTheDocument();
        });
    });

    test('handles keyboard shortcuts', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Симулируем горячие клавиши
        // Нажимаем 'v' для инструмента выделения
        fireEvent.keyDown(document, { key: 'v' });

        // Проверяем, что режим выделения был активирован
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'select')).toBe(true);

        // Нажимаем 'r' для инструмента прямоугольника
        fireEvent.keyDown(document, { key: 'r' });

        // Проверяем, что режим прямоугольника был активирован
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'rectangle')).toBe(true);

        // Нажимаем 'c' для инструмента круга
        fireEvent.keyDown(document, { key: 'c' });

        // Проверяем, что режим круга был активирован
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'circle')).toBe(true);

        // Нажимаем 'z' с ctrl для отмены
        fireEvent.keyDown(document, { key: 'z', ctrlKey: true });

        // Проверяем, что действие отмены было отправлено
        expect(actions.some(action => action.type === 'UNDO')).toBe(true);

        // Нажимаем 'y' с ctrl для повтора
        fireEvent.keyDown(document, { key: 'y', ctrlKey: true });

        // Проверяем, что действие повтора было отправлено
        expect(actions.some(action => action.type === 'REDO')).toBe(true);

        // Нажимаем 'Delete' для удаления
        fireEvent.keyDown(document, { key: 'Delete' });

        // Проверяем, что действие удаления было отправлено
        expect(actions.some(action => action.type === 'DELETE_ELEMENTS')).toBe(true);
    });

    test('disables tools when appropriate', () => {
        // Обновляем стор, чтобы не было выбранных элементов и история была пуста
        store = mockStore({
            ...store.getState(),
            canvas: {
                ...store.getState().canvas,
                selectedElements: [],
                history: {
                    past: [],
                    future: []
                }
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Находим кнопки инструментов редактирования
        const undoButton = screen.getByRole('button', { name: /undo/i });
        const redoButton = screen.getByRole('button', { name: /redo/i });
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        const cutButton = screen.getByRole('button', { name: /cut/i });
        const copyButton = screen.getByRole('button', { name: /copy/i });

        // Кнопка отмены должна быть неактивна (нет прошлых действий)
        expect(undoButton).toBeDisabled();

        // Кнопка повтора должна быть неактивна (нет будущих действий)
        expect(redoButton).toBeDisabled();

        // Кнопка удаления должна быть неактивна (нет выбранных элементов)
        expect(deleteButton).toBeDisabled();

        // Кнопки вырезать/копировать должны быть неактивны (нет выбранных элементов)
        expect(cutButton).toBeDisabled();
        expect(copyButton).toBeDisabled();
    });
}); 