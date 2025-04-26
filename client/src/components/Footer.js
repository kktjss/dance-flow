import React from 'react';
import { Box, Container, Typography, Link, Grid } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledFooter = styled(Box)(({ theme }) => ({
    backgroundColor: theme.palette.grey[100],
    padding: theme.spacing(6, 0),
    marginTop: 'auto',
}));

function Footer() {
    return (
        <StyledFooter>
            <Container maxWidth="lg">
                <Grid container spacing={4}>
                    <Grid item xs={12} sm={4}>
                        <Typography variant="h6" color="text.primary" gutterBottom>
                            DanceFlow
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Платформа для создания и управления хореографией
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Typography variant="h6" color="text.primary" gutterBottom>
                            Ссылки
                        </Typography>
                        <Link href="#" color="inherit" display="block" sx={{ mb: 1 }}>
                            О нас
                        </Link>
                        <Link href="#" color="inherit" display="block" sx={{ mb: 1 }}>
                            Контакты
                        </Link>
                        <Link href="#" color="inherit" display="block" sx={{ mb: 1 }}>
                            Помощь
                        </Link>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Typography variant="h6" color="text.primary" gutterBottom>
                            Контакты
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Email: info@danceflow.com
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Телефон: +7 (999) 123-45-67
                        </Typography>
                    </Grid>
                </Grid>
                <Box mt={5}>
                    <Typography variant="body2" color="text.secondary" align="center">
                        © {new Date().getFullYear()} DanceFlow. Все права защищены.
                    </Typography>
                </Box>
            </Container>
        </StyledFooter>
    );
}

export default Footer; 