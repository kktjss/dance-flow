import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import Timeline from '../../../client/src/components/Timeline';

// Mock material UI components
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

// Configure mock store
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Timeline Component', () => {
    let store;

    beforeEach(() => {
        // Create store with initial state
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
                        duration: 60, // 60 seconds duration
                        keyframes: [
                            {
                                id: 'keyframe1',
                                time: 10, // at 10 seconds
                                elements: [
                                    { elementId: 'element1', properties: { position: { x: 100, y: 100 } } }
                                ]
                            },
                            {
                                id: 'keyframe2',
                                time: 30, // at 30 seconds
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

        // Mock requestAnimationFrame and cancelAnimationFrame
        window.requestAnimationFrame = jest.fn().mockReturnValue(1);
        window.cancelAnimationFrame = jest.fn();

        // Mock performance.now
        window.performance.now = jest.fn().mockReturnValue(0);

        // Mock Date.now
        const originalNow = Date.now;
        let currentTime = 0;
        Date.now = jest.fn().mockImplementation(() => {
            currentTime += 100; // Increment by 100ms on each call
            return currentTime;
        });

        // Restore after tests
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

        // Check for main timeline container
        expect(screen.getByTestId('timeline-container')).toBeInTheDocument();

        // Check for timeline slider
        expect(screen.getByTestId('timeline-slider')).toBeInTheDocument();

        // Check for play button
        expect(screen.getByTestId('play-icon')).toBeInTheDocument();

        // Check for add keyframe button
        expect(screen.getByTestId('add-icon')).toBeInTheDocument();

        // Check that keyframes are displayed
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

        // Find play button
        const playButton = screen.getByRole('button', { name: /play/i });

        // Click to start playback
        fireEvent.click(playButton);

        // Check if play action was dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_TIMELINE_PLAYING' && action.payload === true)).toBe(true);

        // Should now show pause button
        const pauseButton = screen.getByRole('button', { name: /pause/i });

        // Click to pause playback
        fireEvent.click(pauseButton);

        // Check if pause action was dispatched
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

        // Find timeline slider
        const timelineSlider = screen.getByTestId('timeline-slider');

        // Change time to 20 seconds
        fireEvent.change(timelineSlider, { target: { value: '20' } });

        // Check if set time action was dispatched
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

        // First set current time to 15 seconds
        const timelineSlider = screen.getByTestId('timeline-slider');
        fireEvent.change(timelineSlider, { target: { value: '15' } });

        // Find add keyframe button
        const addKeyframeButton = screen.getByRole('button', { name: /add keyframe/i });

        // Click to add a keyframe at the current time
        fireEvent.click(addKeyframeButton);

        // Check if add keyframe action was dispatched
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

        // Find keyframe marker
        const keyframeMarker = screen.getByText('00:10'); // 10 second keyframe

        // Click on the keyframe
        fireEvent.click(keyframeMarker);

        // Check if select keyframe action was dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SELECT_KEYFRAME' && action.payload === 'keyframe1')).toBe(true);
    });

    test('deletes a keyframe', () => {
        // Update store to have a selected keyframe
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

        // Find delete keyframe button (should be visible when a keyframe is selected)
        const deleteKeyframeButton = screen.getByRole('button', { name: /delete keyframe/i });

        // Click to delete the selected keyframe
        fireEvent.click(deleteKeyframeButton);

        // Check if delete keyframe action was dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'DELETE_KEYFRAME' && action.payload === 'keyframe1')).toBe(true);
    });

    test('navigates to previous keyframe', () => {
        // Set current time to be between keyframes
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

        // Find prev keyframe button
        const prevKeyframeButton = screen.getByRole('button', { name: /previous keyframe/i });

        // Click to go to previous keyframe
        fireEvent.click(prevKeyframeButton);

        // Check if set time action was dispatched with previous keyframe time
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'SET_TIMELINE_CURRENT_TIME' && action.payload === 10)).toBe(true);
    });

    test('navigates to next keyframe', () => {
        // Set current time to be between keyframes
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

        // Find next keyframe button
        const nextKeyframeButton = screen.getByRole('button', { name: /next keyframe/i });

        // Click to go to next keyframe
        fireEvent.click(nextKeyframeButton);

        // Check if set time action was dispatched with next keyframe time
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

        // Time should be displayed as 00:00 initially
        expect(screen.getByText('00:00 / 01:00')).toBeInTheDocument();

        // Change time to 25 seconds
        const timelineSlider = screen.getByTestId('timeline-slider');
        fireEvent.change(timelineSlider, { target: { value: '25' } });

        // Time display should update
        expect(screen.getByText('00:25 / 01:00')).toBeInTheDocument();

        // Change time to 65 seconds (beyond duration)
        fireEvent.change(timelineSlider, { target: { value: '65' } });

        // Time should be capped at duration
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

        // Find duration input
        const durationInput = screen.getByLabelText(/duration/i);

        // Change duration to 120 seconds
        fireEvent.change(durationInput, { target: { value: '120' } });
        fireEvent.blur(durationInput);

        // Check if update timeline action was dispatched
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'UPDATE_TIMELINE' && action.payload.duration === 120)).toBe(true);
    });

    test('handles playback with animation frame', async () => {
        // Mock that timeline is playing
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

        // Simulate time passing
        act(() => {
            // Trigger animation frame callback
            // Find the requestAnimationFrame call and execute its callback
            const animationCallback = window.requestAnimationFrame.mock.calls[0][0];
            // Simulate 1 second passed
            window.performance.now.mockReturnValue(1000);
            animationCallback(1000);
        });

        // Check if current time was updated
        const actions = store.getActions();
        // Should have advanced by ~1 second
        expect(actions.some(action =>
            action.type === 'SET_TIMELINE_CURRENT_TIME' &&
            action.payload > 5 &&
            action.payload <= 6
        )).toBe(true);
    });

    test('stops playback at the end of timeline', async () => {
        // Mock that timeline is playing and near the end
        store = mockStore({
            ...store.getState(),
            timeline: {
                ...store.getState().timeline,
                isPlaying: true,
                currentTime: 59 // 1 second from the end
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Timeline />
                </BrowserRouter>
            </Provider>
        );

        // Simulate time passing that would go beyond the end
        act(() => {
            const animationCallback = window.requestAnimationFrame.mock.calls[0][0];
            window.performance.now.mockReturnValue(2000); // 2 seconds passed
            animationCallback(2000);
        });

        // Check if it stopped at the end
        const actions = store.getActions();

        // Should have set time to duration (60)
        expect(actions.some(action =>
            action.type === 'SET_TIMELINE_CURRENT_TIME' &&
            action.payload === 60
        )).toBe(true);

        // Should have set playing to false
        expect(actions.some(action =>
            action.type === 'SET_TIMELINE_PLAYING' &&
            action.payload === false
        )).toBe(true);
    });
}); 