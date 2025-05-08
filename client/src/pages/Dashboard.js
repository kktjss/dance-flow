import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemText,
    Divider,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Paper,
    CircularProgress,
    Alert
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    Add as AddIcon
} from '@mui/icons-material';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ChoreographyList from '../components/ChoreographyList';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const API_URL = 'http://localhost:5000/api';

function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
    const [settings, setSettings] = useState({
        username: '',
        email: '',
        notifications: true,
    });
    const [choreographies, setChoreographies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            setSettings({
                username: parsedUser.username,
                email: parsedUser.email,
                notifications: true,
            });
            fetchChoreographies();
            fetchHistory();
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const fetchChoreographies = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }
            const response = await axios.get(`${API_URL}/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChoreographies(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching choreographies:', err);
            setError('Не удалось загрузить хореографии. Пожалуйста, попробуйте позже.');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }
            const response = await axios.get(`${API_URL}/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(response.data);
        } catch (err) {
            console.error('Error fetching history:', err);
            setError('Не удалось загрузить историю. Пожалуйста, попробуйте позже.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleDeleteChoreography = async (id) => {
        try {
            await axios.delete(`${API_URL}/projects/${id}`);
            setChoreographies(choreographies.filter(choreo => choreo._id !== id));
        } catch (err) {
            console.error('Error deleting choreography:', err);
            setError('Не удалось удалить хореографию. Пожалуйста, попробуйте позже.');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const handleDeleteAccount = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/');
        } catch (err) {
            console.error('Error deleting account:', err);
            setError('Не удалось удалить аккаунт. Пожалуйста, попробуйте позже.');
        }
    };

    const handleSettingsSave = () => {
        // TODO: Implement settings save
        setOpenSettings(false);
    };

    const getActionText = (action) => {
        switch (action) {
            case 'PROJECT_CREATED':
                return 'Создан проект';
            case 'PROJECT_UPDATED':
                return 'Обновлен проект';
            case 'TEAM_MEMBER_ADDED':
                return 'Добавлен участник команды';
            case 'TEAM_MEMBER_REMOVED':
                return 'Удален участник команды';
            case 'TEAM_PROJECT_UPDATED':
                return 'Обновлен командный проект';
            default:
                return action;
        }
    };

    if (!user) {
        return null;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h4" component="h1">
                            Личный кабинет
                        </Typography>
                        <Box>
                            <IconButton color="primary" onClick={() => setOpenSettings(true)}>
                                <SettingsIcon />
                            </IconButton>
                        </Box>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Grid container spacing={4}>
                        {/* Мои хореографии */}
                        <Grid item xs={12} md={8}>
                            <Paper sx={{ p: 4, minHeight: '500px' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h5">
                                        Мои хореографии
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={() => navigate('/constructor')}
                                    >
                                        Создать
                                    </Button>
                                </Box>
                                {loading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                        <CircularProgress />
                                    </Box>
                                ) : (
                                    <ChoreographyList
                                        choreographies={choreographies}
                                        onDelete={handleDeleteChoreography}
                                    />
                                )}
                            </Paper>
                        </Grid>

                        {/* История */}
                        <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 4, minHeight: '500px' }}>
                                <Typography variant="h5" gutterBottom>
                                    История
                                </Typography>
                                {historyLoading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                        <CircularProgress />
                                    </Box>
                                ) : (
                                    <List>
                                        {history.map((item) => (
                                            <React.Fragment key={item._id}>
                                                <ListItem>
                                                    <ListItemText
                                                        primary={getActionText(item.action)}
                                                        secondary={
                                                            <>
                                                                <Typography component="span" variant="body2" color="text.primary">
                                                                    {item.projectId?.title || 'Проект'}
                                                                </Typography>
                                                                {' — '}
                                                                {item.description}
                                                                <br />
                                                                {format(new Date(item.timestamp), 'd MMMM yyyy, HH:mm', { locale: ru })}
                                                            </>
                                                        }
                                                    />
                                                </ListItem>
                                                <Divider component="li" />
                                            </React.Fragment>
                                        ))}
                                        {history.length === 0 && (
                                            <ListItem>
                                                <ListItemText primary="История пуста" />
                                            </ListItem>
                                        )}
                                    </List>
                                )}
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Settings Dialog */}
            <Dialog open={openSettings} onClose={() => setOpenSettings(false)}>
                <DialogTitle>Настройки</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Имя пользователя"
                        value={settings.username}
                        onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                        fullWidth
                        margin="normal"
                    />
                    <TextField
                        label="Email"
                        value={settings.email}
                        onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                        fullWidth
                        margin="normal"
                    />
                    <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<LogoutIcon />}
                            onClick={handleLogout}
                            fullWidth
                        >
                            Выйти
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => setOpenDeleteConfirm(true)}
                            fullWidth
                        >
                            Удалить аккаунт
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenSettings(false)}>Отмена</Button>
                    <Button onClick={handleSettingsSave} variant="contained">
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Account Confirmation Dialog */}
            <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}>
                <DialogTitle>Удалить аккаунт?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Вы уверены, что хотите удалить свой аккаунт? Это действие нельзя отменить.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteConfirm(false)}>Отмена</Button>
                    <Button onClick={handleDeleteAccount} color="error" variant="contained">
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default Dashboard; 