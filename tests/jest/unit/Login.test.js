import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import Login from '../../../client/src/pages/Auth/Login';

// Мокаем функцию навигации
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate
}));

// Мокаем сервис аутентификации
jest.mock('../../../client/src/services/authService', () => ({
    login: jest.fn()
}));

// Мокаем Redux-экшены
jest.mock('../../../client/src/actions/authActions', () => ({
    login: jest.fn().mockImplementation((credentials) => {
        return (dispatch) => {
            // Имитируем успешный вход с правильными учетными данными
            if (credentials.email === 'test@example.com' && credentials.password === 'password123') {
                dispatch({ type: 'LOGIN_SUCCESS', payload: { token: 'test.token', user: { _id: 'user1', username: 'testuser' } } });
                return Promise.resolve();
            }
            // Имитируем неудачный вход
            dispatch({ type: 'LOGIN_FAIL', payload: { error: 'Invalid credentials' } });
            return Promise.reject({ response: { data: { error: 'Invalid credentials' } } });
        };
    }),
    logout: jest.fn()
}));

// Настраиваем мок-стор
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('Login Component', () => {
    let store;

    beforeEach(() => {
        // Сбрасываем моки
        jest.clearAllMocks();

        // Создаем стор с начальным состоянием
        store = mockStore({
            auth: {
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: false,
                error: null
            }
        });
    });

    test('renders login form', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем наличие основных элементов
        expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
        expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
    });

    test('validates form input', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Пытаемся отправить форму, не заполняя её
        const submitButton = screen.getByRole('button', { name: /Sign In/i });
        fireEvent.click(submitButton);

        // Проверяем наличие ошибок валидации
        await waitFor(() => {
            expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
            expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
        });

        // Заполняем неправильным email
        const emailInput = screen.getByLabelText(/Email/i);
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
        fireEvent.click(submitButton);

        // Проверяем наличие ошибки валидации email
        await waitFor(() => {
            expect(screen.getByText(/Please enter a valid email/i)).toBeInTheDocument();
        });
    });

    test('handles successful login', async () => {
        const { login } = require('../../../client/src/actions/authActions');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Заполняем форму правильными учетными данными
        const emailInput = screen.getByLabelText(/Email/i);
        const passwordInput = screen.getByLabelText(/Password/i);

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        // Отправляем форму
        const submitButton = screen.getByRole('button', { name: /Sign In/i });
        fireEvent.click(submitButton);

        // Проверяем, что функция входа была вызвана с правильными учетными данными
        expect(login).toHaveBeenCalledWith({
            email: 'test@example.com',
            password: 'password123'
        });

        // Ждем, когда произойдет навигация после успешного входа
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/auth-home');
        });
    });

    test('handles failed login', async () => {
        // Настраиваем стор с состоянием ошибки
        store = mockStore({
            auth: {
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: false,
                error: 'Invalid credentials'
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Заполняем форму неправильными учетными данными
        const emailInput = screen.getByLabelText(/Email/i);
        const passwordInput = screen.getByLabelText(/Password/i);

        fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

        // Отправляем форму
        const submitButton = screen.getByRole('button', { name: /Sign In/i });
        fireEvent.click(submitButton);

        // Проверяем наличие сообщения об ошибке
        await waitFor(() => {
            expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
        });

        // Проверяем, что навигация не произошла
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('navigates to registration page', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Нажимаем на ссылку регистрации
        const registerLink = screen.getByText(/Sign up/i);
        fireEvent.click(registerLink);

        // Проверяем навигацию
        expect(mockNavigate).toHaveBeenCalledWith('/register');
    });

    test('shows loading state during authentication', async () => {
        // Мокаем вход как ожидающий
        const { login } = require('../../../client/src/actions/authActions');
        login.mockImplementationOnce(() => {
            return (dispatch) => {
                dispatch({ type: 'LOGIN_REQUEST' });
                return new Promise(resolve => {
                    // Имитируем задержку
                    setTimeout(() => {
                        dispatch({ type: 'LOGIN_SUCCESS', payload: { token: 'test.token', user: { _id: 'user1' } } });
                        resolve();
                    }, 100);
                });
            };
        });

        // Настраиваем стор с состоянием загрузки
        store = mockStore({
            auth: {
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: true,
                error: null
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <Login />
                </BrowserRouter>
            </Provider>
        );

        // Заполняем и отправляем форму
        const emailInput = screen.getByLabelText(/Email/i);
        const passwordInput = screen.getByLabelText(/Password/i);

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        const submitButton = screen.getByRole('button', { name: /Sign In/i });
        fireEvent.click(submitButton);

        // Проверяем индикатор загрузки
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
    });
}); 