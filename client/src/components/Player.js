import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, IconButton, Slider, Typography } from '@mui/material';
import { PlayArrow, Pause, VolumeUp, VolumeOff } from '@mui/icons-material';

const Player = ({ audioUrl, duration = 60, currentTime = 0, onTimeUpdate, isPlaying, onPlayPause, readOnly = false }) => {
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
        <Box sx={{ width: '100%', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onTimeUpdate={() => onTimeUpdate(audioRef.current?.currentTime || 0)}
                    onEnded={() => onPlayPause(false)}
                />
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <IconButton
                    onClick={() => onPlayPause(!isPlaying)}
                    color="primary"
                >
                    {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>

                <Typography variant="body2" sx={{ ml: 1, minWidth: 40 }}>
                    {formatTime(safeCurrentTime)}
                </Typography>

                <Slider
                    value={safeCurrentTime}
                    min={0}
                    max={safeDuration}
                    onChange={handleTimeChange}
                    sx={{ mx: 2, flexGrow: 1 }}
                />

                <Typography variant="body2" sx={{ minWidth: 40 }}>
                    {formatTime(safeDuration)}
                </Typography>

                {audioUrl && !readOnly && (
                    <>
                        <IconButton onClick={handleMuteToggle}>
                            {isMuted ? <VolumeOff /> : <VolumeUp />}
                        </IconButton>

                        <Slider
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            min={0}
                            max={100}
                            sx={{ ml: 1, width: 100 }}
                        />
                    </>
                )}
            </Box>
        </Box>
    );
};

export default Player; 