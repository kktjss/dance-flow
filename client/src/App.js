import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Home from './pages/Home';
import TeamManagement from './pages/TeamManagement';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Dashboard from './pages/Dashboard';
import AuthHome from './pages/AuthHome';
import ConstructorPage from './pages/ConstructorPage';
import ProjectViewPage from './pages/ProjectViewPage';
import ProjectsPage from './pages/ProjectsPage';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

// Простой компонент для защиты маршрутов
const ProtectedRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('token');

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    return children;
};

// Компонент для перенаправления авторизованных пользователей
const PublicRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('token');

    if (isAuthenticated) {
        return <Navigate to="/auth-home" />;
    }

    return children;
};

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <PublicRoute>
                                <Home />
                            </PublicRoute>
                        }
                    />
                    <Route
                        path="/auth-home"
                        element={
                            <ProtectedRoute>
                                <AuthHome />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/login"
                        element={
                            <PublicRoute>
                                <Login />
                            </PublicRoute>
                        }
                    />
                    <Route
                        path="/register"
                        element={
                            <PublicRoute>
                                <Register />
                            </PublicRoute>
                        }
                    />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teams"
                        element={
                            <ProtectedRoute>
                                <TeamManagement />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/constructor"
                        element={
                            <ProtectedRoute>
                                <ConstructorPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Маршрут для открытия определенного проекта */}
                    <Route
                        path="/constructor/:projectId"
                        element={
                            <ProtectedRoute>
                                <ConstructorPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Маршрут для просмотра проекта (read-only) */}
                    <Route
                        path="/projects/:projectId"
                        element={
                            <ProtectedRoute>
                                <ProjectViewPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Маршрут для просмотра списка всех проектов */}
                    <Route
                        path="/projects"
                        element={
                            <ProtectedRoute>
                                <ProjectsPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Для демонстрации конструктора без авторизации */}
                    <Route
                        path="/dance-flow"
                        element={<ConstructorPage />}
                    />
                </Routes>
            </Router>
        </ThemeProvider>
    );
}

export default App; 