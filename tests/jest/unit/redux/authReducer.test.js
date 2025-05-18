import authReducer from '../../../../client/src/reducers/authReducer';
import * as types from '../../../../client/src/actions/types';

describe('Auth Reducer', () => {
    const initialState = {
        token: localStorage.getItem('token'),
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null
    };

    it('should return the initial state', () => {
        expect(authReducer(undefined, {})).toEqual(initialState);
    });

    it('should handle AUTH_LOADING', () => {
        const action = {
            type: types.AUTH_LOADING
        };
        const expectedState = {
            ...initialState,
            isLoading: true,
            error: null
        };
        expect(authReducer(initialState, action)).toEqual(expectedState);
    });

    it('should handle LOGIN_SUCCESS', () => {
        const payload = {
            token: 'test-token',
            user: { _id: '1', username: 'testuser', email: 'test@example.com' }
        };
        const action = {
            type: types.LOGIN_SUCCESS,
            payload
        };
        const expectedState = {
            ...initialState,
            token: payload.token,
            user: payload.user,
            isAuthenticated: true,
            isLoading: false
        };
        expect(authReducer(initialState, action)).toEqual(expectedState);
    });

    it('should handle REGISTER_SUCCESS', () => {
        const payload = {
            token: 'new-token',
            user: { _id: '2', username: 'newuser', email: 'new@example.com' }
        };
        const action = {
            type: types.REGISTER_SUCCESS,
            payload
        };
        const expectedState = {
            ...initialState,
            token: payload.token,
            user: payload.user,
            isAuthenticated: true,
            isLoading: false
        };
        expect(authReducer(initialState, action)).toEqual(expectedState);
    });

    it('should handle USER_LOADED', () => {
        const payload = { _id: '1', username: 'testuser', email: 'test@example.com' };
        const action = {
            type: types.USER_LOADED,
            payload
        };
        const expectedState = {
            ...initialState,
            isAuthenticated: true,
            isLoading: false,
            user: payload
        };
        expect(authReducer(initialState, action)).toEqual(expectedState);
    });

    it('should handle PROFILE_UPDATED', () => {
        const payload = { _id: '1', username: 'updateduser', email: 'updated@example.com' };
        const action = {
            type: types.PROFILE_UPDATED,
            payload
        };

        // Starting with a state that already has a user
        const startingState = {
            ...initialState,
            isAuthenticated: true,
            user: { _id: '1', username: 'testuser', email: 'test@example.com' }
        };

        const expectedState = {
            ...startingState,
            isLoading: false,
            user: payload
        };
        expect(authReducer(startingState, action)).toEqual(expectedState);
    });

    it('should handle LOGIN_FAIL', () => {
        const errorPayload = { message: 'Invalid credentials' };
        const action = {
            type: types.LOGIN_FAIL,
            payload: errorPayload
        };
        const expectedState = {
            ...initialState,
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorPayload
        };
        expect(authReducer(initialState, action)).toEqual(expectedState);
    });

    it('should handle REGISTER_FAIL', () => {
        const errorPayload = { message: 'User already exists' };
        const action = {
            type: types.REGISTER_FAIL,
            payload: errorPayload
        };
        const expectedState = {
            ...initialState,
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorPayload
        };
        expect(authReducer(initialState, action)).toEqual(expectedState);
    });

    it('should handle AUTH_ERROR', () => {
        const errorPayload = { message: 'Invalid token' };
        const action = {
            type: types.AUTH_ERROR,
            payload: errorPayload
        };
        const expectedState = {
            ...initialState,
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorPayload
        };
        expect(authReducer(initialState, action)).toEqual(expectedState);
    });

    it('should handle PROFILE_UPDATE_FAIL', () => {
        const errorPayload = { message: 'Username already taken' };
        const action = {
            type: types.PROFILE_UPDATE_FAIL,
            payload: errorPayload
        };

        // Starting with authenticated state
        const startingState = {
            ...initialState,
            isAuthenticated: true,
            user: { _id: '1', username: 'testuser', email: 'test@example.com' }
        };

        const expectedState = {
            ...startingState,
            isLoading: false,
            error: errorPayload
        };
        expect(authReducer(startingState, action)).toEqual(expectedState);
    });

    it('should handle LOGOUT_SUCCESS', () => {
        const action = {
            type: types.LOGOUT_SUCCESS
        };

        // Starting with authenticated state
        const startingState = {
            ...initialState,
            token: 'test-token',
            isAuthenticated: true,
            user: { _id: '1', username: 'testuser', email: 'test@example.com' }
        };

        const expectedState = {
            ...initialState,
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false
        };
        expect(authReducer(startingState, action)).toEqual(expectedState);
    });

    it('should handle CLEAR_ERRORS', () => {
        const action = {
            type: types.CLEAR_ERRORS
        };

        // Starting with state that has errors
        const startingState = {
            ...initialState,
            error: { message: 'Some error' }
        };

        const expectedState = {
            ...startingState,
            error: null
        };
        expect(authReducer(startingState, action)).toEqual(expectedState);
    });
}); 