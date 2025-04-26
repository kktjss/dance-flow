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
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

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
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const handleDeleteAccount = () => {
        // TODO: Implement account deletion
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const handleSettingsSave = () => {
        // TODO: Implement settings save
        setOpenSettings(false);
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

                    <Grid container spacing={4}>
                        {/* Мои хореографии */}
                        <Grid item xs={12} md={8}>
                            <Paper sx={{ p: 4, minHeight: '500px' }}>
                                <Typography variant="h5" gutterBottom>
                                    Мои хореографии
                                </Typography>
                                <List>
                                    <ListItem>
                                        <ListItemText
                                            primary="Современный танец"
                                            secondary="Последнее обновление: 2 часа назад"
                                        />
                                        <Button size="small" onClick={() => navigate('/builder')}>
                                            Редактировать
                                        </Button>
                                    </ListItem>
                                    <Divider />
                                    <ListItem>
                                        <ListItemText
                                            primary="Классический балет"
                                            secondary="Последнее обновление: 1 день назад"
                                        />
                                        <Button size="small" onClick={() => navigate('/builder')}>
                                            Редактировать
                                        </Button>
                                    </ListItem>
                                </List>
                            </Paper>
                        </Grid>

                        {/* История */}
                        <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 4, minHeight: '500px' }}>
                                <Typography variant="h5" gutterBottom>
                                    История
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
                                </List>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Диалог настроек */}
            <Dialog open={openSettings} onClose={() => setOpenSettings(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Настройки</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Профиль
                        </Typography>
                        <TextField
                            margin="dense"
                            label="Имя пользователя"
                            fullWidth
                            value={settings.username}
                            onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                        />
                        <TextField
                            margin="dense"
                            label="Email"
                            fullWidth
                            value={settings.email}
                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                        />
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Управление аккаунтом
                        </Typography>
                        <Button
                            fullWidth
                            variant="outlined"
                            color="primary"
                            onClick={handleLogout}
                            sx={{ mb: 2 }}
                        >
                            Выйти из аккаунта
                        </Button>
                        <Button
                            fullWidth
                            variant="outlined"
                            color="error"
                            onClick={() => setOpenDeleteConfirm(true)}
                        >
                            Удалить аккаунт
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenSettings(false)}>Отмена</Button>
                    <Button onClick={handleSettingsSave} variant="contained">Сохранить</Button>
                </DialogActions>
            </Dialog>

            {/* Диалог подтверждения удаления */}
            <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}>
                <DialogTitle>Удаление аккаунта</DialogTitle>
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