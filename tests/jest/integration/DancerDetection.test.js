import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import axios from 'axios';
import ConstructorPage from '../../../client/src/pages/ConstructorPage';

// Mock axios
jest.mock('axios');

// Mock modules that interact with the API
jest.mock('../../../client/src/services/api', () => ({
    processVideoFrame: jest.fn().mockImplementation((frameData, options) => {
        // Simulate API response for pose detection
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
                            v: 0.9  // visibility
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

// Mock video element functionality
window.HTMLVideoElement.prototype.play = jest.fn().mockImplementation(function () {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
});

window.HTMLVideoElement.prototype.pause = jest.fn().mockImplementation(function () {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
});

// Create a URL.createObjectURL mock
URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/test');
URL.revokeObjectURL = jest.fn();

// Configure mock store
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Dancer Detection Integration Test', () => {
    let store;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create a canvas mock
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

        // Mock Element.prototype.getBoundingClientRect
        Element.prototype.getBoundingClientRect = jest.fn().mockReturnValue({
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            right: 800,
            bottom: 600
        });

        // Create mock redux store with initial state
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
        // Mock video
        const mockFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });
        const mockUrl = URL.createObjectURL(mockFile);

        // Render the constructor page
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ConstructorPage />
                </BrowserRouter>
            </Provider>
        );

        // Wait for the page to load
        await waitFor(() => {
            expect(screen.getByTestId('constructor-page')).toBeInTheDocument();
        });

        // Click on video upload/add button
        const uploadButton = screen.getByRole('button', { name: /Add Video/i });
        fireEvent.click(uploadButton);

        // Find file input and upload a video file
        const fileInput = screen.getByTestId('video-upload-input');
        fireEvent.change(fileInput, { target: { files: [mockFile] } });

        // Wait for video to be loaded
        await waitFor(() => {
            expect(screen.getByTestId('video-player')).toBeInTheDocument();
        });

        // Click the Find Dancer button to enter dancer detection mode
        const findDancerButton = screen.getByRole('button', { name: /Find Dancer/i });
        fireEvent.click(findDancerButton);

        // Verify that the video is paused for dancer selection
        const videoElement = screen.getByTestId('video-player');
        expect(videoElement.paused).toBe(true);

        // Click on the video to detect a dancer
        const canvasOverlay = screen.getByTestId('video-analyzer-canvas');
        fireEvent.click(canvasOverlay, { clientX: 400, clientY: 300 });

        // Wait for dancer detection request and processing
        await waitFor(() => {
            // Verify that processVideoFrame was called with correct parameters
            const { processVideoFrame } = require('../../../client/src/services/api');
            expect(processVideoFrame).toHaveBeenCalledWith(
                expect.any(Blob),
                expect.objectContaining({
                    click_x: expect.any(Number),
                    click_y: expect.any(Number)
                })
            );
        });

        // Verify that a dancer was detected and highlighted
        const dancerOutline = screen.getByTestId('dancer-outline');
        expect(dancerOutline).toBeInTheDocument();

        // Verify that dancer selection controls are shown
        expect(screen.getByText(/Selected Dancer/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Clear Selection/i })).toBeInTheDocument();

        // Click to clear the dancer selection
        const clearButton = screen.getByRole('button', { name: /Clear Selection/i });
        fireEvent.click(clearButton);

        // Verify that the dancer selection has been cleared
        await waitFor(() => {
            expect(screen.queryByTestId('dancer-outline')).not.toBeInTheDocument();
        });

        // Exit dancer detection mode
        const exitButton = screen.getByRole('button', { name: /Exit Dancer Detection/i });
        fireEvent.click(exitButton);

        // Verify that we're back to normal mode
        await waitFor(() => {
            expect(screen.queryByText(/Selected Dancer/i)).not.toBeInTheDocument();
            expect(findDancerButton).toBeInTheDocument();
        });
    });

    test('persists dancer detection across video playback', async () => {
        // Mock video file and URL
        const mockFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });
        const mockUrl = URL.createObjectURL(mockFile);

        // Mock video timestamps and current time
        let currentTime = 0;
        Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
            get: function () { return currentTime; },
            set: function (newTime) { currentTime = newTime; }
        });

        // Render constructor page
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <ConstructorPage />
                </BrowserRouter>
            </Provider>
        );

        // Upload a video
        const uploadButton = screen.getByRole('button', { name: /Add Video/i });
        fireEvent.click(uploadButton);

        const fileInput = screen.getByTestId('video-upload-input');
        fireEvent.change(fileInput, { target: { files: [mockFile] } });

        // Wait for video to load
        await waitFor(() => {
            expect(screen.getByTestId('video-player')).toBeInTheDocument();
        });

        // Go to dancer detection mode
        const findDancerButton = screen.getByRole('button', { name: /Find Dancer/i });
        fireEvent.click(findDancerButton);

        // Select a dancer
        const canvasOverlay = screen.getByTestId('video-analyzer-canvas');
        fireEvent.click(canvasOverlay, { clientX: 400, clientY: 300 });

        // Wait for dancer detection
        await waitFor(() => {
            expect(screen.getByTestId('dancer-outline')).toBeInTheDocument();
        });

        // Exit dancer detection mode
        const exitButton = screen.getByRole('button', { name: /Exit Dancer Detection/i });
        fireEvent.click(exitButton);

        // Play the video
        const playButton = screen.getByRole('button', { name: /Play/i });
        fireEvent.click(playButton);

        // Simulate time update event
        const videoElement = screen.getByTestId('video-player');
        act(() => {
            currentTime = 2.0;
            videoElement.dispatchEvent(new Event('timeupdate'));
        });

        // Verify dancer outline is still visible during playback
        expect(screen.getByTestId('dancer-outline')).toBeInTheDocument();

        // Pause the video
        const pauseButton = screen.getByRole('button', { name: /Pause/i });
        fireEvent.click(pauseButton);

        // Seek to a different time
        act(() => {
            currentTime = 5.0;
            videoElement.dispatchEvent(new Event('seeked'));
        });

        // Verify dancer outline is updated for the new time position
        await waitFor(() => {
            const { processVideoFrame } = require('../../../client/src/services/api');
            expect(processVideoFrame).toHaveBeenCalledTimes(2);
        });

        // Dancer outline should still be visible
        expect(screen.getByTestId('dancer-outline')).toBeInTheDocument();
    });
}); 