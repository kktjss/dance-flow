import React, { useState, useRef, useEffect } from 'react';
import { Box, Grid, Paper, IconButton, Typography, Slider } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import './ChoreographyConstructor.css';

const ChoreographyConstructor = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [selectedTemplate, setSelectedTemplate] = useState('circle');
    const [currentFrame, setCurrentFrame] = useState(0);
    const [frames, setFrames] = useState([]);

    const audioRef = useRef(null);
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    // Инициализация канваса
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Установка размеров канваса
        canvas.width = 800;
        canvas.height = 600;

        // Очистка канваса
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Отрисовка сетки
        drawGrid(ctx);

        // Отрисовка текущего кадра
        if (frames[currentFrame]) {
            drawFrame(ctx, frames[currentFrame]);
        }
    }, [currentFrame, frames]);

    // Отрисовка сетки
    const drawGrid = (ctx) => {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;

        // Вертикальные линии
        for (let x = 0; x <= 800; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 600);
            ctx.stroke();
        }

        // Горизонтальные линии
        for (let y = 0; y <= 600; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(800, y);
            ctx.stroke();
        }
    };

    // Отрисовка кадра
    const drawFrame = (ctx, frame) => {
        frame.dancers.forEach(dancer => {
            ctx.beginPath();
            ctx.arc(dancer.x, dancer.y, 20, 0, Math.PI * 2);
            ctx.fillStyle = dancer.color;
            ctx.fill();
            ctx.stroke();
        });
    };

    // Обработка воспроизведения музыки
    const handlePlayPause = () => {
        if (isPlaying) {
            audioRef.current.pause();
            cancelAnimationFrame(animationRef.current);
        } else {
            audioRef.current.play();
            startAnimation();
        }
        setIsPlaying(!isPlaying);
    };

    // Запуск анимации
    const startAnimation = () => {
        const animate = () => {
            if (isPlaying) {
                setCurrentTime(audioRef.current.currentTime);
                setCurrentFrame(Math.floor(audioRef.current.currentTime * 30)); // 30 fps
                animationRef.current = requestAnimationFrame(animate);
            }
        };
        animate();
    };

    // Обработка изменения времени
    const handleTimeChange = (event, newValue) => {
        setCurrentTime(newValue);
        audioRef.current.currentTime = newValue;
        setCurrentFrame(Math.floor(newValue * 30));
    };

    // Создание нового кадра
    const createNewFrame = () => {
        const newFrame = {
            dancers: [
                { x: 400, y: 300, color: '#ff0000' },
                { x: 450, y: 300, color: '#00ff00' },
                { x: 500, y: 300, color: '#0000ff' }
            ]
        };
        setFrames([...frames, newFrame]);
    };

    return (
        <Box className="constructor-container">
            <Grid container spacing={2}>
                {/* Панель инструментов */}
                <Grid item xs={12}>
                    <Paper className="toolbar">
                        <IconButton onClick={createNewFrame}>
                            <SkipPreviousIcon />
                        </IconButton>
                        <IconButton onClick={handlePlayPause}>
                            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                        </IconButton>
                        <IconButton>
                            <SkipNextIcon />
                        </IconButton>
                        <Typography variant="body2" className="time-display">
                            {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}
                        </Typography>
                        <Slider
                            value={currentTime}
                            max={duration}
                            onChange={handleTimeChange}
                            className="time-slider"
                        />
                    </Paper>
                </Grid>

                {/* Основная область конструктора */}
                <Grid item xs={9}>
                    <Paper className="canvas-container">
                        <canvas ref={canvasRef} className="choreography-canvas" />
                    </Paper>
                </Grid>

                {/* Панель свойств */}
                <Grid item xs={3}>
                    <Paper className="properties-panel">
                        <Typography variant="h6">Свойства</Typography>
                        <Box className="template-selector">
                            <Typography variant="subtitle1">Шаблон:</Typography>
                            <select
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                            >
                                <option value="circle">Круг</option>
                                <option value="line">Линия</option>
                                <option value="triangle">Треугольник</option>
                            </select>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Аудио элемент */}
            <audio
                ref={audioRef}
                src="/path/to/your/music.mp3"
                onLoadedMetadata={() => setDuration(audioRef.current.duration)}
                onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
            />
        </Box>
    );
};

export default ChoreographyConstructor; 