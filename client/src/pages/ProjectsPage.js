import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Button,
    CircularProgress,
    Alert,
    Box
} from '@mui/material';
import ProjectList from '../components/ProjectList';
import Navbar from '../components/Navbar';

const ProjectsPage = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = () => {
            const userData = localStorage.getItem('user');
            const token = localStorage.getItem('token');

            if (!userData || !token) {
                console.log('No user data or token found, redirecting to login');
                navigate('/login');
                return;
            }

            try {
                const parsedUser = JSON.parse(userData);
                console.log('User authenticated:', parsedUser.username);
                setUser(parsedUser);
            } catch (error) {
                console.error('Error parsing user data:', error);
                setError('Invalid user data');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [navigate]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Navbar />
                <Box sx={{ flexGrow: 1, pt: 8 }}>
                    <Container maxWidth="lg" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                        <CircularProgress />
                    </Container>
                </Box>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Navbar />
                <Box sx={{ flexGrow: 1, pt: 8 }}>
                    <Container maxWidth="lg">
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    </Container>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    <Typography variant="h4" sx={{ mb: 4 }}>
                        My Projects
                    </Typography>
                    <ProjectList />
                </Container>
            </Box>
        </Box>
    );
};

export default ProjectsPage; 