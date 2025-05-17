import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Paper, Alert, Fade, CircularProgress, Menu, MenuItem, FormControlLabel, Switch } from '@mui/material';
import { PersonSearch, Close, VideoLibrary, Videocam, HighQuality, SettingsInputSvideo, Refresh, Settings } from '@mui/icons-material';
import VideoAnalyzer from './VideoAnalyzer.js';

const VideoViewer = ({ isVisible, onClose, videoUrl, embedded = false, currentTime = 0, isPlaying = false }) => {
    const [isDancerSelectionMode, setIsDancerSelectionMode] = useState(false);
    const [selectedDancer, setSelectedDancer] = useState(null);
    const [videoQuality, setVideoQuality] = useState('high');
    const [isLoading, setIsLoading] = useState(false);
    const [videoElement, setVideoElement] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [videoFormat, setVideoFormat] = useState(null);
    const [playbackMode, setPlaybackMode] = useState('normal'); // 'normal', 'lowLatency', 'progressive'
    const [useFallbackPlayer, setUseFallbackPlayer] = useState(false);
    const videoRef = useRef(null);
    const fallbackVideoRef = useRef(null);
    const loadTimeoutRef = useRef(null);
    const [settingsAnchor, setSettingsAnchor] = useState(null);

    // Detect video format from URL for optimized loading
    useEffect(() => {
        if (videoUrl) {
            // Extract extension from URL
            const extension = videoUrl.split('.').pop().toLowerCase();

            if (['mp4', 'mov', 'webm', 'ogv'].includes(extension)) {
                setVideoFormat(extension);
                console.log(`Detected video format: ${extension}`);

                // Set optimal playback mode based on format
                if (extension === 'mp4') {
                    setPlaybackMode('progressive');
                } else if (extension === 'webm') {
                    setPlaybackMode('normal');
                }
            } else {
                setVideoFormat('unknown');
                console.log('Unknown video format');
            }
        }
    }, [videoUrl]);

    // Handle video loading state and timeouts with format-specific optimizations
    useEffect(() => {
        if (videoUrl) {
            setIsLoading(true);
            setLoadError(null);

            // Adjust timeout based on format - longer for certain formats
            const timeoutDuration = videoFormat === 'mp4' ? 90000 : 60000; // 1.5 min for MP4, 1 min for others

            // Set a timeout to detect extremely long loading times
            loadTimeoutRef.current = setTimeout(() => {
                if (isLoading && !videoElement) {
                    console.warn('Video loading timeout exceeded');
                    setLoadError('Превышено время загрузки видео. Видео может быть слишком длинным или в неподдерживаемом формате.');
                }
            }, timeoutDuration);
        }

        return () => {
            if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current);
            }
        };
    }, [videoUrl, videoFormat]);

    // Handle fallback video player
    useEffect(() => {
        if (!fallbackVideoRef.current || !videoUrl) return;

        const video = fallbackVideoRef.current;

        const handleVideoReady = () => {
            console.log('Fallback video is ready, duration:', video.duration);
            setIsLoading(false);

            // Set controls and properties
            if (video.duration > 180) {
                // For long videos
                video.controls = true;
            }
        };

        const handleVideoError = (error) => {
            console.error('Fallback video error:', error);
            setLoadError('Ошибка воспроизведения видео даже в запасном плеере. Формат видео может не поддерживаться браузером.');
        };

        // Handle plaback state
        const syncPlaybackState = () => {
            if (isPlaying && video.paused) {
                video.play().catch(e => console.error('Failed to play fallback video:', e));
            } else if (!isPlaying && !video.paused) {
                video.pause();
            }

            // Sync time
            if (Math.abs(video.currentTime - currentTime) > 0.5) {
                try {
                    video.currentTime = currentTime;
                } catch (e) {
                    console.error('Error setting fallback video time:', e);
                }
            }
        };

        // Set up event listeners
        video.addEventListener('loadeddata', handleVideoReady);
        video.addEventListener('canplay', handleVideoReady);
        video.addEventListener('error', handleVideoError);
        video.addEventListener('timeupdate', syncPlaybackState);

        // Initial load
        video.load();

        return () => {
            video.removeEventListener('loadeddata', handleVideoReady);
            video.removeEventListener('canplay', handleVideoReady);
            video.removeEventListener('error', handleVideoError);
            video.removeEventListener('timeupdate', syncPlaybackState);
        };
    }, [videoUrl, isPlaying, currentTime]);

    // Synchronize with external time and playback state
    useEffect(() => {
        if (videoElement && typeof currentTime === 'number') {
            try {
                // Seeking in videos might throw errors if the video isn't fully loaded
                // or if the browser can't handle it for some reason
                if (Math.abs(videoElement.currentTime - currentTime) > 0.5) {
                    console.log(`Seeking to ${currentTime}s in VideoViewer`);
                    videoElement.currentTime = currentTime;
                }
            } catch (err) {
                console.error('Error setting video time:', err);
            }

            // Handle playback state
            try {
                if (isPlaying && videoElement.paused) {
                    console.log('External play command received in VideoViewer');
                    videoElement.play().catch(e => {
                        console.error('Failed to play video:', e);
                        // Show user-friendly error for autoplay issues
                        if (e.name === 'NotAllowedError') {
                            setLoadError('Автоматическое воспроизведение заблокировано. Пожалуйста, нажмите на видео для воспроизведения.');
                        }
                    });
                } else if (!isPlaying && !videoElement.paused) {
                    console.log('External pause command received in VideoViewer');
                    videoElement.pause();
                }
            } catch (playErr) {
                console.error('Error controlling playback:', playErr);
            }
        }
    }, [currentTime, isPlaying, videoElement]);

    // Log changes to dancer selection mode and video URL
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

    const toggleVideoQuality = () => {
        setVideoQuality(prevQuality => prevQuality === 'high' ? 'low' : 'high');
    };

    const handleVideoLoaded = (videoRef) => {
        console.log('Video loaded successfully, duration:', videoRef.duration, 'format:', videoFormat);
        setIsLoading(false);
        setVideoElement(videoRef);
        setLoadError(null);

        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
        }

        // Apply optimizations for long videos
        if (videoRef.duration > 180) { // longer than 3 minutes
            console.log('Applying long video optimizations');

            // Additional optimizations specific to VideoViewer
            if (playbackMode === 'lowLatency') {
                videoRef.playbackRate = 1.0; // Ensure normal speed
            }
        }
    };

    const handleRetry = () => {
        if (videoUrl) {
            setIsLoading(true);
            setLoadError(null);

            // If we have a videoElement reference, try to reload it
            if (videoElement) {
                // Try with different settings based on previous errors
                if (playbackMode === 'normal') {
                    setPlaybackMode('progressive');
                } else if (playbackMode === 'progressive') {
                    setPlaybackMode('lowLatency');
                } else {
                    setPlaybackMode('normal');
                }

                console.log(`Retrying with playback mode: ${playbackMode}`);
                videoElement.load();
            }
        }
    };

    const handleSettingsClick = (event) => {
        setSettingsAnchor(event.currentTarget);
    };

    const handleSettingsClose = () => {
        setSettingsAnchor(null);
    };

    const handlePlaybackModeChange = (mode) => {
        setPlaybackMode(mode);
        setSettingsAnchor(null);

        if (videoElement) {
            console.log(`Changing playback mode to ${mode}`);
            videoElement.load();
        }
    };

    const toggleFallbackPlayer = () => {
        setUseFallbackPlayer(prev => !prev);
        setIsLoading(true);
        setLoadError(null);

        // Give the DOM time to update before loading the video
        setTimeout(() => {
            if (fallbackVideoRef.current) {
                fallbackVideoRef.current.load();
            }
        }, 100);
    };

    return (
        <Box
            sx={{
                position: embedded ? 'relative' : 'fixed',
                top: embedded ? 'auto' : 0,
                left: embedded ? 'auto' : 0,
                width: '100%',
                height: embedded ? '100%' : '100vh',
                zIndex: embedded ? 'auto' : 1000,
                backgroundColor: embedded ? 'transparent' : 'rgba(13, 17, 40, 0.97)',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: embedded ? '12px' : 0,
                overflow: 'hidden',
                boxShadow: embedded ? '0 8px 32px rgba(0, 0, 0, 0.25)' : 'none',
            }}
        >
            {/* Header with controls */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(15, 19, 50, 0.9)',
                backdropFilter: 'blur(8px)'
            }}>
                <Typography variant="h6" sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 600
                }}>
                    <Videocam sx={{ mr: 1, color: '#33D2FF' }} />
                    Просмотр видео {videoFormat ? `(${videoFormat.toUpperCase()})` : ''}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* Fallback player switch */}
                    <FormControlLabel
                        control={
                            <Switch
                                checked={useFallbackPlayer}
                                onChange={toggleFallbackPlayer}
                                size="small"
                            />
                        }
                        label={<Typography variant="caption" sx={{ color: 'white' }}>Запасной проигрыватель</Typography>}
                        sx={{ mr: 2 }}
                    />

                    {/* Advanced settings for video playback */}
                    <Tooltip title="Настройки воспроизведения">
                        <IconButton
                            onClick={handleSettingsClick}
                            size="small"
                            sx={{
                                color: 'rgba(255, 255, 255, 0.9)',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                }
                            }}
                        >
                            <Settings />
                        </IconButton>
                    </Tooltip>

                    <Menu
                        anchorEl={settingsAnchor}
                        open={Boolean(settingsAnchor)}
                        onClose={handleSettingsClose}
                    >
                        <MenuItem
                            onClick={() => handlePlaybackModeChange('normal')}
                            selected={playbackMode === 'normal'}
                        >
                            Обычный режим
                        </MenuItem>
                        <MenuItem
                            onClick={() => handlePlaybackModeChange('progressive')}
                            selected={playbackMode === 'progressive'}
                        >
                            Прогрессивная загрузка
                        </MenuItem>
                        <MenuItem
                            onClick={() => handlePlaybackModeChange('lowLatency')}
                            selected={playbackMode === 'lowLatency'}
                        >
                            Низкая задержка
                        </MenuItem>
                    </Menu>

                    {/* Retry button for video loading */}
                    {loadError && (
                        <Tooltip title="Повторить загрузку">
                            <IconButton
                                onClick={handleRetry}
                                size="small"
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    backgroundColor: 'rgba(255, 0, 0, 0.2)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 0, 0, 0.3)',
                                    }
                                }}
                            >
                                <Refresh />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Video quality toggler */}
                    {videoUrl && !useFallbackPlayer && (
                        <Tooltip title={`Качество: ${videoQuality === 'high' ? 'Высокое' : 'Низкое'}`}>
                            <IconButton
                                onClick={toggleVideoQuality}
                                size="small"
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    }
                                }}
                            >
                                {videoQuality === 'high' ? <HighQuality /> : <SettingsInputSvideo />}
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Close button */}
                    {!embedded && (
                        <IconButton
                            onClick={onClose}
                            size="small"
                            sx={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                '&:hover': {
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                }
                            }}
                        >
                            <Close />
                        </IconButton>
                    )}
                </Box>
            </Box>

            {/* Main content area */}
            <Box sx={{
                flex: '1',
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: '#050714',
                minHeight: embedded ? 'auto' : '70vh',
            }}>
                {/* Dancer selection mode indicator */}
                {isDancerSelectionMode && !useFallbackPlayer && (
                    <Fade in={true}>
                        <Box sx={{
                            position: 'absolute',
                            top: 16,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 10,
                            backgroundColor: 'rgba(51, 226, 160, 0.15)',
                            color: '#33E2A0',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(51, 226, 160, 0.3)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                        }}>
                            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                                <PersonSearch sx={{ mr: 1, fontSize: 18 }} />
                                Кликните на танцора для выделения
                            </Typography>
                        </Box>
                    </Fade>
                )}

                {/* Video content or placeholder */}
                {videoUrl ? (
                    <Box sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {isLoading && (
                            <Box sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: 'rgba(5, 7, 20, 0.7)',
                                zIndex: 5,
                                backdropFilter: 'blur(5px)',
                            }}>
                                <CircularProgress size={80} sx={{ mb: 3, color: '#33D2FF' }} />
                                <Typography variant="h5" sx={{ color: 'white', mb: 1 }}>
                                    Загрузка видео...
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                    {videoFormat ? `Формат: ${videoFormat.toUpperCase()}` : ''} • Режим: {
                                        useFallbackPlayer ? 'Запасной проигрыватель' :
                                            playbackMode === 'normal' ? 'Обычный' :
                                                playbackMode === 'progressive' ? 'Прогрессивный' :
                                                    'Низкая задержка'
                                    }
                                </Typography>
                            </Box>
                        )}

                        {loadError && (
                            <Box sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: 'rgba(5, 7, 20, 0.7)',
                                zIndex: 5,
                                backdropFilter: 'blur(5px)',
                            }}>
                                <Alert
                                    severity="error"
                                    sx={{
                                        width: '70%',
                                        mb: 2,
                                        backgroundColor: 'rgba(211, 47, 47, 0.15)',
                                        color: '#ff867c',
                                        '& .MuiAlert-icon': {
                                            color: '#ff867c'
                                        }
                                    }}
                                >
                                    {loadError}
                                </Alert>
                                <Typography variant="body2" sx={{ color: 'white', mb: 2 }}>
                                    Попробуйте изменить режим воспроизведения или качество видео
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        startIcon={<Refresh />}
                                        onClick={handleRetry}
                                    >
                                        Повторить загрузку
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="inherit"
                                        onClick={toggleFallbackPlayer}
                                    >
                                        {useFallbackPlayer ? 'Стандартный проигрыватель' : 'Запасной проигрыватель'}
                                    </Button>
                                </Box>
                            </Box>
                        )}

                        {/* Standard VideoAnalyzer component */}
                        {!useFallbackPlayer && (
                            <VideoAnalyzer
                                videoUrl={videoUrl}
                                onPersonSelected={handlePersonSelected}
                                selectedPerson={selectedDancer}
                                isDancerSelectionMode={isDancerSelectionMode}
                                videoQuality={videoQuality}
                                onVideoLoaded={handleVideoLoaded}
                                currentTime={currentTime}
                                isPlaying={isPlaying}
                            />
                        )}

                        {/* Fallback video player */}
                        {useFallbackPlayer && (
                            <Box sx={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'relative',
                            }}>
                                <video
                                    ref={fallbackVideoRef}
                                    src={videoUrl}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                    }}
                                    controls
                                    playsInline
                                    preload="auto"
                                    controlsList="nodownload"
                                    autoPlay={isPlaying}
                                />
                            </Box>
                        )}
                    </Box>
                ) : (
                    <Box sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        p: 3
                    }}>
                        <Box sx={{
                            textAlign: 'center',
                            maxWidth: '500px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            p: 4,
                            borderRadius: '16px',
                            backgroundColor: 'rgba(30, 34, 68, 0.7)',
                            boxShadow: 'inset 0 0 20px rgba(51, 210, 255, 0.1)',
                            border: '1px dashed rgba(51, 210, 255, 0.2)'
                        }}>
                            <VideoLibrary sx={{
                                fontSize: 80,
                                mb: 3,
                                color: 'rgba(51, 210, 255, 0.2)'
                            }} />
                            <Typography variant="h5" sx={{
                                color: 'white',
                                mb: 2,
                                fontWeight: 600
                            }}>
                                Видео не загружено
                            </Typography>
                            <Typography variant="body1" sx={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                mb: 3
                            }}>
                                Для анализа движений и синхронизации хореографии загрузите видео через основной интерфейс конструктора
                            </Typography>

                            <Alert
                                severity="info"
                                sx={{
                                    backgroundColor: 'rgba(3, 169, 244, 0.1)',
                                    border: '1px solid rgba(3, 169, 244, 0.2)',
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    '& .MuiAlert-icon': {
                                        color: '#33D2FF'
                                    }
                                }}
                            >
                                Поддерживаются видео форматов MP4 и WebM длительностью до 1 часа
                            </Alert>
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default VideoViewer; 