import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import ChoreographyList from '../components/ChoreographyList';

const API_URL = 'http://localhost:5000/api';

const ProjectsPage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            fetchProjects();
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/projects`);
            setProjects(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching projects:', err);
            setError('Не удалось загрузить проекты. Пожалуйста, попробуйте позже.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (id) => {
        try {
            await axios.delete(`${API_URL}/projects/${id}`);
            setProjects(projects.filter(project => project._id !== id));
        } catch (err) {
            console.error('Error deleting project:', err);
            setError('Не удалось удалить проект. Пожалуйста, попробуйте позже.');
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h4" component="h1">
                            Все проекты
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                            Просмотр всех доступных хореографий
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Paper sx={{ p: 4, minHeight: '500px' }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <ChoreographyList
                                choreographies={projects}
                                onDelete={handleDeleteProject}
                            />
                        )}
                    </Paper>
                </Container>
            </Box>
        </Box>
    );
};

export default ProjectsPage; 