import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    CircularProgress,
    Alert,
    Box
} from '@mui/material';
import Navbar from '../components/Navbar';
import CanvasViewer from '../components/CanvasViewer';

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

    // Пример данных для CanvasViewer (замените на реальные)
    const exampleElements = [
        {
            id: '1',
            type: 'rectangle',
            position: { x: 100, y: 100 },
            size: { width: 120, height: 80 },
            style: { backgroundColor: '#90caf9', borderColor: '#1976d2', borderWidth: 2, opacity: 1 },
            keyframes: []
        },
        {
            id: '2',
            type: 'circle',
            position: { x: 300, y: 200 },
            size: { width: 80, height: 80 },
            style: { backgroundColor: '#a5d6a7', borderColor: '#388e3c', borderWidth: 2, opacity: 1 },
            keyframes: []
        }
    ];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    <Typography variant="h4" sx={{ mb: 4 }}>
                        My Projects (Viewer)
                    </Typography>
                    <Box sx={{ width: '100%', height: '70vh', border: '1px solid #eee', borderRadius: 2, overflow: 'hidden' }}>
                        <CanvasViewer
                            elements={exampleElements}
                            currentTime={0}
                            isPlaying={false}
                            project={{}}
                        />
                    </Box>
                </Container>
            </Box>
        </Box>
    );
};

export default ProjectsPage; 