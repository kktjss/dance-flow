import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Paper, Alert, Fade, CircularProgress, Menu, MenuItem, FormControlLabel, Switch } from '@mui/material';
import { PersonSearch, Close, VideoLibrary, Videocam, HighQuality, SettingsInputSvideo, Refresh, Settings } from '@mui/icons-material';
import VideoAnalyzer from './VideoAnalyzer.js';

const VideoViewer = ({ isVisible, onClose, videoUrl, embedded = false, currentTime = 0, isPlaying = false }) => {
    console.log('VideoViewer: Инициализация компонента', {
        isVisible,
        videoUrl,
        embedded,
        currentTime,
        isPlaying
    });

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

    // Определение формата видео из URL для оптимизации загрузки
    useEffect(() => {
        console.log('VideoViewer: Проверка URL видео:', {
            videoUrl,
            isValidUrl: videoUrl && (videoUrl.startsWith('http') || videoUrl.startsWith('blob') || videoUrl.startsWith('/'))
        });

        if (videoUrl) {
            try {
                // Добавляем /api к пути, так как видео загружается через API
                const correctedUrl = videoUrl.startsWith('/api') ? videoUrl : `/api${videoUrl}`;
                const url = new URL(correctedUrl, window.location.origin);
                console.log('VideoViewer: Скорректированный URL:', {
                    originalUrl: videoUrl,
                    correctedUrl: url.href,
                    protocol: url.protocol,
                    pathname: url.pathname
                });

                // Проверяем доступность видео
                fetch(url.href, { method: 'HEAD' })
                    .then(response => {
                        console.log('VideoViewer: Проверка доступности видео:', {
                            status: response.status,
                            ok: response.ok,
                            contentType: response.headers.get('content-type'),
                            contentLength: response.headers.get('content-length')
                        });
                    })
                    .catch(error => {
                        console.error('VideoViewer: Ошибка проверки видео:', error);
                    });

                // Извлекаем расширение из URL
                const extension = videoUrl.split('.').pop().toLowerCase();
                console.log('VideoViewer: Определение формата видео:', {
                    extension,
                    isSupported: ['mp4', 'mov', 'webm', 'ogv'].includes(extension)
                });

                if (['mp4', 'mov', 'webm', 'ogv'].includes(extension)) {
                    setVideoFormat(extension);
                    if (extension === 'mp4') {
                        setPlaybackMode('progressive');
                    } else if (extension === 'webm') {
                        setPlaybackMode('normal');
                    }
                } else {
                    setVideoFormat('unknown');
                    console.log('Неизвестный формат видео');
                }
            } catch (e) {
                console.error('VideoViewer: Ошибка разбора URL:', e);
            }
        }
    }, [videoUrl]);

    // Обработка состояния загрузки видео и таймаутов с оптимизацией по формату
    useEffect(() => {
        if (videoUrl) {
            setIsLoading(true);
            setLoadError(null);

            // Регулируем таймаут в зависимости от формата - дольше для определенных форматов
            const timeoutDuration = videoFormat === 'mp4' ? 90000 : 60000; // 1.5 мин для MP4, 1 мин для других

            // Устанавливаем таймаут для обнаружения чрезмерно долгой загрузки
            loadTimeoutRef.current = setTimeout(() => {
                if (isLoading && !videoElement) {
                    console.warn('Превышено время загрузки видео');
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

    // Обработка запасного видеоплеера
    useEffect(() => {
        const video = fallbackVideoRef.current;

        if (video && videoUrl) {
            // Корректируем URL для API
            const correctedUrl = videoUrl.startsWith('/api') ? videoUrl : `/api${videoUrl}`;
            video.src = correctedUrl;

            console.log('VideoViewer: Инициализация запасного плеера:', {
                originalUrl: videoUrl,
                correctedUrl,
                videoState: {
                    readyState: video.readyState,
                    networkState: video.networkState,
                    error: video.error,
                    currentSrc: video.currentSrc
                }
            });

            const handleLoadStart = () => {
                console.log('VideoViewer: Начало загрузки видео в плеере:', {
                    readyState: video.readyState,
                    networkState: video.networkState
                });
            };

            const handleProgress = () => {
                const buffered = video.buffered;
                console.log('VideoViewer: Прогресс загрузки:', {
                    bufferedRanges: buffered.length > 0 ? {
                        start: buffered.start(0),
                        end: buffered.end(0)
                    } : 'Нет буфера',
                    networkState: video.networkState,
                    readyState: video.readyState
                });
            };

            video.addEventListener('loadstart', handleLoadStart);
            video.addEventListener('progress', handleProgress);

            const handleVideoReady = () => {
                console.log('VideoViewer: Запасной плеер готов:', {
                    duration: video.duration,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    readyState: video.readyState,
                    networkState: video.networkState
                });
                setIsLoading(false);

                if (video.duration > 180) {
                    video.controls = true;
                }
            };

            const handleVideoError = (error) => {
                console.error('VideoViewer: Ошибка запасного плеера:', {
                    error,
                    videoError: video.error,
                    networkState: video.networkState,
                    currentSrc: video.currentSrc
                });
                setLoadError('Ошибка воспроизведения видео даже в запасном плеере. Формат видео может не поддерживаться браузером.');
            };

            const syncPlaybackState = () => {
                if (isPlaying && video.paused) {
                    video.play().catch(e => console.error('Не удалось воспроизвести запасное видео:', e));
                } else if (!isPlaying && !video.paused) {
                    video.pause();
                }

                if (Math.abs(video.currentTime - currentTime) > 0.5) {
                    try {
                        video.currentTime = currentTime;
                    } catch (e) {
                        console.error('Ошибка установки времени запасного видео:', e);
                    }
                }
            };

            video.addEventListener('loadeddata', handleVideoReady);
            video.addEventListener('canplay', handleVideoReady);
            video.addEventListener('error', handleVideoError);
            video.addEventListener('timeupdate', syncPlaybackState);

            video.load();

            return () => {
                video.removeEventListener('loadstart', handleLoadStart);
                video.removeEventListener('progress', handleProgress);
                video.removeEventListener('loadeddata', handleVideoReady);
                video.removeEventListener('canplay', handleVideoReady);
                video.removeEventListener('error', handleVideoError);
                video.removeEventListener('timeupdate', syncPlaybackState);
            };
        }
    }, [videoUrl, isPlaying, currentTime]);

    // Синхронизация с внешним временем и состоянием воспроизведения
    useEffect(() => {
        if (videoElement && typeof currentTime === 'number') {
            try {
                // Перемотка в видео может вызвать ошибки, если видео не полностью загружено
                // или если браузер не может обработать это по какой-то причине
                if (Math.abs(videoElement.currentTime - currentTime) > 0.5) {
                    console.log(`Перемотка на ${currentTime}с в VideoViewer`);
                    videoElement.currentTime = currentTime;
                }
            } catch (err) {
                console.error('Ошибка установки времени видео:', err);
            }

            // Обработка состояния воспроизведения
            try {
                if (isPlaying && videoElement.paused) {
                    console.log('Получена внешняя команда воспроизведения в VideoViewer');
                    videoElement.play().catch(e => {
                        console.error('Не удалось воспроизвести видео:', e);
                        // Показываем понятную ошибку для проблем с автовоспроизведением
                        if (e.name === 'NotAllowedError') {
                            setLoadError('Автоматическое воспроизведение заблокировано. Пожалуйста, нажмите на видео для воспроизведения.');
                        }
                    });
                } else if (!isPlaying && !videoElement.paused) {
                    console.log('Получена внешняя команда паузы в VideoViewer');
                    videoElement.pause();
                }
            } catch (playErr) {
                console.error('Ошибка управления воспроизведением:', playErr);
            }
        }
    }, [currentTime, isPlaying, videoElement]);

    // Журналирование изменений режима выбора танцора и URL видео
    useEffect(() => {
        console.log('VideoViewer: Режим выбора танцора изменен на:', isDancerSelectionMode);
        console.log('VideoViewer: videoUrl =', videoUrl);
    }, [isDancerSelectionMode, videoUrl]);

    if (!isVisible) return null;

    const handlePersonSelected = (personId) => {
        console.log('VideoViewer: Выбран человек:', personId);
        if (isDancerSelectionMode) {
            setSelectedDancer(personId);
            setIsDancerSelectionMode(false);
        }
    };

    const toggleDancerSelectionMode = () => {
        console.log('VideoViewer: Переключение режима выбора танцора с:', isDancerSelectionMode);
        const newMode = !isDancerSelectionMode;
        console.log('VideoViewer: Новый режим будет:', newMode);
        setIsDancerSelectionMode(newMode);
        if (!isDancerSelectionMode) {
            setSelectedDancer(null);
        }
    };

    const toggleVideoQuality = () => {
        setVideoQuality(prevQuality => prevQuality === 'high' ? 'low' : 'high');
    };

    const handleVideoLoaded = (videoRef) => {
        console.log('Видео успешно загружено, длительность:', videoRef.duration, 'формат:', videoFormat);
        setIsLoading(false);
        setVideoElement(videoRef);
        setLoadError(null);

        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
        }

        // Применяем оптимизации для длинных видео
        if (videoRef.duration > 180) { // дольше 3 минут
            console.log('Применение оптимизаций для длинных видео');

            // Дополнительные оптимизации специфичные для VideoViewer
            if (playbackMode === 'lowLatency') {
                videoRef.playbackRate = 1.0; // Обеспечиваем нормальную скорость
            }
        }
    };

    const handleRetry = () => {
        if (videoUrl) {
            setIsLoading(true);
            setLoadError(null);

            // Если у нас есть ссылка на videoElement, пробуем перезагрузить его
            if (videoElement) {
                // Пробуем с другими настройками в зависимости от предыдущих ошибок
                if (playbackMode === 'normal') {
                    setPlaybackMode('progressive');
                } else if (playbackMode === 'progressive') {
                    setPlaybackMode('lowLatency');
                } else {
                    setPlaybackMode('normal');
                }

                console.log(`Повторная попытка с режимом воспроизведения: ${playbackMode}`);
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
            console.log(`Изменение режима воспроизведения на ${mode}`);
            videoElement.load();
        }
    };

    const toggleFallbackPlayer = () => {
        setUseFallbackPlayer(prev => !prev);
        setIsLoading(true);
        setLoadError(null);

        // Даем DOM время обновиться перед загрузкой видео
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
            {/* Заголовок с элементами управления */}
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
                    {/* Переключатель запасного плеера */}
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

                    {/* Кнопка "Найти танцора" */}
                    {videoUrl && !useFallbackPlayer && (
                        <Tooltip title="Найти танцора">
                            <IconButton
                                onClick={toggleDancerSelectionMode}
                                size="small"
                                sx={{
                                    color: isDancerSelectionMode ? '#33E2A0' : 'rgba(255, 255, 255, 0.9)',
                                    backgroundColor: isDancerSelectionMode
                                        ? 'rgba(51, 226, 160, 0.2)'
                                        : 'rgba(255, 255, 255, 0.05)',
                                    '&:hover': {
                                        backgroundColor: isDancerSelectionMode
                                            ? 'rgba(51, 226, 160, 0.3)'
                                            : 'rgba(255, 255, 255, 0.1)',
                                    },
                                    border: isDancerSelectionMode ? '1px solid rgba(51, 226, 160, 0.5)' : 'none'
                                }}
                            >
                                <PersonSearch />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Расширенные настройки для воспроизведения видео */}
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

                    {/* Кнопка повтора для загрузки видео */}
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

                    {/* Переключатель качества видео */}
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

                    {/* Кнопка закрытия */}
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

            {/* Основная область содержимого */}
            <Box sx={{
                flex: '1',
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: '#050714',
                minHeight: embedded ? 'auto' : '70vh',
            }}>
                {/* Индикатор режима выбора танцора */}
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

                {/* Содержимое видео или заполнитель */}
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

                        {/* Стандартный компонент VideoAnalyzer */}
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

                        {/* Запасной видеоплеер */}
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