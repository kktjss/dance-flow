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
                const response = await axios.get(
                    `${API_BASE_URL}/api/teams/${teamId}/projects/${projectId}/viewer`,
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );

                if (response.data.success) {
                    setProject(response.data.project);
                } else {
                    setError('Не удалось загрузить проект');
                }
            } catch (err) {
                console.error('Error fetching project:', err);
                setError('Не удалось загрузить проект. Пожалуйста, попробуйте позже.');
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