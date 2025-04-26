import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    TextField,
    Button,
    Paper,
    Link,
    Alert,
} from '@mui/material';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Проверка паролей
        if (formData.password !== formData.confirmPassword) {
            setError('Пароли не совпадают');
            setLoading(false);
            return;
        }

        try {
            console.log('Sending registration request:', {
                username: formData.username,
                email: formData.email,
            });

            const response = await axios.post('http://localhost:5000/api/auth/register', {
                username: formData.username,
                email: formData.email,
                password: formData.password,
            });

            console.log('Registration response:', response.data);

            // Сохраняем токен в localStorage
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Перенаправляем на главную страницу
            navigate('/');
        } catch (error) {
            console.error('Registration error:', error);
            setError(
                error.response?.data?.details ||
                error.response?.data?.message ||
                'Ошибка при регистрации. Проверьте подключение к серверу.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="sm">
                    <Paper elevation={3} sx={{ p: 4 }}>
                        <Typography variant="h4" component="h1" gutterBottom align="center">
                            Регистрация
                        </Typography>
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}
                        <form onSubmit={handleSubmit}>
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="username"
                                label="Имя пользователя"
                                name="username"
                                autoComplete="username"
                                autoFocus
                                value={formData.username}
                                onChange={handleChange}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="email"
                                label="Email"
                                name="email"
                                autoComplete="email"
                                value={formData.email}
                                onChange={handleChange}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Пароль"
                                type="password"
                                id="password"
                                autoComplete="new-password"
                                value={formData.password}
                                onChange={handleChange}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="confirmPassword"
                                label="Подтвердите пароль"
                                type="password"
                                id="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2 }}
                                disabled={loading}
                            >
                                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
                            </Button>
                            <Box sx={{ textAlign: 'center' }}>
                                <Link
                                    component="button"
                                    variant="body2"
                                    onClick={() => navigate('/login')}
                                >
                                    Уже есть аккаунт? Войти
                                </Link>
                            </Box>
                        </form>
                    </Paper>
                </Container>
            </Box>
            <Footer />
        </Box>
    );
}

export default Register; 