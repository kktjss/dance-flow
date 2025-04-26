import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Box,
    Container,
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    boxShadow: 'none',
    borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
}));

const StyledButton = styled(Button)(({ theme }) => ({
    marginLeft: theme.spacing(2),
    borderRadius: '20px',
    textTransform: 'none',
    fontWeight: 500,
}));

function Navbar() {
    const navigate = useNavigate();
    // TODO: Добавить реальную проверку авторизации
    const isAuthenticated = false;

    return (
        <StyledAppBar position="fixed">
            <Container maxWidth="lg">
                <Toolbar disableGutters>
                    <Typography
                        variant="h6"
                        component="div"
                        sx={{ flexGrow: 1, color: 'primary.main', fontWeight: 700 }}
                        onClick={() => navigate('/')}
                        style={{ cursor: 'pointer' }}
                    >
                        DanceFlow
                    </Typography>
                    <Box>
                        {isAuthenticated ? (
                            <>
                                <StyledButton color="primary" variant="text" onClick={() => navigate('/builder')}>
                                    Конструктор
                                </StyledButton>
                                <StyledButton color="primary" variant="text" onClick={() => navigate('/teams')}>
                                    Команды
                                </StyledButton>
                                <StyledButton color="primary" variant="contained">
                                    Выйти
                                </StyledButton>
                            </>
                        ) : (
                            <>
                                <StyledButton color="primary" variant="text" onClick={() => navigate('/login')}>
                                    Войти
                                </StyledButton>
                                <StyledButton color="primary" variant="contained" onClick={() => navigate('/register')}>
                                    Регистрация
                                </StyledButton>
                            </>
                        )}
                    </Box>
                </Toolbar>
            </Container>
        </StyledAppBar>
    );
}

export default Navbar; 