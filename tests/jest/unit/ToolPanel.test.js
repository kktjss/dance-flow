import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import ToolPanel from '../../../client/src/components/ToolPanel';

// Mock material UI icons to avoid issues
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

// Configure mock store
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('ToolPanel Component', () => {
    let store;

    beforeEach(() => {
        // Create store with initial state
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

        // Check for main tool panel container
        expect(screen.getByTestId('tool-panel')).toBeInTheDocument();

        // Check for tool groups
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

        // Find selection tool buttons
        const selectButton = screen.getByRole('button', { name: /select/i });
        const rectangleButton = screen.getByRole('button', { name: /rectangle/i });
        const circleButton = screen.getByRole('button', { name: /circle/i });
        const lineButton = screen.getByRole('button', { name: /line/i });
        const textButton = screen.getByRole('button', { name: /text/i });

        // Click on rectangle tool
        fireEvent.click(rectangleButton);

        // Check if mode change action was dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'rectangle')).toBe(true);

        // Click on circle tool
        fireEvent.click(circleButton);
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'circle')).toBe(true);

        // Click on line tool
        fireEvent.click(lineButton);
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'line')).toBe(true);

        // Click on text tool
        fireEvent.click(textButton);
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'text')).toBe(true);

        // Click on select tool
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

        // Find edit tool buttons
        const undoButton = screen.getByRole('button', { name: /undo/i });
        const redoButton = screen.getByRole('button', { name: /redo/i });
        const deleteButton = screen.getByRole('button', { name: /delete/i });

        // Undo button should be enabled (we have past actions)
        expect(undoButton).not.toBeDisabled();

        // Redo button should be disabled (no future actions)
        expect(redoButton).toBeDisabled();

        // Delete button should be enabled (we have selected elements)
        expect(deleteButton).not.toBeDisabled();

        // Click undo
        fireEvent.click(undoButton);

        // Check if undo action was dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'UNDO')).toBe(true);

        // Click delete
        fireEvent.click(deleteButton);

        // Check if delete action was dispatched for the selected element
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

        // Find clipboard tool buttons
        const cutButton = screen.getByRole('button', { name: /cut/i });
        const copyButton = screen.getByRole('button', { name: /copy/i });
        const pasteButton = screen.getByRole('button', { name: /paste/i });

        // Cut/copy buttons should be enabled (we have selected elements)
        expect(cutButton).not.toBeDisabled();
        expect(copyButton).not.toBeDisabled();

        // Paste button should be disabled (clipboard is empty)
        expect(pasteButton).toBeDisabled();

        // Click copy
        fireEvent.click(copyButton);

        // Check if copy action was dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'COPY_ELEMENTS' &&
            action.payload.includes('element1'))).toBe(true);

        // Update store to simulate element in clipboard
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

        // Re-render with updated store
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ToolPanel />
                </BrowserRouter>
            </Provider>
        );

        // Find paste button again
        const pasteButtonEnabled = screen.getByRole('button', { name: /paste/i });

        // Paste button should now be enabled
        expect(pasteButtonEnabled).not.toBeDisabled();

        // Click paste
        fireEvent.click(pasteButtonEnabled);

        // Check if paste action was dispatched
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

        // Find view tool buttons
        const gridButton = screen.getByRole('button', { name: /grid/i });
        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
        const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
        const panButton = screen.getByRole('button', { name: /pan/i });

        // Click grid button to toggle grid off
        fireEvent.click(gridButton);

        // Check if grid toggle action was dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'TOGGLE_GRID')).toBe(true);

        // Click zoom in
        fireEvent.click(zoomInButton);

        // Check if zoom in action was dispatched
        expect(actions.some(action => action.type === 'ZOOM_IN')).toBe(true);

        // Click zoom out
        fireEvent.click(zoomOutButton);

        // Check if zoom out action was dispatched
        expect(actions.some(action => action.type === 'ZOOM_OUT')).toBe(true);

        // Click pan tool
        fireEvent.click(panButton);

        // Check if pan mode action was dispatched
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

        // Hover over select tool
        const selectButton = screen.getByRole('button', { name: /select/i });
        fireEvent.mouseOver(selectButton);

        // Wait for tooltip to appear
        await waitFor(() => {
            expect(screen.getByText('Select (V)')).toBeInTheDocument();
        });

        // Hover over rectangle tool
        const rectangleButton = screen.getByRole('button', { name: /rectangle/i });
        fireEvent.mouseOver(rectangleButton);

        // Wait for tooltip to appear
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

        // Simulate keyboard shortcuts
        // Press 'v' for select tool
        fireEvent.keyDown(document, { key: 'v' });

        // Check if select mode was activated
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'select')).toBe(true);

        // Press 'r' for rectangle tool
        fireEvent.keyDown(document, { key: 'r' });

        // Check if rectangle mode was activated
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'rectangle')).toBe(true);

        // Press 'c' for circle tool
        fireEvent.keyDown(document, { key: 'c' });

        // Check if circle mode was activated
        expect(actions.some(action => action.type === 'SET_CANVAS_MODE' && action.payload === 'circle')).toBe(true);

        // Press 'z' with ctrl for undo
        fireEvent.keyDown(document, { key: 'z', ctrlKey: true });

        // Check if undo action was dispatched
        expect(actions.some(action => action.type === 'UNDO')).toBe(true);

        // Press 'y' with ctrl for redo
        fireEvent.keyDown(document, { key: 'y', ctrlKey: true });

        // Check if redo action was dispatched
        expect(actions.some(action => action.type === 'REDO')).toBe(true);

        // Press 'Delete' for delete
        fireEvent.keyDown(document, { key: 'Delete' });

        // Check if delete action was dispatched
        expect(actions.some(action => action.type === 'DELETE_ELEMENTS')).toBe(true);
    });

    test('disables tools when appropriate', () => {
        // Update store to have no selected elements and empty history
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

        // Find edit tool buttons
        const undoButton = screen.getByRole('button', { name: /undo/i });
        const redoButton = screen.getByRole('button', { name: /redo/i });
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        const cutButton = screen.getByRole('button', { name: /cut/i });
        const copyButton = screen.getByRole('button', { name: /copy/i });

        // Undo button should be disabled (no past actions)
        expect(undoButton).toBeDisabled();

        // Redo button should be disabled (no future actions)
        expect(redoButton).toBeDisabled();

        // Delete button should be disabled (no selected elements)
        expect(deleteButton).toBeDisabled();

        // Cut/copy buttons should be disabled (no selected elements)
        expect(cutButton).toBeDisabled();
        expect(copyButton).toBeDisabled();
    });
}); 