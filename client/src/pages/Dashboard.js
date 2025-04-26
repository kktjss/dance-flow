import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    CardActions,
    Button,
    Paper,
    Tabs,
    Tab,
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
import Footer from '../components/Footer';

function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        // Получаем данные пользователя из localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    if (!user) {
        return null;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h4" component="h1" gutterBottom>
                            Добро пожаловать, {user.username}!
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Управляйте своими хореографиями и командами
                        </Typography>
                    </Box>

                    <Grid container spacing={4}>
                        {/* Левая панель с навигацией */}
                        <Grid item xs={12} md={3}>
                            <Paper sx={{ p: 2 }}>
                                <Tabs
                                    orientation="vertical"
                                    value={activeTab}
                                    onChange={handleTabChange}
                                    sx={{ borderRight: 1, borderColor: 'divider' }}
                                >
                                    <Tab icon={<VideoIcon />} label="Мои хореографии" />
                                    <Tab icon={<GroupIcon />} label="Мои команды" />
                                    <Tab icon={<CreateIcon />} label="Создать новую" />
                                    <Tab icon={<HistoryIcon />} label="История" />
                                </Tabs>
                            </Paper>
                        </Grid>

                        {/* Основной контент */}
                        <Grid item xs={12} md={9}>
                            {activeTab === 0 && (
                                <Box>
                                    <Typography variant="h5" gutterBottom>
                                        Мои хореографии
                                    </Typography>
                                    <Grid container spacing={3}>
                                        <Grid item xs={12} md={6}>
                                            <Card>
                                                <CardContent>
                                                    <Typography variant="h6" gutterBottom>
                                                        Современный танец
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Последнее обновление: 2 часа назад
                                                    </Typography>
                                                </CardContent>
                                                <CardActions>
                                                    <Button size="small" onClick={() => navigate('/builder')}>
                                                        Редактировать
                                                    </Button>
                                                    <Button size="small" color="primary">
                                                        Поделиться
                                                    </Button>
                                                </CardActions>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Card>
                                                <CardContent>
                                                    <Typography variant="h6" gutterBottom>
                                                        Классический балет
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Последнее обновление: 1 день назад
                                                    </Typography>
                                                </CardContent>
                                                <CardActions>
                                                    <Button size="small" onClick={() => navigate('/builder')}>
                                                        Редактировать
                                                    </Button>
                                                    <Button size="small" color="primary">
                                                        Поделиться
                                                    </Button>
                                                </CardActions>
                                            </Card>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                            {activeTab === 1 && (
                                <Box>
                                    <Typography variant="h5" gutterBottom>
                                        Мои команды
                                    </Typography>
                                    <List>
                                        <ListItem>
                                            <ListItemIcon>
                                                <GroupIcon />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary="Команда А"
                                                secondary="5 участников"
                                            />
                                            <Button size="small" onClick={() => navigate('/teams')}>
                                                Управлять
                                            </Button>
                                        </ListItem>
                                        <Divider />
                                        <ListItem>
                                            <ListItemIcon>
                                                <GroupIcon />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary="Команда Б"
                                                secondary="3 участника"
                                            />
                                            <Button size="small" onClick={() => navigate('/teams')}>
                                                Управлять
                                            </Button>
                                        </ListItem>
                                    </List>
                                </Box>
                            )}

                            {activeTab === 2 && (
                                <Box>
                                    <Typography variant="h5" gutterBottom>
                                        Создать новую хореографию
                                    </Typography>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="body1" paragraph>
                                                Начните создавать новую хореографию с помощью нашего конструктора
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                startIcon={<CreateIcon />}
                                                onClick={() => navigate('/builder')}
                                            >
                                                Создать
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </Box>
                            )}

                            {activeTab === 3 && (
                                <Box>
                                    <Typography variant="h5" gutterBottom>
                                        История действий
                                    </Typography>
                                    <List>
                                        <ListItem>
                                            <ListItemText
                                                primary="Создана хореография 'Современный танец'"
                                                secondary="2 часа назад"
                                            />
                                        </ListItem>
                                        <Divider />
                                        <ListItem>
                                            <ListItemText
                                                primary="Обновлена хореография 'Классический балет'"
                                                secondary="1 день назад"
                                            />
                                        </ListItem>
                                        <Divider />
                                        <ListItem>
                                            <ListItemText
                                                primary="Создана команда 'Команда А'"
                                                secondary="3 дня назад"
                                            />
                                        </ListItem>
                                    </List>
                                </Box>
                            )}
                        </Grid>
                    </Grid>
                </Container>
            </Box>
            <Footer />
        </Box>
    );
}

export default Dashboard; 