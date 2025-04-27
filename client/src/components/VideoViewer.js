import React from 'react';
import { Box as MuiBox, Typography, Button } from '@mui/material';

const VideoViewer = ({ isVisible, onClose, videoUrl }) => {
    if (!isVisible) return null;

    return (
        <MuiBox
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1000,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {videoUrl ? (
                <MuiBox sx={{ width: '90%', height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <video
                        controls
                        autoPlay
                        src={videoUrl}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                </MuiBox>
            ) : (
                <MuiBox sx={{ color: 'white', textAlign: 'center' }}>
                    <Typography variant="h6">
                        Нет загруженного видео
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        Загрузите видео в свойствах элемента "Видео хореографии"
                    </Typography>
                </MuiBox>
            )}

            <Button
                variant="contained"
                color="primary"
                onClick={onClose}
                sx={{ mt: 2 }}
            >
                Закрыть
            </Button>
        </MuiBox>
    );
};

export default VideoViewer; 