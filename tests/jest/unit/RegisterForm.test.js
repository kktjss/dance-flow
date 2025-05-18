import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import RegisterForm from '../../../client/src/components/RegisterForm';

// Мокаем Redux actions
jest.mock('../../../client/src/actions/authActions', () => ({
    register: jest.fn().mockImplementation((userData) => {
        return (dispatch) => {
            // Имитируем успешную регистрацию с валидными данными
            if (
                userData.username &&
                userData.email &&
                userData.email.includes('@') &&
                userData.password &&
                userData.password.length >= 6 &&
                userData.password === userData.confirmPassword
            ) {
                dispatch({
                    type: 'REGISTER_SUCCESS',
                    payload: {
                        token: 'test.token',
                        user: {
                            _id: 'user1',
                            username: userData.username,
                            email: userData.email
                        }
                    }
                });
                return Promise.resolve();
            }

            // Имитируем ошибку, если пароли не совпадают
            if (userData.password !== userData.confirmPassword) {
                dispatch({
                    type: 'REGISTER_FAIL',
                    payload: { message: 'Пароли не совпадают' }
                });
                return Promise.reject({ response: { data: { message: 'Пароли не совпадают' } } });
            }

            // Имитируем ошибку, если email уже используется
            if (userData.email === 'existing@example.com') {
                dispatch({
                    type: 'REGISTER_FAIL',
                    payload: { message: 'Пользователь с таким email уже существует' }
                });
                return Promise.reject({
                    response: { data: { message: 'Пользователь с таким email уже существует' } }
                });
            }

            // Общая ошибка
            dispatch({
                type: 'REGISTER_FAIL',
                payload: { message: 'Ошибка при регистрации' }
            });
            return Promise.reject({ response: { data: { message: 'Ошибка при регистрации' } } });
        };
    })
}));

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('RegisterForm Component', () => {
    let store;

    beforeEach(() => {
        store = mockStore({
            auth: {
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: false,
                error: null
            }
        });

        jest.clearAllMocks();
    });

    test('рендерит форму регистрации с нужными полями', () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <RegisterForm />
                </BrowserRouter>
            </Provider>
        );

        expect(screen.getByLabelText(/имя пользователя/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/электронная почта/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^пароль$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/подтверждение пароля/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /зарегистрироваться/i })).toBeInTheDocument();
    });

    test('выполняет валидацию пустых полей', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <RegisterForm />
                </BrowserRouter>
            </Provider>
        );

        // Нажимаем кнопку регистрации без заполнения полей
        fireEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

        // Проверяем сообщения об ошибках
        await waitFor(() => {
            expect(screen.getByText(/имя пользователя обязательно/i)).toBeInTheDocument();
            expect(screen.getByText(/электронная почта обязательна/i)).toBeInTheDocument();
            expect(screen.getByText(/пароль обязателен/i)).toBeInTheDocument();
            expect(screen.getByText(/подтверждение пароля обязательно/i)).toBeInTheDocument();
        });
    });

    test('выполняет валидацию электронной почты', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <RegisterForm />
                </BrowserRouter>
            </Provider>
        );

        // Заполняем поле email неверным форматом
        fireEvent.change(screen.getByLabelText(/электронная почта/i), {
            target: { value: 'invalid-email' }
        });

        // Снимаем фокус для активации валидации
        fireEvent.blur(screen.getByLabelText(/электронная почта/i));

        // Проверяем сообщение об ошибке
        await waitFor(() => {
            expect(screen.getByText(/неверный формат электронной почты/i)).toBeInTheDocument();
        });
    });

    test('выполняет валидацию минимальной длины пароля', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <RegisterForm />
                </BrowserRouter>
            </Provider>
        );

        // Заполняем поле пароля коротким паролем
        fireEvent.change(screen.getByLabelText(/^пароль$/i), {
            target: { value: '12345' }
        });

        // Снимаем фокус для активации валидации
        fireEvent.blur(screen.getByLabelText(/^пароль$/i));

        // Проверяем сообщение об ошибке
        await waitFor(() => {
            expect(screen.getByText(/пароль должен содержать не менее 6 символов/i)).toBeInTheDocument();
        });
    });

    test('выполняет валидацию совпадения паролей', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <RegisterForm />
                </BrowserRouter>
            </Provider>
        );

        // Заполняем поля пароля разными значениями
        fireEvent.change(screen.getByLabelText(/^пароль$/i), {
            target: { value: 'password123' }
        });

        fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
            target: { value: 'password456' }
        });

        // Снимаем фокус для активации валидации
        fireEvent.blur(screen.getByLabelText(/подтверждение пароля/i));

        // Проверяем сообщение об ошибке
        await waitFor(() => {
            expect(screen.getByText(/пароли не совпадают/i)).toBeInTheDocument();
        });
    });

    test('отправляет форму с валидными данными', async () => {
        const { register } = require('../../../client/src/actions/authActions');

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <RegisterForm />
                </BrowserRouter>
            </Provider>
        );

        // Заполняем форму валидными данными
        fireEvent.change(screen.getByLabelText(/имя пользователя/i), {
            target: { value: 'testuser' }
        });

        fireEvent.change(screen.getByLabelText(/электронная почта/i), {
            target: { value: 'test@example.com' }
        });

        fireEvent.change(screen.getByLabelText(/^пароль$/i), {
            target: { value: 'password123' }
        });

        fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
            target: { value: 'password123' }
        });

        // Отправляем форму
        fireEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

        // Проверяем, что функция регистрации была вызвана с правильными данными
        await waitFor(() => {
            expect(register).toHaveBeenCalledWith({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });
        });
    });

    test('показывает ошибку при регистрации уже существующего пользователя', async () => {
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <RegisterForm />
                </BrowserRouter>
            </Provider>
        );

        // Заполняем форму с существующим email
        fireEvent.change(screen.getByLabelText(/имя пользователя/i), {
            target: { value: 'existinguser' }
        });

        fireEvent.change(screen.getByLabelText(/электронная почта/i), {
            target: { value: 'existing@example.com' }
        });

        fireEvent.change(screen.getByLabelText(/^пароль$/i), {
            target: { value: 'password123' }
        });

        fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
            target: { value: 'password123' }
        });

        // Отправляем форму
        fireEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

        // Имитируем состояние с ошибкой
        store = mockStore({
            auth: {
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: false,
                error: { message: 'Пользователь с таким email уже существует' }
            }
        });

        render(
            <Provider store={store}>
                <BrowserRouter>
                    <RegisterForm />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем отображение ошибки
        expect(screen.getByText(/пользователь с таким email уже существует/i)).toBeInTheDocument();
    });

    test('показывает индикатор загрузки во время процесса регистрации', async () => {
        // Устанавливаем состояние загрузки
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
                    <RegisterForm />
                </BrowserRouter>
            </Provider>
        );

        // Проверяем наличие индикатора загрузки
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

        // Кнопка регистрации должна быть отключена во время загрузки
        expect(screen.getByRole('button', { name: /зарегистрироваться/i })).toBeDisabled();
    });
}); 