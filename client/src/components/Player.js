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
    Tooltip
} from '@mui/material';
import {
    PlayArrow,
    Pause,
    VolumeUp,
    VolumeOff,
    SkipNext,
    SkipPrevious,
    FiberManualRecord
} from '@mui/icons-material';

// Color palette - same as in ToolPanel for consistency
const PALETTE = {
    primary: {
        light: '#9C6AFF',
        main: '#6A3AFF', // Main purple
        dark: '#4316DB'
    },
    secondary: {
        light: '#FF8F73',
        main: '#FF6B52', // Bright orange
        dark: '#E54B30'
    },
    tertiary: {
        light: '#FF7EB3',
        main: '#FF5C93', // Pink
        dark: '#DB3671'
    },
    teal: {
        light: '#7DEEFF',
        main: '#33D2FF', // Light blue
        dark: '#00A0CC'
    },
    green: {
        light: '#7CFFCB',
        main: '#33E2A0', // Soft green
        dark: '#00B371'
    },
    purpleGrey: {
        light: '#B7A6FF',
        main: '#8678B2', // Grey-purple
        dark: '#5D5080'
    }
};

const Player = ({ audioUrl, duration = 60, currentTime = 0, onTimeUpdate, isPlaying, onPlayPause, readOnly = false, keyframeRecording = false, toggleKeyframeRecording = null }) => {
    const theme = useTheme();
    const [volume, setVolume] = useState(80);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef(null);
    const animationRef = useRef(null);
    const lastTimeRef = useRef(null);
    const currentTimeRef = useRef(currentTime);

    // Ensure valid numeric values
    const safeCurrentTime = typeof currentTime === 'number' && !isNaN(currentTime) ? currentTime : 0;
    const safeDuration = typeof duration === 'number' && !isNaN(duration) ? duration : 60;

    // Update ref when prop changes
    useEffect(() => {
        currentTimeRef.current = safeCurrentTime;
    }, [safeCurrentTime]);

    // Format time in MM:SS
    const formatTime = (timeInSeconds) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // Handle time slider change
    const handleTimeChange = (_, newValue) => {
        if (audioRef.current) {
            audioRef.current.currentTime = newValue;
        }
        onTimeUpdate(newValue);
    };

    // Handle volume change
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

    // Toggle mute
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

    // Animation timer function - used when no audio is available
    const animateTime = useCallback((timestamp) => {
        if (!lastTimeRef.current) {
            lastTimeRef.current = timestamp;
        }

        const elapsed = timestamp - lastTimeRef.current;

        // Update time approximately 30 times per second
        if (elapsed > 33) { // ~30fps
            const newTime = Math.min(currentTimeRef.current + elapsed / 1000, safeDuration);
            onTimeUpdate(newTime);

            // Reset if we reach the end
            if (newTime >= safeDuration) {
                onPlayPause(false);
                onTimeUpdate(0);
            }

            lastTimeRef.current = timestamp;
        }

        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animateTime);
        }
    }, [safeDuration, isPlaying, onPlayPause, onTimeUpdate]);

    // Setup and cleanup animation frame
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
        }
    }, [isPlaying, audioUrl, onPlayPause]);

    // Sync audio time with player time
    useEffect(() => {
        if (audioRef.current && audioUrl && Math.abs(audioRef.current.currentTime - safeCurrentTime) > 0.5) {
            audioRef.current.currentTime = safeCurrentTime;
        }
    }, [safeCurrentTime, audioUrl]);

    return (
        <Paper elevation={0} sx={{
            width: '100%',
            p: 2.5,
            pt: 2,
            backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(17, 21, 54, 0.9)'  // Lighter, grayer purple color
                : 'rgba(240, 240, 250, 0.9)', // Very light gray-purple in light mode
            borderRadius: 3,
            backdropFilter: 'blur(12px)',
            boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.3)'
                : '0 8px 32px rgba(0, 0, 0, 0.06)',
            border: `1px solid ${theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(106, 58, 255, 0.05)'}`,
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Audio element */}
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onTimeUpdate={() => onTimeUpdate(audioRef.current?.currentTime || 0)}
                    onEnded={() => onPlayPause(false)}
                />
            )}

            {/* Gradient decoration */}
            <Box
                sx={{
                    position: 'absolute',
                    width: '100%',
                    height: '4px',
                    top: 0,
                    left: 0,
                    background: `linear-gradient(to right, ${PALETTE.primary.main}, ${PALETTE.tertiary.main})`,
                    opacity: 0.8
                }}
            />

            {/* Time bar */}
            <Box sx={{ width: '100%', mb: 1 }}>
                <Slider
                    value={safeCurrentTime}
                    min={0}
                    max={safeDuration}
                    onChange={handleTimeChange}
                    sx={{
                        color: theme.palette.mode === 'dark'
                            ? PALETTE.primary.light
                            : PALETTE.primary.main,
                        height: 4,
                        '& .MuiSlider-thumb': {
                            width: 12,
                            height: 12,
                            transition: '0.2s cubic-bezier(.47,1.64,.41,.8)',
                            '&:hover, &.Mui-focusVisible': {
                                boxShadow: `0px 0px 0px 8px ${theme.palette.mode === 'dark'
                                    ? alpha(PALETTE.primary.main, 0.16)
                                    : alpha(PALETTE.primary.main, 0.16)}`
                            }
                        },
                        '& .MuiSlider-rail': {
                            opacity: 0.28
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
                        <Typography variant="body2" sx={{
                            color: theme.palette.mode === 'dark'
                                ? alpha(PALETTE.teal.light, 0.9)
                                : PALETTE.teal.dark,
                            fontWeight: 600,
                            fontFamily: 'monospace'
                        }}>
                            {formatTime(safeCurrentTime)}
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
        </Paper>
    );
};

export default Player; 