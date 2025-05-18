import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import ProtectedRoute from '../../components/ProtectedRoute';

// Мок компоненты для тестирования
const Dashboard = () => <div>Панель управления - Защищенный контент</div>;
const Login = () => <div>Страница входа</div>;
const Home = () => <div>Домашняя страница</div>;

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('ProtectedRoute Component', () => {
    // Тест: пользователь авторизован - должен отображаться защищенный контент
    it('должен отображать защищенный контент, если пользователь авторизован', () => {
        // Создаем мок-хранилище с авторизованным пользователем
        const store = mockStore({
            auth: {
                isAuthenticated: true,
                token: 'valid-token',
                user: { _id: 'user1', username: 'testuser' },
                isLoading: false
            }
        });

        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/dashboard']}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </Provider>
        );

        // Проверяем, что отображается защищенный контент
        expect(screen.getByText('Панель управления - Защищенный контент')).toBeInTheDocument();

        // Проверяем, что страница входа не отображается
        expect(screen.queryByText('Страница входа')).not.toBeInTheDocument();
    });

    // Тест: пользователь не авторизован - должен быть редирект на страницу входа
    it('должен перенаправлять на страницу входа, если пользователь не авторизован', () => {
        // Создаем мок-хранилище с неавторизованным пользователем
        const store = mockStore({
            auth: {
                isAuthenticated: false,
                token: null,
                user: null,
                isLoading: false
            }
        });

        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/dashboard']}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute redirectPath="/login">
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </Provider>
        );

        // Проверяем, что отображается страница входа вместо защищенного контента
        expect(screen.getByText('Страница входа')).toBeInTheDocument();

        // Проверяем, что защищенный контент не отображается
        expect(screen.queryByText('Панель управления - Защищенный контент')).not.toBeInTheDocument();
    });

    // Тест: проверка состояния загрузки
    it('должен отображать индикатор загрузки во время проверки аутентификации', () => {
        // Создаем мок-хранилище с состоянием загрузки
        const store = mockStore({
            auth: {
                isAuthenticated: false,
                token: 'token-being-validated',
                user: null,
                isLoading: true
            }
        });

        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/dashboard']}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute redirectPath="/login">
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </Provider>
        );

        // Проверяем, что отображается индикатор загрузки
        expect(screen.getByTestId('auth-loading')).toBeInTheDocument();

        // Проверяем, что ни защищенный контент, ни страница входа не отображаются
        expect(screen.queryByText('Панель управления - Защищенный контент')).not.toBeInTheDocument();
        expect(screen.queryByText('Страница входа')).not.toBeInTheDocument();
    });

    // Тест: пользователь без нужной роли должен быть перенаправлен
    it('должен перенаправлять пользователя без нужной роли', () => {
        // Создаем мок-хранилище с пользователем без нужной роли
        const store = mockStore({
            auth: {
                isAuthenticated: true,
                token: 'valid-token',
                user: { _id: 'user1', username: 'testuser', role: 'user' },
                isLoading: false
            }
        });

        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/admin']}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute requiredRole="admin" redirectPath="/">
                                    <div>Админ панель</div>
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </Provider>
        );

        // Проверяем, что пользователь был перенаправлен на домашнюю страницу
        expect(screen.getByText('Домашняя страница')).toBeInTheDocument();

        // Проверяем, что админ панель не отображается
        expect(screen.queryByText('Админ панель')).not.toBeInTheDocument();
    });

    // Тест: пользователь с нужной ролью должен видеть защищенный контент
    it('должен показывать защищенный контент пользователю с нужной ролью', () => {
        // Создаем мок-хранилище с пользователем с нужной ролью
        const store = mockStore({
            auth: {
                isAuthenticated: true,
                token: 'valid-token',
                user: { _id: 'admin1', username: 'adminuser', role: 'admin' },
                isLoading: false
            }
        });

        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/admin']}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute requiredRole="admin" redirectPath="/">
                                    <div>Админ панель</div>
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </Provider>
        );

        // Проверяем, что отображается админ панель
        expect(screen.getByText('Админ панель')).toBeInTheDocument();

        // Проверяем, что домашняя страница не отображается
        expect(screen.queryByText('Домашняя страница')).not.toBeInTheDocument();
    });
}); 