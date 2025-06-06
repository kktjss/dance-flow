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
import DebugPage from './pages/DebugPage';
import ModelDebugPage from './pages/ModelDebugPage';
import ProjectChoicePage from './pages/ProjectChoicePage';
import { COLORS } from './constants/colors';

// Добавление пользовательского третичного цвета в тему Material UI
const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: COLORS.primary,
            light: COLORS.primaryLight,
        },
        secondary: {
            main: COLORS.secondary,
            light: COLORS.secondaryLight,
        },
        tertiary: {
            main: COLORS.tertiary,
            light: COLORS.tertiaryLight,
            contrastText: '#fff',
        },
        background: {
            default: '#121620',
            paper: '#1A202E',
        },
        text: {
            primary: COLORS.white,
            secondary: 'rgba(255, 255, 255, 0.7)',
        },
    },
    typography: {
        fontFamily: '"Inter", "Golos Text", sans-serif',
    },
    components: {
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                },
                // Добавляем поддержку третичного цвета в компонент Chip
                colorTertiary: {
                    backgroundColor: COLORS.tertiary,
                    color: '#fff',
                },
            },
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
                    {/* Общедоступные маршруты */}
                    <Route
                        path="/"
                        element={
                            <PublicRoute>
                                <Home />
                            </PublicRoute>
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

                    {/* Защищенные маршруты */}
                    <Route
                        path="/auth-home"
                        element={
                            <ProtectedRoute>
                                <AuthHome />
                            </ProtectedRoute>
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

                    {/* Проекты */}
                    <Route
                        path="/constructor"
                        element={
                            <ProtectedRoute>
                                <ConstructorPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/constructor/:projectId"
                        element={
                            <ProtectedRoute>
                                <ConstructorPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/projects/:projectId"
                        element={
                            <ProtectedRoute>
                                <ProjectViewPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/projects"
                        element={
                            <ProtectedRoute>
                                <ProjectsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teams/:teamId/projects/:projectId/viewer"
                        element={
                            <ProtectedRoute>
                                <ProjectViewPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teams/:teamId/projects/:projectId/constructor"
                        element={
                            <ProtectedRoute>
                                <ConstructorPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teams/:teamId/projects/:projectId/dialog"
                        element={
                            <ProtectedRoute>
                                <ProjectChoicePage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Отладочные маршруты */}
                    <Route
                        path="/dance-flow"
                        element={<ConstructorPage />}
                    />
                    <Route
                        path="/debug-model"
                        element={<DebugPage />}
                    />
                    <Route
                        path="/models"
                        element={<ModelDebugPage />}
                    />
                    <Route
                        path="/debug"
                        element={
                            <ProtectedRoute>
                                <DebugPage />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </Router>
        </ThemeProvider>
    );
}

export default App; 