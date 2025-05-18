import * as types from '../actions/types';

const initialState = {
    list: [],
    currentProject: null,
    isLoading: false,
    error: null
};

const projectReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.PROJECT_LOADING:
            return {
                ...state,
                isLoading: true,
                error: null
            };

        case types.GET_PROJECTS_SUCCESS:
            return {
                ...state,
                list: action.payload,
                isLoading: false
            };

        case types.GET_PROJECTS_FAIL:
            return {
                ...state,
                list: [],
                isLoading: false,
                error: action.payload
            };

        case types.GET_PROJECT_SUCCESS:
            return {
                ...state,
                currentProject: action.payload,
                isLoading: false
            };

        case types.GET_PROJECT_FAIL:
            return {
                ...state,
                currentProject: null,
                isLoading: false,
                error: action.payload
            };

        case types.CREATE_PROJECT_SUCCESS:
            return {
                ...state,
                list: [...state.list, action.payload],
                currentProject: action.payload,
                isLoading: false
            };

        case types.CREATE_PROJECT_FAIL:
            return {
                ...state,
                isLoading: false,
                error: action.payload
            };

        case types.UPDATE_PROJECT_SUCCESS:
            return {
                ...state,
                list: state.list.map(project =>
                    project._id === action.payload._id ? action.payload : project
                ),
                currentProject: action.payload,
                isLoading: false
            };

        case types.UPDATE_PROJECT_FAIL:
            return {
                ...state,
                isLoading: false,
                error: action.payload
            };

        case types.DELETE_PROJECT_SUCCESS:
            return {
                ...state,
                list: state.list.filter(project => project._id !== action.payload),
                isLoading: false
            };

        case types.DELETE_PROJECT_FAIL:
            return {
                ...state,
                isLoading: false,
                error: action.payload
            };

        case types.ADD_ELEMENT_SUCCESS:
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    elements: [...state.currentProject.elements, action.payload]
                },
                isLoading: false
            };

        case types.UPDATE_ELEMENT_SUCCESS:
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    elements: state.currentProject.elements.map(element =>
                        element._id === action.payload._id ? action.payload : element
                    )
                },
                isLoading: false
            };

        case types.DELETE_ELEMENT_SUCCESS:
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    elements: state.currentProject.elements.filter(
                        element => element._id !== action.payload
                    )
                },
                isLoading: false
            };

        case types.CLEAR_PROJECT_ERRORS:
            return {
                ...state,
                error: null
            };

        default:
            return state;
    }
};

export default projectReducer; 