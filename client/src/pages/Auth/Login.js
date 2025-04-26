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

function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
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

        try {
            const response = await axios.post('http://localhost:5000/api/auth/login', {
                email: formData.email,
                password: formData.password,
            });

            // Сохраняем токен и данные пользователя
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Перенаправляем на дашборд
            navigate('/dashboard');
        } catch (error) {
            setError(error.response?.data?.message || 'Ошибка при входе');
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
                            Вход
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
                                id="email"
                                label="Email"
                                name="email"
                                autoComplete="email"
                                autoFocus
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
                                autoComplete="current-password"
                                value={formData.password}
                                onChange={handleChange}
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2 }}
                                disabled={loading}
                            >
                                {loading ? 'Вход...' : 'Войти'}
                            </Button>
                            <Box sx={{ textAlign: 'center' }}>
                                <Link
                                    component="button"
                                    variant="body2"
                                    onClick={() => navigate('/register')}
                                >
                                    Нет аккаунта? Зарегистрироваться
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

export default Login; 