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
import ProjectViewer from './pages/ProjectViewer';
import ProjectConstructor from './pages/ProjectConstructor';
import DebugPage from './pages/DebugPage';
import ModelDebugPage from './pages/ModelDebugPage';

// Define app colors
export const COLORS = {
    primary: '#8A2BE2',        // Фиолетовый (основной)
    primaryLight: '#9D4EDD',   // Светло-фиолетовый
    secondary: '#FF5722',      // Оранжевый
    secondaryLight: '#FF7043', // Светло-оранжевый
    tertiary: '#FF1493',       // Розовый
    tertiaryLight: '#FF69B4',  // Светло-розовый
    dark: '#0a0e24',           // Темный фон
    darkLight: '#111536',      // Светлее темного фона
    white: '#FFFFFF',          // Белый
};

// Add custom tertiary color to Material UI theme
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
            default: COLORS.dark,
            paper: COLORS.darkLight,
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
                // Add support for tertiary color in Chip component
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

                    {/* Для отладки 3D модели */}
                    <Route
                        path="/debug-model"
                        element={<DebugPage />}
                    />

                    {/* Для управления 3D моделями */}
                    <Route
                        path="/models"
                        element={<ModelDebugPage />}
                    />

                    <Route
                        path="/teams/:teamId/projects/:projectId/viewer"
                        element={
                            <ProtectedRoute>
                                <ProjectViewer />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teams/:teamId/projects/:projectId/constructor"
                        element={
                            <ProtectedRoute>
                                <ProjectConstructor />
                            </ProtectedRoute>
                        }
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