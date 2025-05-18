import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import axios from 'axios';
import authReducer, {
    login,
    logout,
    register,
    checkAuth,
    setUser,
    setError,
    setLoading,
    clearError
} from '../../../client/src/store/slices/auth-slice';

// Мокаем axios
jest.mock('axios');

// Создаем мок-стор для тестирования async actions
const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('Auth Slice', () => {
    // Исходное состояние 
    const initialState = {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
    };

    // Мок данные для тестов
    const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com'
    };

    const mockToken = 'test.jwt.token';

    const mockAuthResponse = {
        user: mockUser,
        token: mockToken
    };

    const mockError = 'Authentication failed';

    // Тест начального состояния
    test('should return the initial state', () => {
        expect(authReducer(undefined, {})).toEqual(initialState);
    });

    // Тест синхронных action creators
    test('should handle setUser action', () => {
        const nextState = authReducer(initialState, setUser(mockUser));
        expect(nextState.user).toEqual(mockUser);
        expect(nextState.isAuthenticated).toBe(true);
    });

    test('should handle setError action', () => {
        const nextState = authReducer(initialState, setError(mockError));
        expect(nextState.error).toEqual(mockError);
        expect(nextState.isLoading).toBe(false);
    });

    test('should handle setLoading action', () => {
        const nextState = authReducer(initialState, setLoading(true));
        expect(nextState.isLoading).toBe(true);
    });

    test('should handle clearError action', () => {
        // Устанавливаем ошибку
        const stateWithError = authReducer(initialState, setError(mockError));
        // Очищаем ошибку
        const nextState = authReducer(stateWithError, clearError());
        expect(nextState.error).toBeNull();
    });

    test('should handle logout action', () => {
        // Устанавливаем пользователя
        const loggedInState = {
            ...initialState,
            user: mockUser,
            token: mockToken,
            isAuthenticated: true
        };

        // Выполняем выход
        const nextState = authReducer(loggedInState, logout());
        expect(nextState).toEqual(initialState);
    });

    // Тестирование асинхронных actions с redux-mock-store
    test('login action dispatches expected actions on successful login', async () => {
        // Мокаем успешный ответ axios
        axios.post.mockResolvedValueOnce({ data: mockAuthResponse });

        // Создаем мок-стор
        const store = mockStore(initialState);

        // Создаем данные для входа
        const loginData = { username: 'testuser', password: 'password123' };

        // Вызываем async action
        await store.dispatch(login(loginData));

        // Проверяем dispatched actions
        const actions = store.getActions();
        expect(actions[0].type).toEqual('auth/setLoading');
        expect(actions[0].payload).toBe(true);

        expect(actions[1].type).toEqual('auth/clearError');

        expect(actions[2].type).toEqual('auth/setLoading');
        expect(actions[2].payload).toBe(false);

        // Проверяем что setUser вызван с правильными данными
        expect(actions[3].type).toEqual('auth/setUser');
        expect(actions[3].payload).toEqual({
            user: mockUser,
            token: mockToken
        });
    });

    test('login action dispatches error on failed login', async () => {
        // Мокаем ошибку axios
        axios.post.mockRejectedValueOnce({
            response: {
                data: { error: mockError }
            }
        });

        // Создаем мок-стор
        const store = mockStore(initialState);

        // Создаем данные для входа
        const loginData = { username: 'testuser', password: 'wrongpassword' };

        // Вызываем async action
        await store.dispatch(login(loginData));

        // Проверяем dispatched actions
        const actions = store.getActions();
        expect(actions[0].type).toEqual('auth/setLoading');
        expect(actions[0].payload).toBe(true);

        expect(actions[1].type).toEqual('auth/clearError');

        expect(actions[2].type).toEqual('auth/setLoading');
        expect(actions[2].payload).toBe(false);

        // Проверяем что setError вызван с правильной ошибкой
        expect(actions[3].type).toEqual('auth/setError');
        expect(actions[3].payload).toEqual(mockError);
    });

    test('register action dispatches expected actions on successful registration', async () => {
        // Мокаем успешный ответ axios
        axios.post.mockResolvedValueOnce({ data: mockAuthResponse });

        // Создаем мок-стор
        const store = mockStore(initialState);

        // Создаем данные для регистрации
        const registerData = {
            username: 'newuser',
            email: 'newuser@example.com',
            password: 'password123'
        };

        // Вызываем async action
        await store.dispatch(register(registerData));

        // Проверяем dispatched actions
        const actions = store.getActions();
        expect(actions[0].type).toEqual('auth/setLoading');
        expect(actions[0].payload).toBe(true);

        expect(actions[1].type).toEqual('auth/clearError');

        expect(actions[2].type).toEqual('auth/setLoading');
        expect(actions[2].payload).toBe(false);

        // Проверяем что setUser вызван с правильными данными
        expect(actions[3].type).toEqual('auth/setUser');
        expect(actions[3].payload).toEqual({
            user: mockUser,
            token: mockToken
        });
    });

    test('checkAuth action sets user when token exists', async () => {
        // Мокаем localStorage
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(mockToken)
        };
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });

        // Мокаем успешный ответ axios
        axios.get.mockResolvedValueOnce({ data: { user: mockUser } });

        // Создаем мок-стор
        const store = mockStore(initialState);

        // Вызываем async action
        await store.dispatch(checkAuth());

        // Проверяем dispatched actions
        const actions = store.getActions();
        expect(actions[0].type).toEqual('auth/setLoading');
        expect(actions[0].payload).toBe(true);

        expect(actions[1].type).toEqual('auth/clearError');

        expect(actions[2].type).toEqual('auth/setLoading');
        expect(actions[2].payload).toBe(false);

        // Проверяем что setUser вызван с правильными данными
        expect(actions[3].type).toEqual('auth/setUser');
        expect(actions[3].payload).toEqual({
            user: mockUser,
            token: mockToken
        });
    });

    test('checkAuth action does nothing when no token exists', async () => {
        // Мокаем localStorage
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(null)
        };
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });

        // Создаем мок-стор
        const store = mockStore(initialState);

        // Вызываем async action
        await store.dispatch(checkAuth());

        // Проверяем что никаких действий не было отправлено
        const actions = store.getActions();
        expect(actions).toHaveLength(0);
    });
}); 