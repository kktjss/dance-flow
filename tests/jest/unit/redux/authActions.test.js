import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as actions from '../../../../client/src/actions/authActions';
import * as types from '../../../../client/src/actions/types';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);
const mock = new MockAdapter(axios);

describe('Auth Action Creators', () => {
    beforeEach(() => {
        mock.reset();
        localStorage.clear();
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('creates LOGIN_SUCCESS when login is successful', () => {
            const userData = { email: 'test@example.com', password: 'password' };
            const responseData = {
                token: 'test-token',
                user: { _id: '1', username: 'testuser', email: 'test@example.com' }
            };

            mock.onPost('/api/auth/login').reply(200, responseData);

            const expectedActions = [
                { type: types.AUTH_LOADING },
                {
                    type: types.LOGIN_SUCCESS,
                    payload: responseData
                }
            ];

            const store = mockStore({ auth: {} });

            return store.dispatch(actions.login(userData)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
                expect(localStorage.getItem('token')).toEqual(responseData.token);
            });
        });

        it('creates LOGIN_FAIL when login fails', () => {
            const userData = { email: 'test@example.com', password: 'wrong-password' };
            const errorMessage = 'Invalid credentials';

            mock.onPost('/api/auth/login').reply(401, { message: errorMessage });

            const expectedActions = [
                { type: types.AUTH_LOADING },
                {
                    type: types.LOGIN_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({ auth: {} });

            return store.dispatch(actions.login(userData)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
                expect(localStorage.getItem('token')).toBeNull();
            });
        });
    });

    describe('register', () => {
        it('creates REGISTER_SUCCESS when registration is successful', () => {
            const userData = {
                username: 'newuser',
                email: 'new@example.com',
                password: 'password',
                confirmPassword: 'password'
            };

            const responseData = {
                token: 'new-token',
                user: { _id: '2', username: 'newuser', email: 'new@example.com' }
            };

            mock.onPost('/api/auth/register').reply(200, responseData);

            const expectedActions = [
                { type: types.AUTH_LOADING },
                {
                    type: types.REGISTER_SUCCESS,
                    payload: responseData
                }
            ];

            const store = mockStore({ auth: {} });

            return store.dispatch(actions.register(userData)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
                expect(localStorage.getItem('token')).toEqual(responseData.token);
            });
        });

        it('creates REGISTER_FAIL when registration fails', () => {
            const userData = {
                username: 'existinguser',
                email: 'existing@example.com',
                password: 'password',
                confirmPassword: 'password'
            };

            const errorMessage = 'User already exists';

            mock.onPost('/api/auth/register').reply(400, { message: errorMessage });

            const expectedActions = [
                { type: types.AUTH_LOADING },
                {
                    type: types.REGISTER_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({ auth: {} });

            return store.dispatch(actions.register(userData)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
                expect(localStorage.getItem('token')).toBeNull();
            });
        });
    });

    describe('logout', () => {
        it('creates LOGOUT_SUCCESS when logout is successful', () => {
            // Set initial token in localStorage
            localStorage.setItem('token', 'test-token');

            const expectedActions = [
                { type: types.LOGOUT_SUCCESS }
            ];

            const store = mockStore({ auth: {} });

            store.dispatch(actions.logout());
            expect(store.getActions()).toEqual(expectedActions);
            expect(localStorage.getItem('token')).toBeNull();
        });
    });

    describe('loadUser', () => {
        it('creates USER_LOADED when user is loaded successfully', () => {
            const token = 'test-token';
            localStorage.setItem('token', token);

            const userData = { _id: '1', username: 'testuser', email: 'test@example.com' };

            // Mock axios to include Authorization header check
            mock.onGet('/api/auth/user').reply(config => {
                if (config.headers.Authorization === `Bearer ${token}`) {
                    return [200, userData];
                }
                return [401, { message: 'Unauthorized' }];
            });

            const expectedActions = [
                {
                    type: types.USER_LOADED,
                    payload: userData
                }
            ];

            const store = mockStore({ auth: {} });

            return store.dispatch(actions.loadUser()).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates AUTH_ERROR when token is invalid', () => {
            const invalidToken = 'invalid-token';
            localStorage.setItem('token', invalidToken);

            mock.onGet('/api/auth/user').reply(401, { message: 'Invalid token' });

            const expectedActions = [
                {
                    type: types.AUTH_ERROR,
                    payload: { message: 'Invalid token' }
                }
            ];

            const store = mockStore({ auth: {} });

            return store.dispatch(actions.loadUser()).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });

    describe('updateProfile', () => {
        it('creates PROFILE_UPDATED when profile update is successful', () => {
            const token = 'test-token';
            localStorage.setItem('token', token);

            const userData = {
                username: 'updateduser',
                email: 'updated@example.com',
                bio: 'New bio'
            };

            mock.onPut('/api/users/profile').reply(config => {
                if (config.headers.Authorization === `Bearer ${token}`) {
                    return [200, userData];
                }
                return [401, { message: 'Unauthorized' }];
            });

            const expectedActions = [
                { type: types.AUTH_LOADING },
                {
                    type: types.PROFILE_UPDATED,
                    payload: userData
                }
            ];

            const store = mockStore({ auth: {} });

            return store.dispatch(actions.updateProfile(userData)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });

        it('creates PROFILE_UPDATE_FAIL when profile update fails', () => {
            const token = 'test-token';
            localStorage.setItem('token', token);

            const userData = {
                username: 'takenusername',
                email: 'updated@example.com'
            };

            const errorMessage = 'Username already taken';

            mock.onPut('/api/users/profile').reply(400, { message: errorMessage });

            const expectedActions = [
                { type: types.AUTH_LOADING },
                {
                    type: types.PROFILE_UPDATE_FAIL,
                    payload: { message: errorMessage }
                }
            ];

            const store = mockStore({ auth: {} });

            return store.dispatch(actions.updateProfile(userData)).then(() => {
                expect(store.getActions()).toEqual(expectedActions);
            });
        });
    });
}); 