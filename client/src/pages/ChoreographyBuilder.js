import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import Navbar from '../components/Navbar';

function ChoreographyBuilder() {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    <Typography variant="h3" component="h1" gutterBottom>
                        Конструктор хореографии
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Здесь будет интерфейс для создания и редактирования хореографии.
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
}

export default ChoreographyBuilder; 