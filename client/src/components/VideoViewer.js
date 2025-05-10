import React, { useState, useEffect } from 'react';
import { Box as MuiBox, Typography, Button, IconButton, Tooltip } from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import VideoAnalyzer from './VideoAnalyzer.js';

const VideoViewer = ({ isVisible, onClose, videoUrl }) => {
    const [isDancerSelectionMode, setIsDancerSelectionMode] = useState(false);
    const [selectedDancer, setSelectedDancer] = useState(null);

    // Логируем изменение режима выбора танцора
    useEffect(() => {
        console.log('VideoViewer: Dancer selection mode changed to:', isDancerSelectionMode);
    }, [isDancerSelectionMode]);

    if (!isVisible) return null;

    const handlePersonSelected = (personId) => {
        console.log('VideoViewer: Person selected:', personId);
        if (isDancerSelectionMode) {
            setSelectedDancer(personId);
            setIsDancerSelectionMode(false);
        }
    };

    const toggleDancerSelectionMode = () => {
        console.log('VideoViewer: Toggling dancer selection mode from:', isDancerSelectionMode);
        const newMode = !isDancerSelectionMode;
        console.log('VideoViewer: New mode will be:', newMode);
        setIsDancerSelectionMode(newMode);
        if (!isDancerSelectionMode) {
            setSelectedDancer(null);
        }
    };

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
                    <MuiBox sx={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        mb: 2,
                        position: 'relative'
                    }}>
                        <Tooltip title={isDancerSelectionMode ? "Отменить выбор танцора" : "Найти танцора"}>
                            <IconButton
                                onClick={toggleDancerSelectionMode}
                                sx={{
                                    backgroundColor: isDancerSelectionMode ? '#4caf50' : 'rgba(255, 255, 255, 0.1)',
                                    '&:hover': {
                                        backgroundColor: isDancerSelectionMode ? '#388e3c' : 'rgba(255, 255, 255, 0.2)',
                                    },
                                    color: 'white'
                                }}
                            >
                                <PersonSearchIcon />
                            </IconButton>
                        </Tooltip>
                        {isDancerSelectionMode && (
                            <Typography
                                variant="body2"
                                sx={{
                                    position: 'absolute',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    color: 'white',
                                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                    padding: '4px 8px',
                                    borderRadius: '4px'
                                }}
                            >
                                Кликните на танцора для выделения
                            </Typography>
                        )}
                    </MuiBox>
                    <MuiBox sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden'
                    }}>
                        <VideoAnalyzer
                            videoUrl={videoUrl}
                            onPersonSelected={handlePersonSelected}
                            selectedPerson={selectedDancer}
                            isDancerSelectionMode={isDancerSelectionMode}
                        />
                    </MuiBox>
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