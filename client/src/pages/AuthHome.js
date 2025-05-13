import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    Button,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
} from '@mui/material';
import {
    VideoLibrary as VideoIcon,
    Group as GroupIcon,
    Create as CreateIcon,
    History as HistoryIcon,
} from '@mui/icons-material';
import Navbar from '../components/Navbar';

function AuthHome() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    useEffect(() => {
        try {
            const userData = localStorage.getItem('user');
            if (userData && userData !== 'undefined' && userData !== 'null') {
                setUser(JSON.parse(userData));
            } else {
                console.log('No valid user data found in localStorage, redirecting to login');
                navigate('/login');
            }
        } catch (error) {
            console.error('Error parsing user data from localStorage:', error);
            // Очищаем поврежденные данные
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            navigate('/login');
        }
    }, [navigate]);

    if (!user) {
        return null;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    <Box sx={{ mb: 6 }}>
                        <Typography variant="h3" component="h1" gutterBottom>
                            Добро пожаловать, {user.username}!
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                            Ваш центр управления хореографией
                        </Typography>
                    </Box>

                    <Grid container spacing={4}>
                        {/* Статистика пользователя */}
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 4 }}>
                                <Typography variant="h5" gutterBottom>
                                    Ваша статистика
                                </Typography>
                                <List>
                                    <ListItem>
                                        <ListItemIcon>
                                            <VideoIcon />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Хореографии"
                                            secondary="2 активных хореографии"
                                        />
                                    </ListItem>
                                    <Divider />
                                    <ListItem>
                                        <ListItemIcon>
                                            <GroupIcon />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Команды"
                                            secondary="2 активные команды"
                                        />
                                    </ListItem>
                                    <Divider />
                                    <ListItem>
                                        <ListItemIcon>
                                            <HistoryIcon />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Последняя активность"
                                            secondary="2 часа назад"
                                        />
                                    </ListItem>
                                </List>
                            </Paper>
                        </Grid>

                        {/* Быстрый доступ */}
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 4 }}>
                                <Typography variant="h5" gutterBottom>
                                    Быстрый доступ
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <Card>
                                            <CardContent>
                                                <Typography variant="h6" gutterBottom>
                                                    Создать новую хореографию
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" paragraph>
                                                    Начните создавать новую хореографию с помощью нашего конструктора
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    startIcon={<CreateIcon />}
                                                    onClick={() => navigate('/constructor')}
                                                >
                                                    Создать
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Card>
                                            <CardContent>
                                                <Typography variant="h6" gutterBottom>
                                                    Управление командами
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" paragraph>
                                                    Создавайте команды и управляйте доступом к хореографиям
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    startIcon={<GroupIcon />}
                                                    onClick={() => navigate('/teams')}
                                                >
                                                    Управлять
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>
        </Box>
    );
}

export default AuthHome; 