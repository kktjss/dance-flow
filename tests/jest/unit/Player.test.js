import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import Player from '../../../client/src/components/Player';

// Mock video element behavior
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

// Add missing properties to HTMLMediaElement
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

// Mock requestVideoFrameCallback for modern browsers
if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
        configurable: true,
        writable: true,
        value: jest.fn().mockImplementation(callback => {
            return setTimeout(() => callback(performance.now(), { width: 640, height: 480 }), 16.7);
        })
    });
}

// Mock URL object for video source
window.URL.createObjectURL = jest.fn().mockReturnValue('blob:https://example.com/mock-video');
window.URL.revokeObjectURL = jest.fn();

// Configure mock store
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Player Component', () => {
    let store;
    let mockVideo;

    beforeEach(() => {
        // Create mock video file
        mockVideo = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });

        // Create store with initial state
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

        // Check for video element
        const videoElement = await screen.findByTestId('video-player');
        expect(videoElement).toBeInTheDocument();

        // Check for video controls
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

        // Get video element and play button
        const videoElement = await screen.findByTestId('video-player');
        const playButton = screen.getByRole('button', { name: /play/i });

        // Initially video should be paused
        expect(videoElement.paused).toBe(true);

        // Click play button
        fireEvent.click(playButton);

        // Video should be playing
        expect(videoElement.play).toHaveBeenCalled();
        expect(videoElement.paused).toBe(false);

        // Button should change to pause
        const pauseButton = screen.getByRole('button', { name: /pause/i });
        expect(pauseButton).toBeInTheDocument();

        // Click pause button
        fireEvent.click(pauseButton);

        // Video should be paused
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

        // Get video element and time slider
        const videoElement = await screen.findByTestId('video-player');
        const timeSlider = screen.getByRole('slider', { name: /time slider/i });

        // Initially time should be 0
        expect(videoElement.currentTime).toBe(0);

        // Change time slider value to 50% (50 seconds for a 100-second video)
        fireEvent.change(timeSlider, { target: { value: '50' } });

        // Video should seek to new time
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

        // Get video element and volume button
        const videoElement = await screen.findByTestId('video-player');
        const volumeButton = screen.getByRole('button', { name: /volume/i });

        // Initially volume should be 1 (max)
        expect(videoElement.volume).toBe(1);
        expect(videoElement.muted).toBe(false);

        // Click volume button to show volume slider
        fireEvent.click(volumeButton);

        // Find volume slider
        const volumeSlider = screen.getByRole('slider', { name: /volume slider/i });
        expect(volumeSlider).toBeInTheDocument();

        // Change volume to 50%
        fireEvent.change(volumeSlider, { target: { value: '0.5' } });

        // Video volume should change
        expect(videoElement.volume).toBe(0.5);

        // Click volume button again to mute
        fireEvent.click(volumeButton);

        // Video should be muted
        expect(videoElement.muted).toBe(true);

        // Click again to unmute
        fireEvent.click(volumeButton);

        // Video should be unmuted
        expect(videoElement.muted).toBe(false);
    });

    test('toggles fullscreen mode', async () => {
        // Mock fullscreen API
        const mockRequestFullscreen = jest.fn();
        const mockExitFullscreen = jest.fn();

        document.documentElement.requestFullscreen = mockRequestFullscreen;
        document.exitFullscreen = mockExitFullscreen;

        // Mock fullscreen state
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

        // Get fullscreen button
        const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });

        // Click to enter fullscreen
        fireEvent.click(fullscreenButton);

        // Request fullscreen should be called
        expect(mockRequestFullscreen).toHaveBeenCalled();

        // Simulate entering fullscreen
        isFullscreen = true;

        // Dispatch fullscreen change event
        fireEvent(document, new Event('fullscreenchange'));

        // Click to exit fullscreen
        fireEvent.click(fullscreenButton);

        // Exit fullscreen should be called
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

        // Get video element
        const videoElement = await screen.findByTestId('video-player');

        // Initial time display should be 0:00 / 1:40 (for 100 second video)
        expect(screen.getByText('0:00 / 1:40')).toBeInTheDocument();

        // Update current time to 30 seconds
        act(() => {
            videoElement.currentTime = 30;
            videoElement.dispatchEvent(new Event('timeupdate'));
        });

        // Time display should update
        expect(screen.getByText('0:30 / 1:40')).toBeInTheDocument();

        // Update current time to 70 seconds
        act(() => {
            videoElement.currentTime = 70;
            videoElement.dispatchEvent(new Event('timeupdate'));
        });

        // Time display should update to 1:10 / 1:40
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

        // Get video element
        const videoElement = await screen.findByTestId('video-player');

        // Initial playback rate should be 1x
        expect(videoElement.playbackRate).toBe(1);

        // Find playback speed button
        const speedButton = screen.getByRole('button', { name: /1x/i });

        // Click to change speed to 1.5x
        fireEvent.click(speedButton);

        // Playback rate should change
        expect(videoElement.playbackRate).toBe(1.5);

        // Button should update to show new speed
        expect(screen.getByRole('button', { name: /1.5x/i })).toBeInTheDocument();

        // Click again to change to 2x
        const speed1_5Button = screen.getByRole('button', { name: /1.5x/i });
        fireEvent.click(speed1_5Button);

        // Playback rate should change
        expect(videoElement.playbackRate).toBe(2);

        // Button should update
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

        // Get video element
        const videoElement = await screen.findByTestId('video-player');

        // Initially video should be paused
        expect(videoElement.paused).toBe(true);

        // Press space key to play
        fireEvent.keyDown(document, { key: ' ' });

        // Video should play
        expect(videoElement.play).toHaveBeenCalled();
        expect(videoElement.paused).toBe(false);

        // Press space key to pause
        fireEvent.keyDown(document, { key: ' ' });

        // Video should pause
        expect(videoElement.pause).toHaveBeenCalled();
        expect(videoElement.paused).toBe(true);

        // Press right arrow to seek forward
        const initialTime = videoElement.currentTime;
        fireEvent.keyDown(document, { key: 'ArrowRight' });

        // Time should increase
        expect(videoElement.currentTime).toBeGreaterThan(initialTime);

        // Press left arrow to seek backward
        const currentTime = videoElement.currentTime;
        fireEvent.keyDown(document, { key: 'ArrowLeft' });

        // Time should decrease
        expect(videoElement.currentTime).toBeLessThan(currentTime);

        // Press 'm' to mute
        fireEvent.keyDown(document, { key: 'm' });

        // Video should be muted
        expect(videoElement.muted).toBe(true);

        // Press 'm' again to unmute
        fireEvent.keyDown(document, { key: 'm' });

        // Video should be unmuted
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

        // Get video element
        const videoElement = await screen.findByTestId('video-player');

        // Simulate video end
        act(() => {
            videoElement.dispatchEvent(new Event('ended'));
        });

        // Play button should be shown
        expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();

        // Dispatch actions should include video end event
        const actions = store.getActions();
        expect(actions.some(action => action.type === 'VIDEO_ENDED')).toBe(true);
    });
}); 