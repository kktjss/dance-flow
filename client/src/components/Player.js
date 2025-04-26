import React, { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Slider, Typography } from '@mui/material';
import { PlayArrow, Pause, VolumeUp, VolumeOff } from '@mui/icons-material';

const Player = ({ audioUrl, duration, currentTime, onTimeUpdate, isPlaying, onPlayPause }) => {
    const [volume, setVolume] = useState(80);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef(null);

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

    // Sync audio with player
    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(error => {
                    console.error('Audio playback error:', error);
                });
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying]);

    // Sync audio time with player time
    useEffect(() => {
        if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
            audioRef.current.currentTime = currentTime;
        }
    }, [currentTime]);

    return (
        <Box sx={{ width: '100%', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={() => onTimeUpdate(audioRef.current?.currentTime || 0)}
                onEnded={() => onPlayPause(false)}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <IconButton
                    onClick={() => onPlayPause(!isPlaying)}
                    color="primary"
                >
                    {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>

                <Typography variant="body2" sx={{ ml: 1, minWidth: 40 }}>
                    {formatTime(currentTime)}
                </Typography>

                <Slider
                    value={currentTime}
                    min={0}
                    max={duration}
                    onChange={handleTimeChange}
                    sx={{ mx: 2, flexGrow: 1 }}
                />

                <Typography variant="body2" sx={{ minWidth: 40 }}>
                    {formatTime(duration)}
                </Typography>

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
            </Box>
        </Box>
    );
};

export default Player; 