import projectReducer from '../../../../client/src/reducers/projectReducer';
import * as types from '../../../../client/src/actions/types';

describe('Project Reducer', () => {
    // Начальное состояние
    const initialState = {
        list: [],
        currentProject: null,
        isLoading: false,
        error: null
    };

    // Тест для проверки начального состояния
    it('должен вернуть начальное состояние', () => {
        expect(projectReducer(undefined, {})).toEqual(initialState);
    });

    // Тест для PROJECT_LOADING
    it('должен обработать PROJECT_LOADING', () => {
        const action = {
            type: types.PROJECT_LOADING
        };

        const expectedState = {
            ...initialState,
            isLoading: true,
            error: null
        };

        expect(projectReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для GET_PROJECTS_SUCCESS
    it('должен обработать GET_PROJECTS_SUCCESS', () => {
        const projects = [
            { _id: 'project1', name: 'Проект 1', description: 'Тестовый проект 1' },
            { _id: 'project2', name: 'Проект 2', description: 'Тестовый проект 2' }
        ];

        const action = {
            type: types.GET_PROJECTS_SUCCESS,
            payload: projects
        };

        const expectedState = {
            ...initialState,
            list: projects,
            isLoading: false
        };

        expect(projectReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для GET_PROJECTS_FAIL
    it('должен обработать GET_PROJECTS_FAIL', () => {
        const errorMessage = { message: 'Ошибка получения проектов' };

        const action = {
            type: types.GET_PROJECTS_FAIL,
            payload: errorMessage
        };

        const expectedState = {
            ...initialState,
            list: [],
            isLoading: false,
            error: errorMessage
        };

        expect(projectReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для GET_PROJECT_SUCCESS
    it('должен обработать GET_PROJECT_SUCCESS', () => {
        const project = {
            _id: 'project1',
            name: 'Проект 1',
            description: 'Тестовый проект 1',
            elements: [],
            timeline: { duration: 60, keyframes: [] }
        };

        const action = {
            type: types.GET_PROJECT_SUCCESS,
            payload: project
        };

        const expectedState = {
            ...initialState,
            currentProject: project,
            isLoading: false
        };

        expect(projectReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для GET_PROJECT_FAIL
    it('должен обработать GET_PROJECT_FAIL', () => {
        const errorMessage = { message: 'Проект не найден' };

        const action = {
            type: types.GET_PROJECT_FAIL,
            payload: errorMessage
        };

        const expectedState = {
            ...initialState,
            currentProject: null,
            isLoading: false,
            error: errorMessage
        };

        expect(projectReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для CREATE_PROJECT_SUCCESS
    it('должен обработать CREATE_PROJECT_SUCCESS', () => {
        const newProject = {
            _id: 'project3',
            name: 'Новый проект',
            description: 'Новый тестовый проект',
            elements: [],
            timeline: { duration: 60, keyframes: [] }
        };

        const action = {
            type: types.CREATE_PROJECT_SUCCESS,
            payload: newProject
        };

        const expectedState = {
            ...initialState,
            list: [...initialState.list, newProject],
            currentProject: newProject,
            isLoading: false
        };

        expect(projectReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для CREATE_PROJECT_FAIL
    it('должен обработать CREATE_PROJECT_FAIL', () => {
        const errorMessage = { message: 'Ошибка при создании проекта' };

        const action = {
            type: types.CREATE_PROJECT_FAIL,
            payload: errorMessage
        };

        const expectedState = {
            ...initialState,
            isLoading: false,
            error: errorMessage
        };

        expect(projectReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для UPDATE_PROJECT_SUCCESS
    it('должен обработать UPDATE_PROJECT_SUCCESS', () => {
        // Исходное состояние с проектами
        const stateWithProjects = {
            ...initialState,
            list: [
                { _id: 'project1', name: 'Проект 1', description: 'Тестовый проект 1' },
                { _id: 'project2', name: 'Проект 2', description: 'Тестовый проект 2' }
            ],
            currentProject: { _id: 'project1', name: 'Проект 1', description: 'Тестовый проект 1' }
        };

        const updatedProject = {
            _id: 'project1',
            name: 'Обновленный проект',
            description: 'Обновленный тестовый проект',
            elements: []
        };

        const action = {
            type: types.UPDATE_PROJECT_SUCCESS,
            payload: updatedProject
        };

        const expectedState = {
            ...stateWithProjects,
            list: [
                updatedProject,
                { _id: 'project2', name: 'Проект 2', description: 'Тестовый проект 2' }
            ],
            currentProject: updatedProject,
            isLoading: false
        };

        expect(projectReducer(stateWithProjects, action)).toEqual(expectedState);
    });

    // Тест для UPDATE_PROJECT_FAIL
    it('должен обработать UPDATE_PROJECT_FAIL', () => {
        const errorMessage = { message: 'Ошибка при обновлении проекта' };

        const action = {
            type: types.UPDATE_PROJECT_FAIL,
            payload: errorMessage
        };

        const expectedState = {
            ...initialState,
            isLoading: false,
            error: errorMessage
        };

        expect(projectReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для DELETE_PROJECT_SUCCESS
    it('должен обработать DELETE_PROJECT_SUCCESS', () => {
        // Исходное состояние с проектами
        const stateWithProjects = {
            ...initialState,
            list: [
                { _id: 'project1', name: 'Проект 1', description: 'Тестовый проект 1' },
                { _id: 'project2', name: 'Проект 2', description: 'Тестовый проект 2' }
            ]
        };

        const action = {
            type: types.DELETE_PROJECT_SUCCESS,
            payload: 'project1'
        };

        const expectedState = {
            ...stateWithProjects,
            list: [
                { _id: 'project2', name: 'Проект 2', description: 'Тестовый проект 2' }
            ],
            isLoading: false
        };

        expect(projectReducer(stateWithProjects, action)).toEqual(expectedState);
    });

    // Тест для DELETE_PROJECT_FAIL
    it('должен обработать DELETE_PROJECT_FAIL', () => {
        const errorMessage = { message: 'Ошибка при удалении проекта' };

        const action = {
            type: types.DELETE_PROJECT_FAIL,
            payload: errorMessage
        };

        const expectedState = {
            ...initialState,
            isLoading: false,
            error: errorMessage
        };

        expect(projectReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для ADD_ELEMENT_SUCCESS
    it('должен обработать ADD_ELEMENT_SUCCESS', () => {
        // Исходное состояние с текущим проектом
        const stateWithCurrentProject = {
            ...initialState,
            currentProject: {
                _id: 'project1',
                name: 'Проект 1',
                elements: []
            }
        };

        const newElement = {
            _id: 'element1',
            type: 'rectangle',
            position: { x: 10, y: 10 },
            width: 100,
            height: 50,
            color: '#ff0000'
        };

        const action = {
            type: types.ADD_ELEMENT_SUCCESS,
            payload: newElement
        };

        const expectedState = {
            ...stateWithCurrentProject,
            currentProject: {
                ...stateWithCurrentProject.currentProject,
                elements: [...stateWithCurrentProject.currentProject.elements, newElement]
            },
            isLoading: false
        };

        expect(projectReducer(stateWithCurrentProject, action)).toEqual(expectedState);
    });

    // Тест для UPDATE_ELEMENT_SUCCESS
    it('должен обработать UPDATE_ELEMENT_SUCCESS', () => {
        // Исходное состояние с текущим проектом и элементами
        const stateWithElements = {
            ...initialState,
            currentProject: {
                _id: 'project1',
                name: 'Проект 1',
                elements: [
                    {
                        _id: 'element1',
                        type: 'rectangle',
                        position: { x: 10, y: 10 },
                        width: 100,
                        height: 50,
                        color: '#ff0000'
                    },
                    {
                        _id: 'element2',
                        type: 'circle',
                        position: { x: 150, y: 150 },
                        radius: 50,
                        color: '#00ff00'
                    }
                ]
            }
        };

        const updatedElement = {
            _id: 'element1',
            type: 'rectangle',
            position: { x: 20, y: 20 },
            width: 150,
            height: 50,
            color: '#ff0000'
        };

        const action = {
            type: types.UPDATE_ELEMENT_SUCCESS,
            payload: updatedElement
        };

        const expectedState = {
            ...stateWithElements,
            currentProject: {
                ...stateWithElements.currentProject,
                elements: [
                    updatedElement,
                    {
                        _id: 'element2',
                        type: 'circle',
                        position: { x: 150, y: 150 },
                        radius: 50,
                        color: '#00ff00'
                    }
                ]
            },
            isLoading: false
        };

        expect(projectReducer(stateWithElements, action)).toEqual(expectedState);
    });

    // Тест для DELETE_ELEMENT_SUCCESS
    it('должен обработать DELETE_ELEMENT_SUCCESS', () => {
        // Исходное состояние с текущим проектом и элементами
        const stateWithElements = {
            ...initialState,
            currentProject: {
                _id: 'project1',
                name: 'Проект 1',
                elements: [
                    {
                        _id: 'element1',
                        type: 'rectangle',
                        position: { x: 10, y: 10 },
                        width: 100,
                        height: 50,
                        color: '#ff0000'
                    },
                    {
                        _id: 'element2',
                        type: 'circle',
                        position: { x: 150, y: 150 },
                        radius: 50,
                        color: '#00ff00'
                    }
                ]
            }
        };

        const action = {
            type: types.DELETE_ELEMENT_SUCCESS,
            payload: 'element1'
        };

        const expectedState = {
            ...stateWithElements,
            currentProject: {
                ...stateWithElements.currentProject,
                elements: [
                    {
                        _id: 'element2',
                        type: 'circle',
                        position: { x: 150, y: 150 },
                        radius: 50,
                        color: '#00ff00'
                    }
                ]
            },
            isLoading: false
        };

        expect(projectReducer(stateWithElements, action)).toEqual(expectedState);
    });

    // Тест для CLEAR_PROJECT_ERRORS
    it('должен обработать CLEAR_PROJECT_ERRORS', () => {
        // Исходное состояние с ошибкой
        const stateWithError = {
            ...initialState,
            error: { message: 'Какая-то ошибка' }
        };

        const action = {
            type: types.CLEAR_PROJECT_ERRORS
        };

        const expectedState = {
            ...stateWithError,
            error: null
        };

        expect(projectReducer(stateWithError, action)).toEqual(expectedState);
    });
}); 