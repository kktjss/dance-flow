import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    IconButton,
    Slider,
    Typography,
    useTheme,
    Paper,
    alpha,
    Stack,
    Tooltip,
    Chip
} from '@mui/material';
import {
    PlayArrow,
    Pause,
    VolumeUp,
    VolumeOff,
    SkipNext,
    SkipPrevious,
    FiberManualRecord,
    Delete as DeleteIcon,
    AudioFile,
    Videocam,
    ArrowDropDown,
    ArrowDropUp,
    KeyboardArrowLeft,
    KeyboardArrowRight
} from '@mui/icons-material';
import { COLORS } from '../constants/colors';

// Цветовая палитра с использованием новой цветовой схемы
const PALETTE = {
    primary: {
        light: COLORS.primaryLight,
        main: COLORS.primary, // Сине-фиолетовый
        dark: '#5449A6'
    },
    secondary: {
        light: COLORS.secondaryLight,
        main: COLORS.secondary, // Светло-синий
        dark: '#0071CE'
    },
    tertiary: {
        light: COLORS.tertiaryLight,
        main: COLORS.tertiary, // Бирюзовый
        dark: '#2CB5B5'
    },
    accent: {
        light: '#FFE066',
        main: COLORS.accent, // Желтый
        dark: '#E6C300'
    },
    teal: {
        light: COLORS.tertiaryLight,
        main: COLORS.teal, // Сине-зеленый
        dark: '#008B9A'
    },
    purpleGrey: {
        light: '#9D94D3',
        main: '#8678B2', // Серо-фиолетовый
        dark: '#5D5080'
    }
};

const Player = ({
    audioUrl,
    videoUrl,
    duration = 60,
    currentTime = 0,
    onTimeUpdate,
    isPlaying,
    onPlayPause,
    readOnly = false,
    keyframeRecording = false,
    toggleKeyframeRecording = null,
    onRemoveAudio = null,
    onRemoveVideo = null,
    onDurationChange = null
}) => {
    const theme = useTheme();
    const [volume, setVolume] = useState(80);
    const [isMuted, setIsMuted] = useState(false);
    const [displayTime, setDisplayTime] = useState(currentTime);
    const [audioDuration, setAudioDuration] = useState(null);
    const audioRef = useRef(null);
    const animationRef = useRef(null);
    const lastTimeRef = useRef(null);
    const currentTimeRef = useRef(currentTime);

    // Обеспечиваем корректные числовые значения
    const safeCurrentTime = typeof currentTime === 'number' && !isNaN(currentTime) ? currentTime : 0;
    const safeDuration = audioDuration || (typeof duration === 'number' && !isNaN(duration) ? duration : 60);

    // Загружаем длительность аудио при изменении URL аудио
    useEffect(() => {
        if (!audioUrl) return;

        console.log("Player: Loading audio duration for:", audioUrl);
        const audio = new Audio();

        const loadDuration = () => {
            if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
                console.log("Player: Loaded audio duration:", audio.duration);
                const newDuration = Math.ceil(audio.duration);
                setAudioDuration(newDuration);

                // Уведомляем родительский компонент о новой длительности
                if (onDurationChange) {
                    console.log("Player: Notifying parent about new duration:", newDuration);
                    onDurationChange(newDuration);
                }
            } else {
                console.warn("Player: Invalid audio duration:", audio.duration);
            }
        };

        audio.onloadedmetadata = () => {
            console.log("Player: Metadata loaded event fired");
            loadDuration();
        };

        audio.onloadeddata = () => {
            console.log("Player: Data loaded event fired");
            loadDuration();
        };

        audio.ondurationchange = () => {
            console.log("Player: Duration change event fired");
            loadDuration();
        };

        audio.onerror = (e) => {
            console.error("Player: Error loading audio:", e);
        };

        // Устанавливаем источник
        audio.src = audioUrl;
        audio.load(); // Явно загружаем аудио

        // Принудительно воспроизводим немного, затем ставим на паузу, чтобы получить длительность в некоторых браузерах
        const tryPlay = () => {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        // Аудио начало воспроизводиться
                        setTimeout(() => {
                            audio.pause();
                            // Проверяем длительность еще раз после воспроизведения
                            loadDuration();
                        }, 100);
                    })
                    .catch(error => {
                        console.log("Player: Auto-play failed:", error);
                    });
            }
        };

        // Пробуем воспроизвести после короткой задержки, если у нас нет длительности
        setTimeout(() => {
            if (!audioDuration && audio.duration === Infinity) {
                console.log("Player: Trying to play to get duration...");
                tryPlay();
            }
        }, 500);

        return () => {
            audio.onloadedmetadata = null;
            audio.onloadeddata = null;
            audio.ondurationchange = null;
            audio.onerror = null;
            audio.pause();
            audio.src = '';
        };
    }, [audioUrl, onDurationChange, audioDuration]);

    // Обновляем ссылку при изменении параметра
    useEffect(() => {
        currentTimeRef.current = safeCurrentTime;
        setDisplayTime(safeCurrentTime);
    }, [safeCurrentTime]);

    // Форматируем время в MM:SS.ms
    const formatTime = (timeInSeconds) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${milliseconds.toString().padStart(3, '0')}`;
    };

    // Обрабатываем изменение ползунка времени
    const handleTimeChange = (_, newValue) => {
        if (audioRef.current) {
            audioRef.current.currentTime = newValue;
        }
        onTimeUpdate(newValue);
    };

    // Обрабатываем прямой ввод времени с точностью до миллисекунд
    const handleTimeInputChange = (newTimeString) => {
        try {
            // Разбираем строку времени в формате MM:SS.mmm
            const parts = newTimeString.split(':');
            if (parts.length !== 2) return;

            const minutes = parseInt(parts[0], 10);
            const secondsParts = parts[1].split('.');
            const seconds = parseInt(secondsParts[0], 10);
            const milliseconds = secondsParts.length > 1 ? parseInt(secondsParts[1].slice(0, 3).padEnd(3, '0'), 10) : 0;

            if (isNaN(minutes) || isNaN(seconds) || isNaN(milliseconds)) return;

            const newTime = minutes * 60 + seconds + milliseconds / 1000;
            if (newTime < 0 || newTime > safeDuration) return;

            if (audioRef.current) {
                audioRef.current.currentTime = newTime;
            }
            onTimeUpdate(newTime);
        } catch (error) {
            console.error("Invalid time format", error);
        }
    };

    // Обрабатываем изменение громкости
    const handleVolumeChange = (_, newValue) => {
        setVolume(newValue);
        if (audioRef.current) {
            audioRef.current.volume = newValue / 100;
        }
        if (newValue === 0) {
            setIsMuted(true);
        } else {
            setIsMuted(false);
        }
    };

    // Переключаем отключение звука
    const handleMuteToggle = () => {
        if (audioRef.current) {
            if (isMuted) {
                audioRef.current.volume = volume / 100;
            } else {
                audioRef.current.volume = 0;
            }
            setIsMuted(!isMuted);
        }
    };

    // Skip backward 5 seconds
    const handleSkipBackward = () => {
        const newTime = Math.max(0, safeCurrentTime - 5);
        onTimeUpdate(newTime);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    // Skip forward 5 seconds
    const handleSkipForward = () => {
        const newTime = Math.min(safeDuration, safeCurrentTime + 5);
        onTimeUpdate(newTime);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    // Millisecond precision controls
    const handleMillisecondStep = (direction) => {
        // Уменьшаем шаг для сверхточного контроля
        const step = 0.001; // 1ms шаг для максимально точного позиционирования
        const newTime = Math.max(0, Math.min(safeDuration, safeCurrentTime + (direction * step)));

        // Обновляем как отображение, так и внутреннее состояние
        setDisplayTime(newTime);
        currentTimeRef.current = newTime;

        // Обновляем внешнее состояние
        onTimeUpdate(newTime);

        // Синхронизируем с аудио если есть
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    // Animation timer function - used when no audio is available
    const animateTime = useCallback((timestamp) => {
        if (!lastTimeRef.current) {
            lastTimeRef.current = timestamp;
        }

        const elapsed = timestamp - lastTimeRef.current;

        // Обновление времени с высокой частотой (~120fps) для сверхплавной анимации
        if (elapsed > 8) { // примерно 120fps для максимальной плавности
            // Рассчитываем точное приращение времени на основе фактического времени
            const deltaTime = elapsed / 1000;
            const newTime = Math.min(currentTimeRef.current + deltaTime, safeDuration);

            // Сохраняем текущее время для следующего кадра
            currentTimeRef.current = newTime;

            // Обновляем время локально и передаем каждый кадр наверх для плавной анимации
            setDisplayTime(newTime);
            onTimeUpdate(newTime);

            // Reset if we reach the end
            if (newTime >= safeDuration) {
                onPlayPause(false);
                onTimeUpdate(0);
                setDisplayTime(0);
                currentTimeRef.current = 0;
            }

            lastTimeRef.current = timestamp;
        }

        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animateTime);
        }
    }, [safeDuration, isPlaying, onPlayPause, onTimeUpdate]);

    // Millsecond display update (separate from the main animation)
    useEffect(() => {
        let frameId;
        let lastTimestamp = 0;

        // Функция для высокочастотного обновления времени для плавной анимации
        const updateHighPrecisionTime = (timestamp) => {
            if (isPlaying && audioRef.current) {
                // Ограничиваем частоту до ~120fps для максимальной плавности
                if (timestamp - lastTimestamp > 8 || lastTimestamp === 0) {
                    // Получаем точное время из аудио
                    const preciseTime = audioRef.current.currentTime;

                    // Обновляем локальное отображение
                    setDisplayTime(preciseTime);

                    // Важно: передаем каждое обновление времени наверх для плавной анимации объектов
                    // Это обеспечит промежуточные кадры между ключевыми точками
                    onTimeUpdate(preciseTime);

                    lastTimestamp = timestamp;
                }
            }
            frameId = requestAnimationFrame(updateHighPrecisionTime);
        };

        // Запускаем только если воспроизводится аудио
        if (isPlaying && audioRef.current) {
            frameId = requestAnimationFrame(updateHighPrecisionTime);
        }

        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [isPlaying, onTimeUpdate]);

    // Setup and cleanup animation frame (only when no audio present)
    useEffect(() => {
        // Handle animation when no audio is present
        if (!audioUrl && isPlaying) {
            lastTimeRef.current = null;
            animationRef.current = requestAnimationFrame(animateTime);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isPlaying, audioUrl, animateTime]);

    // Sync audio with player
    useEffect(() => {
        if (audioRef.current && audioUrl) {
            if (isPlaying) {
                audioRef.current.play().catch(error => {
                    console.error('Audio playback error:', error);
                    // If audio can't play, still allow animation to continue
                    onPlayPause(true);
                });
            } else {
                audioRef.current.pause();
            }

            // Get duration from audio element
            if (audioRef.current.duration && !isNaN(audioRef.current.duration) &&
                audioRef.current.duration !== Infinity && audioRef.current.duration > 0) {
                const newDuration = Math.ceil(audioRef.current.duration);
                if (newDuration !== audioDuration) {
                    console.log('Player: Found duration from audioRef:', newDuration);
                    setAudioDuration(newDuration);

                    // Notify parent component
                    if (onDurationChange) {
                        onDurationChange(newDuration);
                    }
                }
            }
        }
    }, [isPlaying, audioUrl, onPlayPause, audioDuration, onDurationChange]);

    // Sync audio time with player time
    useEffect(() => {
        if (audioRef.current && audioUrl && Math.abs(audioRef.current.currentTime - safeCurrentTime) > 0.5) {
            audioRef.current.currentTime = safeCurrentTime;
        }
    }, [safeCurrentTime, audioUrl]);

    // Determine if we have any media to show buttons for
    const hasMedia = true; // Always show media controls section, regardless of media presence

    return (
        <Paper elevation={0} sx={{
            width: '100%',
            p: 2.5,
            pt: 2,
            backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(26, 32, 46, 0.9)'  // Lighter, more neutral dark blue
                : 'rgba(240, 245, 255, 0.9)', // Very light blue-gray in light mode
            borderRadius: 3,
            backdropFilter: 'blur(12px)',
            boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.2)'
                : '0 8px 32px rgba(0, 0, 0, 0.06)',
            border: `1px solid ${theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(30, 144, 255, 0.15)'}`,
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Audio element */}
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onTimeUpdate={(e) => {
                        // Не отправляем обновления из аудио-события,
                        // так как это уже делается через requestAnimationFrame
                        // Это предотвращает конфликтующие обновления
                    }}
                    onEnded={() => onPlayPause(false)}
                    onDurationChange={(e) => {
                        if (audioRef.current && audioRef.current.duration &&
                            !isNaN(audioRef.current.duration) &&
                            audioRef.current.duration !== Infinity) {
                            const newDuration = Math.ceil(audioRef.current.duration);
                            console.log('Player: Audio element duration changed:', newDuration);
                            setAudioDuration(newDuration);

                            // Notify parent component
                            if (onDurationChange) {
                                onDurationChange(newDuration);
                            }
                        }
                    }}
                />
            )}

            {/* Gradient decoration */}
            <Box
                sx={{
                    position: 'absolute',
                    width: '100%',
                    height: '3px',
                    top: 0,
                    left: 0,
                    background: `linear-gradient(to right, ${PALETTE.secondary.main}, ${PALETTE.tertiary.main})`,
                    opacity: 0.8
                }}
            />

            {/* Time bar */}
            <Box sx={{ width: '100%', mb: 1 }}>
                <Slider
                    value={displayTime}
                    min={0}
                    max={safeDuration}
                    onChange={handleTimeChange}
                    step={0.0001}
                    disableSwap
                    disableTooltip={isPlaying}
                    sx={{
                        color: theme.palette.mode === 'dark'
                            ? PALETTE.primary.light
                            : PALETTE.primary.main,
                        height: 4,
                        '& .MuiSlider-thumb': {
                            width: 12,
                            height: 12,
                            transition: isPlaying ? 'none' : '0.15s cubic-bezier(.47,1.64,.41,.8)',
                            '&:hover, &.Mui-focusVisible': {
                                boxShadow: `0px 0px 0px 8px ${theme.palette.mode === 'dark'
                                    ? alpha(PALETTE.primary.main, 0.16)
                                    : alpha(PALETTE.primary.main, 0.16)}`
                            },
                            willChange: 'transform',
                            transform: 'translateZ(0)'
                        },
                        '& .MuiSlider-rail': {
                            opacity: 0.28
                        },
                        '& .MuiSlider-track': {
                            transition: isPlaying ? 'none' : 'width 0.15s',
                            willChange: 'width',
                            transform: 'translateZ(0)'
                        }
                    }}
                />
            </Box>

            {/* Controls */}
            <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    {/* Playback controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="Назад 5 секунд">
                            <IconButton
                                onClick={handleSkipBackward}
                                size="small"
                                sx={{
                                    color: theme.palette.mode === 'dark'
                                        ? PALETTE.purpleGrey.light
                                        : PALETTE.purpleGrey.main,
                                }}
                            >
                                <SkipPrevious />
                            </IconButton>
                        </Tooltip>

                        <IconButton
                            onClick={() => onPlayPause(!isPlaying)}
                            sx={{
                                color: 'white',
                                bgcolor: theme.palette.mode === 'dark'
                                    ? PALETTE.primary.main
                                    : PALETTE.primary.main,
                                '&:hover': {
                                    bgcolor: theme.palette.mode === 'dark'
                                        ? PALETTE.primary.dark
                                        : PALETTE.primary.dark,
                                },
                                transition: 'all 0.2s',
                                width: 40,
                                height: 40
                            }}
                        >
                            {isPlaying ? <Pause /> : <PlayArrow />}
                        </IconButton>

                        <Tooltip title="Вперед 5 секунд">
                            <IconButton
                                onClick={handleSkipForward}
                                size="small"
                                sx={{
                                    color: theme.palette.mode === 'dark'
                                        ? PALETTE.purpleGrey.light
                                        : PALETTE.purpleGrey.main,
                                }}
                            >
                                <SkipNext />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {/* Time display */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1.5,
                        bgcolor: theme.palette.mode === 'dark'
                            ? alpha(PALETTE.purpleGrey.dark, 0.3)
                            : alpha(PALETTE.purpleGrey.light, 0.2),
                    }}>
                        <Tooltip title="Нажмите, чтобы ввести точное время с миллисекундами">
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                }}
                                onClick={(e) => {
                                    const currentTimeStr = formatTime(displayTime);
                                    const newTime = prompt("Введите время в формате MM:SS.mmm", currentTimeStr);
                                    if (newTime) {
                                        handleTimeInputChange(newTime);
                                    }
                                }}
                            >
                                <Typography variant="body2" sx={{
                                    color: theme.palette.mode === 'dark'
                                        ? alpha(PALETTE.teal.light, 0.9)
                                        : PALETTE.teal.dark,
                                    fontWeight: 600,
                                    fontFamily: 'monospace'
                                }}>
                                    {formatTime(displayTime)}
                                </Typography>
                                <Typography variant="body2" sx={{
                                    color: theme.palette.text.secondary,
                                    opacity: 0.6
                                }}>
                                    /
                                </Typography>
                                <Typography variant="body2" sx={{
                                    color: theme.palette.text.secondary,
                                    fontWeight: 500,
                                    opacity: 0.7,
                                    fontFamily: 'monospace'
                                }}>
                                    {formatTime(safeDuration)}
                                </Typography>
                            </Box>
                        </Tooltip>
                    </Box>

                    {/* Millisecond step controls */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        ml: 1,
                    }}>
                        <Tooltip title="Назад на 10мс">
                            <IconButton
                                onClick={() => handleMillisecondStep(-1)}
                                size="small"
                                sx={{
                                    color: theme.palette.mode === 'dark'
                                        ? PALETTE.teal.light
                                        : PALETTE.teal.dark,
                                    padding: '2px',
                                }}
                            >
                                <KeyboardArrowLeft fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Вперед на 10мс">
                            <IconButton
                                onClick={() => handleMillisecondStep(1)}
                                size="small"
                                sx={{
                                    color: theme.palette.mode === 'dark'
                                        ? PALETTE.teal.light
                                        : PALETTE.teal.dark,
                                    padding: '2px',
                                }}
                            >
                                <KeyboardArrowRight fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                    {/* Keyframe recording toggle */}
                    {toggleKeyframeRecording && (
                        <Tooltip title={keyframeRecording ? "Остановить запись кадров" : "Начать запись кадров"}>
                            <IconButton
                                onClick={toggleKeyframeRecording}
                                sx={{
                                    color: 'white',
                                    bgcolor: keyframeRecording
                                        ? PALETTE.tertiary.main
                                        : alpha(PALETTE.purpleGrey.main, 0.7),
                                    '&:hover': {
                                        bgcolor: keyframeRecording
                                            ? PALETTE.tertiary.dark
                                            : PALETTE.purpleGrey.main,
                                    },
                                    transition: 'all 0.2s',
                                    transform: keyframeRecording ? 'scale(1.1)' : 'scale(1)',
                                    boxShadow: keyframeRecording
                                        ? `0 0 10px ${alpha(PALETTE.tertiary.main, 0.6)}`
                                        : 'none'
                                }}
                            >
                                <FiberManualRecord sx={{
                                    fontSize: keyframeRecording ? 16 : 14
                                }} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Volume controls */}
                    {audioUrl && !readOnly && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <IconButton
                                onClick={handleMuteToggle}
                                size="small"
                                sx={{
                                    color: theme.palette.text.secondary
                                }}
                            >
                                {isMuted ? <VolumeOff /> : <VolumeUp />}
                            </IconButton>

                            <Slider
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                min={0}
                                max={100}
                                size="small"
                                sx={{
                                    ml: 1,
                                    width: 80,
                                    color: theme.palette.mode === 'dark'
                                        ? PALETTE.teal.main
                                        : PALETTE.teal.main,
                                    '& .MuiSlider-rail': {
                                        opacity: 0.28
                                    }
                                }}
                            />
                        </Box>
                    )}
                </Stack>
            </Stack>

            {/* Media file indicators with delete buttons - now positioned below controls instead of absolute */}
            {hasMedia && (
                <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    mt: 2.5,
                    pt: 1.5,
                    borderTop: `1px solid ${theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)'}`
                }}>
                    {/* Audio file indicator */}
                    {onRemoveAudio && (
                        <Chip
                            icon={<AudioFile fontSize="small" />}
                            label="Аудио"
                            color="info"
                            onDelete={audioUrl ? onRemoveAudio : undefined}
                            deleteIcon={<DeleteIcon />}
                            variant="outlined"
                            disabled={!audioUrl}
                            sx={{
                                borderRadius: '16px',
                                px: 0.5,
                                opacity: audioUrl ? 1 : 0.6,
                                '& .MuiChip-icon': {
                                    color: audioUrl ? theme.palette.info.main : theme.palette.action.disabled
                                },
                                '& .MuiChip-deleteIcon': {
                                    color: audioUrl ? theme.palette.error.main : theme.palette.action.disabled,
                                    '&:hover': {
                                        color: audioUrl ? theme.palette.error.dark : theme.palette.action.disabled
                                    }
                                },
                                '& .MuiChip-label': {
                                    fontWeight: 500,
                                    color: audioUrl ? 'inherit' : theme.palette.text.disabled
                                }
                            }}
                        />
                    )}

                    {/* Video file indicator */}
                    {onRemoveVideo && (
                        <Chip
                            icon={<Videocam fontSize="small" />}
                            label="Видео"
                            color="success"
                            onDelete={videoUrl ? onRemoveVideo : undefined}
                            deleteIcon={<DeleteIcon />}
                            variant="outlined"
                            disabled={!videoUrl}
                            sx={{
                                borderRadius: '16px',
                                px: 0.5,
                                opacity: videoUrl ? 1 : 0.6,
                                '& .MuiChip-icon': {
                                    color: videoUrl ? theme.palette.success.main : theme.palette.action.disabled
                                },
                                '& .MuiChip-deleteIcon': {
                                    color: videoUrl ? theme.palette.error.main : theme.palette.action.disabled,
                                    '&:hover': {
                                        color: videoUrl ? theme.palette.error.dark : theme.palette.action.disabled
                                    }
                                },
                                '& .MuiChip-label': {
                                    fontWeight: 500,
                                    color: videoUrl ? 'inherit' : theme.palette.text.disabled
                                }
                            }}
                        />
                    )}
                </Box>
            )}

            {process.env.NODE_ENV !== 'production' && (
                <Box sx={{ fontSize: '10px', color: 'gray', textAlign: 'center', mt: 1 }}>
                    Original Duration: {duration}s | Audio Duration: {audioDuration || 'Not loaded'}s | Effective Duration: {safeDuration}s
                </Box>
            )}
        </Paper>
    );
};

export default Player; 