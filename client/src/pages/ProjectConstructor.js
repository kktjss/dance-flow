import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, CircularProgress, Alert, Button } from '@mui/material';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { API_BASE_URL } from '../constants';

const ProjectConstructor = () => {
    const { teamId, projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setError('Требуется авторизация');
                    setLoading(false);
                    return;
                }

                console.log('Fetching project data...', { teamId, projectId });

                // First, verify team access
                try {
                    const teamResponse = await axios.get(
                        `${API_BASE_URL}/api/teams/${teamId}`,
                        {
                            headers: { Authorization: `Bearer ${token}` }
                        }
                    );

                    if (!teamResponse.data) {
                        throw new Error('Не удалось получить данные команды');
                    }

                    // Validate team data
                    if (!teamResponse.data.owner || !teamResponse.data.owner._id) {
                        console.error('Invalid team data received:', teamResponse.data);
                        throw new Error('Получены некорректные данные команды');
                    }

                    // Validate members data
                    if (!Array.isArray(teamResponse.data.members)) {
                        console.error('Invalid team members data:', teamResponse.data);
                        throw new Error('Получены некорректные данные участников команды');
                    }
                } catch (teamError) {
                    console.error('Team access error:', teamError);
                    if (teamError.response?.status === 403) {
                        throw new Error('У вас нет доступа к этой команде');
                    } else if (teamError.response?.status === 404) {
                        throw new Error('Команда не найдена');
                    } else if (teamError.response?.data?.error === 'INVALID_TEAM_DATA') {
                        throw new Error('Ошибка данных команды. Пожалуйста, обратитесь к администратору.');
                    } else {
                        throw new Error(teamError.response?.data?.message || 'Ошибка при проверке доступа к команде');
                    }
                }

                // Then fetch project data
                const response = await axios.get(
                    `${API_BASE_URL}/api/teams/${teamId}/projects/${projectId}/viewer`,
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );

                console.log('Project data response:', response.data);

                if (response.data.success) {
                    if (!response.data.project) {
                        throw new Error('Project data is missing in the response');
                    }
                    setProject(response.data.project);
                } else {
                    throw new Error(response.data.message || 'Не удалось загрузить проект');
                }
            } catch (err) {
                console.error('Error fetching project:', err);
                let errorMessage = 'Не удалось загрузить проект. Пожалуйста, попробуйте позже.';

                if (err.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    console.error('Server response:', err.response.data);
                    errorMessage = err.response.data.message || errorMessage;
                } else if (err.request) {
                    // The request was made but no response was received
                    console.error('No response received:', err.request);
                    errorMessage = 'Сервер не отвечает. Пожалуйста, проверьте подключение к интернету.';
                } else if (err.message) {
                    // The error was thrown with a specific message
                    errorMessage = err.message;
                }

                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [teamId, projectId]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Paper sx={{ p: 4 }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : project ? (
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                                    <Typography variant="h4" component="h1">
                                        {project.name}
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={() => navigate(`/projects/${projectId}`)}
                                    >
                                        Открыть в проектах
                                    </Button>
                                </Box>

                                <Typography variant="body1" color="text.secondary" paragraph>
                                    {project.description || 'Нет описания'}
                                </Typography>

                                <Box sx={{ mt: 4 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Информация о проекте
                                    </Typography>
                                    <Typography>
                                        Создан: {new Date(project.createdAt).toLocaleDateString()}
                                    </Typography>
                                    <Typography>
                                        Последнее обновление: {new Date(project.updatedAt).toLocaleDateString()}
                                    </Typography>
                                </Box>
                            </Box>
                        ) : (
                            <Typography color="error">
                                Проект не найден
                            </Typography>
                        )}
                    </Paper>
                </Container>
            </Box>
        </Box>
    );
};

export default ProjectConstructor; 