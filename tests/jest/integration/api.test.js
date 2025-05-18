import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { setupTestServer, teardownTestServer } from '../setup/testServer';
import { loginUser, getUser, registerUser } from '../../../client/src/services/authService';
import {
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject
} from '../../../client/src/services/projectService';
import {
    processVideoFrame,
    analyzeDanceVideo,
    compareWithReference
} from '../../../client/src/services/videoService';

// Create axios mock
const mock = new MockAdapter(axios);
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

describe('API Integration Tests', () => {
    let server;
    const testUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com'
    };
    const token = 'test.jwt.token';

    beforeAll(async () => {
        // Start test server if using real backend for integration tests
        // server = await setupTestServer();
    });

    afterAll(async () => {
        // Close test server
        // await teardownTestServer(server);
        mock.restore();
    });

    beforeEach(() => {
        mock.reset();
        localStorage.clear();
        localStorage.setItem('token', token);

        // Mock the API URL and add common headers
        axios.defaults.baseURL = API_URL;
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    });

    describe('Auth API', () => {
        test('login returns user and token', async () => {
            const credentials = { email: 'test@example.com', password: 'password' };
            const expectedResponse = { token, user: testUser };

            mock.onPost(`${API_URL}/auth/login`).reply(200, expectedResponse);

            const response = await loginUser(credentials);

            expect(response.data).toEqual(expectedResponse);
            expect(localStorage.getItem('token')).toBe(token);
        });

        test('getUser returns authenticated user', async () => {
            mock.onGet(`${API_URL}/auth/user`).reply(200, testUser);

            const response = await getUser();

            expect(response.data).toEqual(testUser);
        });

        test('registerUser creates new user account', async () => {
            const newUser = {
                username: 'newuser',
                email: 'new@example.com',
                password: 'password',
                confirmPassword: 'password'
            };

            const expectedResponse = {
                token: 'new.jwt.token',
                user: {
                    _id: 'newuser123',
                    username: 'newuser',
                    email: 'new@example.com'
                }
            };

            mock.onPost(`${API_URL}/auth/register`).reply(201, expectedResponse);

            const response = await registerUser(newUser);

            expect(response.data).toEqual(expectedResponse);
            expect(response.status).toBe(201);
        });

        test('login handles invalid credentials', async () => {
            const credentials = { email: 'test@example.com', password: 'wrongpassword' };
            const errorResponse = { message: 'Invalid credentials' };

            mock.onPost(`${API_URL}/auth/login`).reply(401, errorResponse);

            try {
                await loginUser(credentials);
                fail('Login should have thrown an error');
            } catch (error) {
                expect(error.response.status).toBe(401);
                expect(error.response.data).toEqual(errorResponse);
            }
        });
    });

    describe('Projects API', () => {
        const testProjects = [
            { _id: 'project1', name: 'Project 1', description: 'Test Project 1' },
            { _id: 'project2', name: 'Project 2', description: 'Test Project 2' }
        ];

        const testProject = {
            _id: 'project1',
            name: 'Project 1',
            description: 'Test Project 1',
            elements: [],
            timeline: { duration: 60, keyframes: [] }
        };

        test('getProjects retrieves all projects', async () => {
            mock.onGet(`${API_URL}/projects`).reply(200, testProjects);

            const response = await getProjects();

            expect(response.data).toEqual(testProjects);
            expect(response.status).toBe(200);
        });

        test('getProject retrieves a specific project', async () => {
            const projectId = 'project1';

            mock.onGet(`${API_URL}/projects/${projectId}`).reply(200, testProject);

            const response = await getProject(projectId);

            expect(response.data).toEqual(testProject);
            expect(response.status).toBe(200);
        });

        test('createProject creates a new project', async () => {
            const newProject = {
                name: 'New Project',
                description: 'New Test Project',
                teamId: 'team1'
            };

            const createdProject = {
                _id: 'newproject',
                ...newProject,
                elements: [],
                timeline: { duration: 60, keyframes: [] },
                createdBy: 'user123',
                createdAt: new Date().toISOString()
            };

            mock.onPost(`${API_URL}/projects`).reply(201, createdProject);

            const response = await createProject(newProject);

            expect(response.data).toEqual(createdProject);
            expect(response.status).toBe(201);
        });

        test('updateProject updates project details', async () => {
            const projectId = 'project1';
            const updates = {
                name: 'Updated Project',
                description: 'Updated Test Project'
            };

            const updatedProject = {
                ...testProject,
                ...updates
            };

            mock.onPut(`${API_URL}/projects/${projectId}`).reply(200, updatedProject);

            const response = await updateProject(projectId, updates);

            expect(response.data).toEqual(updatedProject);
            expect(response.status).toBe(200);
        });

        test('deleteProject removes a project', async () => {
            const projectId = 'project1';
            const successResponse = { message: 'Project deleted successfully' };

            mock.onDelete(`${API_URL}/projects/${projectId}`).reply(200, successResponse);

            const response = await deleteProject(projectId);

            expect(response.data).toEqual(successResponse);
            expect(response.status).toBe(200);
        });

        test('getProject handles not found', async () => {
            const projectId = 'nonexistent';
            const errorResponse = { message: 'Project not found' };

            mock.onGet(`${API_URL}/projects/${projectId}`).reply(404, errorResponse);

            try {
                await getProject(projectId);
                fail('getProject should have thrown an error');
            } catch (error) {
                expect(error.response.status).toBe(404);
                expect(error.response.data).toEqual(errorResponse);
            }
        });
    });

    describe('Video API', () => {
        test('processVideoFrame detects poses', async () => {
            const mockFrameData = 'data:image/jpeg;base64,mockbase64data';
            const mockDetectionOptions = { threshold: 0.5, maxPoses: 5 };

            const expectedResponse = {
                found: true,
                poses: [
                    {
                        score: 0.98,
                        keypoints: [
                            { x: 0.5, y: 0.2, score: 0.99, name: 'nose' },
                            { x: 0.52, y: 0.2, score: 0.98, name: 'leftEye' },
                            // More keypoints would be here
                        ]
                    }
                ],
                image: 'data:image/jpeg;base64,processedimagedata'
            };

            mock.onPost(`${API_URL}/video/process-frame`).reply(200, expectedResponse);

            const response = await processVideoFrame(mockFrameData, mockDetectionOptions);

            expect(response.data).toEqual(expectedResponse);
            expect(response.status).toBe(200);
        });

        test('analyzeDanceVideo compares dance with reference', async () => {
            const danceVideo = { file: new File(['mockdata'], 'dance.mp4') };
            const referenceVideo = { file: new File(['mockdata'], 'reference.mp4') };

            const expectedResponse = {
                overall_score: 85,
                timing: {
                    score: 82,
                    details: 'Good synchronization but some delays on turns'
                },
                technique: {
                    score: 88,
                    details: 'Good form on most moves, work on arm positions'
                },
                frame_scores: [
                    { time: 1.2, score: 92 },
                    { time: 2.5, score: 78 },
                    // More frame scores would be here
                ]
            };

            // Mock the file upload endpoint
            mock.onPost(`${API_URL}/video/analyze`).reply(200, expectedResponse);

            const response = await analyzeDanceVideo(danceVideo, referenceVideo);

            expect(response.data).toEqual(expectedResponse);
            expect(response.status).toBe(200);
        });

        test('compareWithReference compares poses in real-time', async () => {
            const currentPose = {
                keypoints: [
                    { x: 0.5, y: 0.2, score: 0.99, name: 'nose' },
                    { x: 0.52, y: 0.2, score: 0.98, name: 'leftEye' },
                    // More keypoints would be here
                ]
            };

            const referenceId = 'ref123';
            const timestamp = 5.5; // seconds

            const expectedResponse = {
                score: 87,
                matching_parts: {
                    upper_body: 92,
                    lower_body: 82,
                    head_position: 89
                },
                corrections: [
                    { part: 'right_arm', message: 'Raise your arm higher' },
                    { part: 'left_knee', message: 'Bend your knee more' }
                ]
            };

            mock.onPost(`${API_URL}/video/compare`).reply(200, expectedResponse);

            const response = await compareWithReference(currentPose, referenceId, timestamp);

            expect(response.data).toEqual(expectedResponse);
            expect(response.status).toBe(200);
        });

        test('processVideoFrame handles empty frame', async () => {
            const emptyFrame = '';
            const errorResponse = { message: 'Invalid frame data' };

            mock.onPost(`${API_URL}/video/process-frame`).reply(400, errorResponse);

            try {
                await processVideoFrame(emptyFrame);
                fail('processVideoFrame should have thrown an error');
            } catch (error) {
                expect(error.response.status).toBe(400);
                expect(error.response.data).toEqual(errorResponse);
            }
        });
    });
}); 