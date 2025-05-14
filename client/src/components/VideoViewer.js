import React, { useState, useEffect } from 'react';
import { Box as MuiBox, Typography, Button, IconButton, Tooltip, Paper, Alert } from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import VideoAnalyzer from './VideoAnalyzer.js';

const VideoViewer = ({ isVisible, onClose, videoUrl, embedded = false }) => {
    const [isDancerSelectionMode, setIsDancerSelectionMode] = useState(false);
    const [selectedDancer, setSelectedDancer] = useState(null);

    // Логируем изменение режима выбора танцора и наличие видео
    useEffect(() => {
        console.log('VideoViewer: Dancer selection mode changed to:', isDancerSelectionMode);
        console.log('VideoViewer: videoUrl =', videoUrl);
    }, [isDancerSelectionMode, videoUrl]);

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
                position: embedded ? 'relative' : 'fixed',
                top: embedded ? 'auto' : 0,
                left: embedded ? 'auto' : 0,
                width: '100%',
                height: '100%',
                zIndex: embedded ? 'auto' : 1000,
                backgroundColor: embedded ? 'transparent' : 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: embedded ? 2 : 0,
                overflow: 'hidden',
            }}
        >
            <MuiBox sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Панель управления с кнопкой "Найти танцора" */}
                <MuiBox sx={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    mb: embedded ? 1 : 2,
                    position: 'relative',
                    p: embedded ? 1 : 0,
                    backgroundColor: embedded ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
                    borderRadius: embedded ? '4px 4px 0 0' : 0
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

                {/* Содержимое видео или сообщение об отсутствии */}
                <Paper
                    elevation={embedded ? 4 : 0}
                    sx={{
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                        backgroundColor: '#000',
                        borderRadius: embedded ? 2 : 0,
                        border: embedded ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        position: 'relative'
                    }}
                >
                    {videoUrl ? (
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
                    ) : (
                        <MuiBox sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            p: 3
                        }}>
                            <Alert
                                severity="info"
                                variant="filled"
                                sx={{
                                    mb: 3,
                                    width: '100%',
                                    maxWidth: 500
                                }}
                            >
                                Видео не загружено
                            </Alert>
                            <Typography variant="body1" sx={{ color: 'white', mb: 2, textAlign: 'center' }}>
                                Чтобы добавить видео, загрузите его через кнопку "Загрузить видео" в верхней панели проекта
                            </Typography>
                        </MuiBox>
                    )}
                </Paper>
            </MuiBox>

            {!embedded && (
                <Button
                    variant="contained"
                    color="primary"
                    onClick={onClose}
                    sx={{ mt: 2 }}
                >
                    Закрыть
                </Button>
            )}
        </MuiBox>
    );
};

export default VideoViewer; 