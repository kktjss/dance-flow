import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as actions from '../../../../client/src/actions/projectActions';
import * as types from '../../../../client/src/actions/types';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);
const mock = new MockAdapter(axios);

describe('Project Action Creators', () => {
    beforeEach(() => {
        mock.reset();
        localStorage.setItem('token', 'test-token');
        jest.clearAllMocks();
    });

    describe('getProjects', () => {
        it('creates GET_PROJECTS_SUCCESS when fetching projects is successful', () => {
            const projects = [
                { _id: 'project1', name: 'Project 1', description: 'Test Project 1' },
                { _id: 'project2', name: 'Project 2', description: 'Test Project 2' }
            ];

            mock.onGet('/api/projects').reply(200, projects);

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.GET_PROJECTS_SUCCESS,
                    payload: projects
                }
            ];

            const store = mockStore({ projects: { list: [] } });

            return store.dispatch(actions.getProjects()).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates GET_PROJECTS_FAIL when fetching projects fails', () => {
            const errorMessage = 'Server error';

            mock.onGet('/api/projects').reply(500, { message: errorMessage });

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.GET_PROJECTS_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({ projects: { list: [] } });

            return store.dispatch(actions.getProjects()).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });

    describe('getProject', () => {
        it('creates GET_PROJECT_SUCCESS when fetching a single project is successful', () => {
            const projectId = 'project1';
            const project = {
                _id: projectId,
                name: 'Project 1',
                description: 'Test Project 1',
                elements: [],
                timeline: { duration: 60, keyframes: [] }
            };

            mock.onGet(`/api/projects/${projectId}`).reply(200, project);

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.GET_PROJECT_SUCCESS,
                    payload: project
                }
            ];

            const store = mockStore({ projects: { currentProject: null } });

            return store.dispatch(actions.getProject(projectId)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates GET_PROJECT_FAIL when fetching a single project fails', () => {
            const projectId = 'nonexistent';
            const errorMessage = 'Project not found';

            mock.onGet(`/api/projects/${projectId}`).reply(404, { message: errorMessage });

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.GET_PROJECT_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({ projects: { currentProject: null } });

            return store.dispatch(actions.getProject(projectId)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });

    describe('createProject', () => {
        it('creates CREATE_PROJECT_SUCCESS when creating a project is successful', () => {
            const newProject = {
                name: 'New Project',
                description: 'New Test Project',
                teamId: 'team1'
            };

            const createdProject = {
                _id: 'newproject',
                name: 'New Project',
                description: 'New Test Project',
                teamId: 'team1',
                createdBy: 'user1',
                elements: [],
                timeline: { duration: 60, keyframes: [] },
                createdAt: new Date().toISOString()
            };

            mock.onPost('/api/projects').reply(201, createdProject);

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.CREATE_PROJECT_SUCCESS,
                    payload: createdProject
                }
            ];

            const store = mockStore({ projects: { list: [] } });

            return store.dispatch(actions.createProject(newProject)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates CREATE_PROJECT_FAIL when creating a project fails', () => {
            const newProject = {
                name: '', // Invalid - empty name
                description: 'New Test Project',
                teamId: 'team1'
            };

            const errorMessage = 'Project name is required';

            mock.onPost('/api/projects').reply(400, { message: errorMessage });

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.CREATE_PROJECT_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({ projects: { list: [] } });

            return store.dispatch(actions.createProject(newProject)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });

    describe('updateProject', () => {
        it('creates UPDATE_PROJECT_SUCCESS when updating a project is successful', () => {
            const projectId = 'project1';
            const updates = {
                name: 'Updated Project',
                description: 'Updated Test Project'
            };

            const updatedProject = {
                _id: projectId,
                name: 'Updated Project',
                description: 'Updated Test Project',
                elements: [],
                timeline: { duration: 60, keyframes: [] }
            };

            mock.onPut(`/api/projects/${projectId}`).reply(200, updatedProject);

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.UPDATE_PROJECT_SUCCESS,
                    payload: updatedProject
                }
            ];

            const store = mockStore({
                projects: {
                    currentProject: {
                        _id: projectId,
                        name: 'Project 1',
                        description: 'Test Project 1'
                    }
                }
            });

            return store.dispatch(actions.updateProject(projectId, updates)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates UPDATE_PROJECT_FAIL when updating a project fails', () => {
            const projectId = 'project1';
            const updates = {
                name: '' // Invalid - empty name
            };

            const errorMessage = 'Project name is required';

            mock.onPut(`/api/projects/${projectId}`).reply(400, { message: errorMessage });

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.UPDATE_PROJECT_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({
                projects: {
                    currentProject: {
                        _id: projectId,
                        name: 'Project 1',
                        description: 'Test Project 1'
                    }
                }
            });

            return store.dispatch(actions.updateProject(projectId, updates)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });

    describe('deleteProject', () => {
        it('creates DELETE_PROJECT_SUCCESS when deleting a project is successful', () => {
            const projectId = 'project1';

            mock.onDelete(`/api/projects/${projectId}`).reply(200, { message: 'Project deleted successfully' });

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.DELETE_PROJECT_SUCCESS,
                    payload: projectId
                }
            ];

            const store = mockStore({
                projects: {
                    list: [
                        { _id: 'project1', name: 'Project 1' },
                        { _id: 'project2', name: 'Project 2' }
                    ]
                }
            });

            return store.dispatch(actions.deleteProject(projectId)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates DELETE_PROJECT_FAIL when deleting a project fails', () => {
            const projectId = 'project1';
            const errorMessage = 'Not authorized to delete this project';

            mock.onDelete(`/api/projects/${projectId}`).reply(403, { message: errorMessage });

            const expectedActions = [
                { type: types.PROJECT_LOADING },
                {
                    type: types.DELETE_PROJECT_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({
                projects: {
                    list: [
                        { _id: 'project1', name: 'Project 1' },
                        { _id: 'project2', name: 'Project 2' }
                    ]
                }
            });

            return store.dispatch(actions.deleteProject(projectId)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });

    describe('addElement', () => {
        it('creates ADD_ELEMENT_SUCCESS when adding an element is successful', () => {
            const projectId = 'project1';
            const element = {
                type: 'rectangle',
                position: { x: 10, y: 10 },
                width: 100,
                height: 50,
                color: '#ff0000'
            };

            const createdElement = {
                _id: 'element1',
                ...element,
                projectId
            };

            mock.onPost(`/api/projects/${projectId}/elements`).reply(201, createdElement);

            const expectedActions = [
                { type: types.CANVAS_LOADING },
                {
                    type: types.ADD_ELEMENT_SUCCESS,
                    payload: createdElement
                }
            ];

            const store = mockStore({
                projects: {
                    currentProject: {
                        _id: projectId,
                        elements: []
                    }
                }
            });

            return store.dispatch(actions.addElement(projectId, element)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates ADD_ELEMENT_FAIL when adding an element fails', () => {
            const projectId = 'project1';
            const element = {
                // Missing required fields
                type: 'rectangle'
            };

            const errorMessage = 'Element position is required';

            mock.onPost(`/api/projects/${projectId}/elements`).reply(400, { message: errorMessage });

            const expectedActions = [
                { type: types.CANVAS_LOADING },
                {
                    type: types.ADD_ELEMENT_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({
                projects: {
                    currentProject: {
                        _id: projectId,
                        elements: []
                    }
                }
            });

            return store.dispatch(actions.addElement(projectId, element)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });

    describe('updateElement', () => {
        it('creates UPDATE_ELEMENT_SUCCESS when updating an element is successful', () => {
            const projectId = 'project1';
            const elementId = 'element1';
            const updates = {
                position: { x: 20, y: 20 },
                width: 150
            };

            const updatedElement = {
                _id: elementId,
                type: 'rectangle',
                position: { x: 20, y: 20 },
                width: 150,
                height: 50,
                color: '#ff0000',
                projectId
            };

            mock.onPut(`/api/projects/${projectId}/elements/${elementId}`).reply(200, updatedElement);

            const expectedActions = [
                { type: types.CANVAS_LOADING },
                {
                    type: types.UPDATE_ELEMENT_SUCCESS,
                    payload: updatedElement
                }
            ];

            const store = mockStore({
                projects: {
                    currentProject: {
                        _id: projectId,
                        elements: [
                            {
                                _id: elementId,
                                type: 'rectangle',
                                position: { x: 10, y: 10 },
                                width: 100,
                                height: 50,
                                color: '#ff0000'
                            }
                        ]
                    }
                }
            });

            return store.dispatch(actions.updateElement(projectId, elementId, updates)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates UPDATE_ELEMENT_FAIL when updating an element fails', () => {
            const projectId = 'project1';
            const elementId = 'element1';
            const updates = {
                position: 'invalid-position' // Invalid position format
            };

            const errorMessage = 'Invalid position format';

            mock.onPut(`/api/projects/${projectId}/elements/${elementId}`).reply(400, { message: errorMessage });

            const expectedActions = [
                { type: types.CANVAS_LOADING },
                {
                    type: types.UPDATE_ELEMENT_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({
                projects: {
                    currentProject: {
                        _id: projectId,
                        elements: [
                            {
                                _id: elementId,
                                type: 'rectangle',
                                position: { x: 10, y: 10 },
                                width: 100,
                                height: 50,
                                color: '#ff0000'
                            }
                        ]
                    }
                }
            });

            return store.dispatch(actions.updateElement(projectId, elementId, updates)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });

    describe('deleteElement', () => {
        it('creates DELETE_ELEMENT_SUCCESS when deleting an element is successful', () => {
            const projectId = 'project1';
            const elementId = 'element1';

            mock.onDelete(`/api/projects/${projectId}/elements/${elementId}`).reply(200, { message: 'Element deleted successfully' });

            const expectedActions = [
                { type: types.CANVAS_LOADING },
                {
                    type: types.DELETE_ELEMENT_SUCCESS,
                    payload: elementId
                }
            ];

            const store = mockStore({
                projects: {
                    currentProject: {
                        _id: projectId,
                        elements: [
                            {
                                _id: elementId,
                                type: 'rectangle',
                                position: { x: 10, y: 10 },
                                width: 100,
                                height: 50,
                                color: '#ff0000'
                            }
                        ]
                    }
                }
            });

            return store.dispatch(actions.deleteElement(projectId, elementId)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates DELETE_ELEMENT_FAIL when deleting an element fails', () => {
            const projectId = 'project1';
            const elementId = 'nonexistent';
            const errorMessage = 'Element not found';

            mock.onDelete(`/api/projects/${projectId}/elements/${elementId}`).reply(404, { message: errorMessage });

            const expectedActions = [
                { type: types.CANVAS_LOADING },
                {
                    type: types.DELETE_ELEMENT_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({
                projects: {
                    currentProject: {
                        _id: projectId,
                        elements: []
                    }
                }
            });

            return store.dispatch(actions.deleteElement(projectId, elementId)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });
}); 