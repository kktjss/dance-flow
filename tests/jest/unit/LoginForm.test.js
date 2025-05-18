import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from '../../../client/src/components/LoginForm';

// Мокаем модуль axios для имитации запросов
jest.mock('axios', () => ({
    post: jest.fn(),
}));

// Мокаем react-router-dom
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
}));

describe('LoginForm Component', () => {
    // Мок для функции входа
    const mockLogin = jest.fn();

    // Базовые пропсы для компонента
    const defaultProps = {
        onLogin: mockLogin,
        isLoading: false,
        error: null,
    };

    // Сброс моков после каждого теста
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders login form correctly', () => {
        render(
            <BrowserRouter>
                <LoginForm {...defaultProps} />
            </BrowserRouter>
        );

        // Проверяем, что форма содержит необходимые элементы
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
        expect(screen.getByText(/sign up/i)).toBeInTheDocument();
    });

    test('updates form values on input change', () => {
        render(
            <BrowserRouter>
                <LoginForm {...defaultProps} />
            </BrowserRouter>
        );

        // Находим поля ввода
        const usernameInput = screen.getByLabelText(/username/i);
        const passwordInput = screen.getByLabelText(/password/i);

        // Имитируем ввод данных
        fireEvent.change(usernameInput, { target: { value: 'testuser' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        // Проверяем, что значения полей обновились
        expect(usernameInput.value).toBe('testuser');
        expect(passwordInput.value).toBe('password123');
    });

    test('submits form with user credentials', () => {
        render(
            <BrowserRouter>
                <LoginForm {...defaultProps} />
            </BrowserRouter>
        );

        // Находим поля ввода и кнопку отправки формы
        const usernameInput = screen.getByLabelText(/username/i);
        const passwordInput = screen.getByLabelText(/password/i);
        const submitButton = screen.getByRole('button', { name: /login/i });

        // Имитируем ввод данных
        fireEvent.change(usernameInput, { target: { value: 'testuser' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        // Имитируем отправку формы
        fireEvent.click(submitButton);

        // Проверяем, что функция входа была вызвана с правильными параметрами
        expect(mockLogin).toHaveBeenCalledWith({
            username: 'testuser',
            password: 'password123',
        });
    });

    test('displays loading state when isLoading is true', () => {
        render(
            <BrowserRouter>
                <LoginForm {...defaultProps} isLoading={true} />
            </BrowserRouter>
        );

        // Проверяем, что кнопка входа отображает индикатор загрузки
        const submitButton = screen.getByRole('button', { name: /loading|signin/i });
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveTextContent(/loading/i);
    });

    test('displays error message when error is provided', () => {
        const errorMessage = 'Invalid username or password';

        render(
            <BrowserRouter>
                <LoginForm {...defaultProps} error={errorMessage} />
            </BrowserRouter>
        );

        // Проверяем, что сообщение об ошибке отображается
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    test('validates form fields before submission', () => {
        render(
            <BrowserRouter>
                <LoginForm {...defaultProps} />
            </BrowserRouter>
        );

        // Находим кнопку отправки формы
        const submitButton = screen.getByRole('button', { name: /login/i });

        // Имитируем отправку пустой формы
        fireEvent.click(submitButton);

        // Проверяем, что функция входа не была вызвана
        expect(mockLogin).not.toHaveBeenCalled();

        // Проверяем, что отображаются сообщения об ошибках валидации
        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });

    test('navigates to registration page when signup link is clicked', () => {
        const { container } = render(
            <BrowserRouter>
                <LoginForm {...defaultProps} />
            </BrowserRouter>
        );

        // Находим ссылку на регистрацию
        const signupLink = screen.getByText(/sign up/i);

        // Проверяем, что ссылка указывает на правильный путь
        expect(signupLink.closest('a')).toHaveAttribute('href', '/register');
    });

    test('provides password reset option', () => {
        render(
            <BrowserRouter>
                <LoginForm {...defaultProps} />
            </BrowserRouter>
        );

        // Проверяем наличие ссылки для восстановления пароля
        const resetLink = screen.getByText(/forgot password/i);
        expect(resetLink).toBeInTheDocument();
        expect(resetLink.closest('a')).toHaveAttribute('href', '/reset-password');
    });
}); 