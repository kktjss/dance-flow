import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, CircularProgress, Alert, Button, TextField, IconButton, Snackbar } from '@mui/material';
import { Edit, Save, Cancel } from '@mui/icons-material';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { API_BASE_URL } from '../constants';

const ProjectConstructor = () => {
    const { teamId, projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '' });
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

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

                // Непосредственно загружаем проект по ID, минуя проверку команды
                try {
                    console.log(`Requesting project with ID: ${projectId}`);
                    const response = await axios.get(
                        `${API_BASE_URL}/api/projects/${projectId}`,
                        {
                            headers: { Authorization: `Bearer ${token}` }
                        }
                    );

                    console.log('Project data response:', response.data);

                    // Проверим и исправим формат ID проекта
                    const projectData = { ...response.data };
                    if (!projectData._id && projectData.id) {
                        console.log('Fixing project data: copying id to _id');
                        projectData._id = projectData.id;
                    }

                    // Базовая проверка данных проекта
                    if (!projectData.name) {
                        console.warn('Project has no name:', projectData);
                        projectData.name = `Проект ${projectData._id || projectData.id || 'без имени'}`;
                    }

                    console.log('Processed project data:', projectData);
                    setProject(projectData);
                    setEditData({
                        name: projectData.name || '',
                        description: projectData.description || ''
                    });
                    setError(null);
                } catch (projectError) {
                    console.error('Error fetching project data:', projectError);
                    console.error('Project error response:', projectError.response?.data);

                    // Информативная обработка различных ошибок проекта
                    if (projectError.response?.status === 404) {
                        throw new Error('Проект не найден');
                    } else if (projectError.response?.status === 403) {
                        throw new Error('У вас нет доступа к этому проекту');
                    } else {
                        throw new Error(projectError.response?.data?.message ||
                            projectError.response?.data?.error ||
                            projectError.message ||
                            'Произошла ошибка при загрузке проекта');
                    }
                }
            } catch (err) {
                console.error('Error in project loading flow:', err);
                console.error('Error details:', {
                    message: err.message,
                    responseStatus: err.response?.status,
                    responseData: err.response?.data
                });

                let errorMessage = 'Не удалось загрузить проект. Пожалуйста, попробуйте позже.';

                if (err.response) {
                    console.error('Server response:', err.response.data);
                    errorMessage = err.response.data?.message || err.response.data?.error || err.message || errorMessage;
                } else if (err.request) {
                    console.error('No response received:', err.request);
                    errorMessage = 'Сервер не отвечает. Пожалуйста, проверьте подключение к интернету.';
                } else if (err.message) {
                    errorMessage = err.message;
                }

                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [teamId, projectId]);

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData({
            ...editData,
            [name]: value
        });
    };

    const startEditing = () => {
        setEditData({
            name: project.name || '',
            description: project.description || ''
        });
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
    };

    const saveProjectDetails = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Требуется авторизация');
                return;
            }

            const projectID = project._id || project.id;
            const response = await axios.put(
                `${API_BASE_URL}/api/projects/${projectID}`,
                {
                    name: editData.name,
                    description: editData.description
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            // Update local project data
            setProject({
                ...project,
                name: editData.name,
                description: editData.description
            });

            setIsEditing(false);
            setNotification({
                open: true,
                message: 'Данные проекта успешно обновлены',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error updating project:', err);
            setNotification({
                open: true,
                message: `Ошибка при обновлении проекта: ${err.response?.data?.error || err.message}`,
                severity: 'error'
            });
        }
    };

    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };

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
                                    {isEditing ? (
                                        <TextField
                                            name="name"
                                            label="Название проекта"
                                            value={editData.name}
                                            onChange={handleEditChange}
                                            fullWidth
                                            variant="outlined"
                                            sx={{ mr: 2 }}
                                        />
                                    ) : (
                                        <Typography variant="h4" component="h1">
                                            {project.name}
                                        </Typography>
                                    )}

                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        {isEditing ? (
                                            <>
                                                <IconButton color="primary" onClick={saveProjectDetails}>
                                                    <Save />
                                                </IconButton>
                                                <IconButton color="default" onClick={cancelEditing}>
                                                    <Cancel />
                                                </IconButton>
                                            </>
                                        ) : (
                                            <>
                                                <IconButton color="primary" onClick={startEditing}>
                                                    <Edit />
                                                </IconButton>
                                                <Button
                                                    variant="outlined"
                                                    color="primary"
                                                    onClick={() => {
                                                        const projectID = project._id || project.id;
                                                        console.log(`Navigating to view project: ${projectID}`);
                                                        navigate(`/teams/${teamId}/projects/${projectID}/viewer`);
                                                    }}
                                                >
                                                    Посмотреть
                                                </Button>
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    onClick={() => {
                                                        const projectID = project._id || project.id;
                                                        console.log(`Navigating to edit project: ${projectID}`);
                                                        navigate(`/teams/${teamId}/projects/${projectID}/constructor`);
                                                    }}
                                                >
                                                    Редактировать
                                                </Button>
                                            </>
                                        )}
                                    </Box>
                                </Box>

                                {isEditing ? (
                                    <TextField
                                        name="description"
                                        label="Описание проекта"
                                        value={editData.description}
                                        onChange={handleEditChange}
                                        fullWidth
                                        multiline
                                        rows={4}
                                        variant="outlined"
                                        sx={{ mb: 3 }}
                                    />
                                ) : (
                                    <Typography variant="body1" color="text.secondary" paragraph>
                                        {project.description || 'Нет описания'}
                                    </Typography>
                                )}

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

            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={handleCloseNotification}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert
                    onClose={handleCloseNotification}
                    severity={notification.severity}
                    sx={{ width: '100%' }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ProjectConstructor; 