import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';
import DebugModelViewer from '../components/DebugModelViewer';

const DebugPage = () => {
    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>
                Страница отладки 3D-моделей
            </Typography>

            <Paper elevation={3} sx={{ p: 2, mb: 4 }}>
                <Typography variant="body1" gutterBottom>
                    Эта страница предназначена для отладки просмотрщика 3D-моделей. Проверьте консоль браузера для получения дополнительной информации.
                </Typography>
            </Paper>

            <Box sx={{
                width: '100%',
                height: '600px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                <DebugModelViewer />
            </Box>
        </Container>
    );
};

export default DebugPage; 