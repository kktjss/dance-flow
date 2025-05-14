import React, { useState, useEffect } from 'react';
import { Box as MuiBox, Typography, Button, IconButton, Tooltip, Paper, Alert } from '@mui/material';
import { ThreeDRotation, Videocam, Close } from '@mui/icons-material';
import ModelViewer from './ModelViewer';
import VideoViewer from './VideoViewer';

// ВРЕМЕННО: Весь компонент CombinedViewer является временным и будет удален позже
const CombinedViewer = ({
    isVisible,
    onClose,
    videoUrl,
    playerDuration,
    currentTime,
    isPlaying,
    onTimeUpdate,
    elementKeyframes = [],
    elementId = null,
    onSaveAnimations = null,
    glbAnimations = [], // Add support for GLB animations
    embedded = false // Add support for embedded mode
}) => {
    const [activeView, setActiveView] = useState('3d'); // '3d' или 'video'
    const [selectedGlbAnimation, setSelectedGlbAnimation] = useState(null);

    // Проверяем наличие видео при монтировании компонента и изменении активного вида
    useEffect(() => {
        console.log('CombinedViewer: videoUrl =', videoUrl);
        console.log('CombinedViewer: activeView =', activeView);
        console.log('CombinedViewer: glbAnimations =', glbAnimations);
        console.log('CombinedViewer: embedded =', embedded);

        // Подробный лог для каждой GLB-анимации
        if (glbAnimations && glbAnimations.length > 0) {
            console.log(`CombinedViewer: Found ${glbAnimations.length} GLB animations:`);
            glbAnimations.forEach((anim, index) => {
                console.log(`  Animation ${index + 1}: id=${anim.id}, name=${anim.name}, url=${anim.url}`);
            });
        } else {
            console.log('CombinedViewer: No GLB animations available');
        }
    }, [videoUrl, activeView, glbAnimations, embedded]);

    // Выбираем первую GLB анимацию, если она доступна и еще не выбрана
    useEffect(() => {
        if (glbAnimations && glbAnimations.length > 0 && !selectedGlbAnimation) {
            // Проверяем URL первой анимации
            const firstAnimation = glbAnimations[0];
            console.log('CombinedViewer: First animation URL check:', {
                url: firstAnimation.url,
                valid: Boolean(firstAnimation.url),
                type: typeof firstAnimation.url
            });

            setSelectedGlbAnimation(firstAnimation);
            console.log('CombinedViewer: Auto-selected first GLB animation:', firstAnimation);
        }
    }, [glbAnimations, selectedGlbAnimation]);

    // Переключаем на 3D вид, если видео отсутствует и пользователь пытается переключиться на видео
    useEffect(() => {
        if (activeView === 'video' && !videoUrl) {
            console.log('CombinedViewer: No video URL available, switching back to 3D view');
            setActiveView('3d');
        }
    }, [activeView, videoUrl]);

    // Отключаем кнопку видео, если его нет
    const isVideoAvailable = Boolean(videoUrl);

    // Обработчик сохранения анимаций
    const handleSaveAnimations = (animations) => {
        if (onSaveAnimations) {
            onSaveAnimations(animations, elementId);
        }
    };

    // Обработчик выбора GLB анимации
    const handleGlbAnimationSelect = (animation) => {
        setSelectedGlbAnimation(animation);
        console.log('CombinedViewer: Selected GLB animation:', animation);
    };

    // Эффект для логирования выбранной анимации и URL, передаваемого в ModelViewer
    useEffect(() => {
        if (selectedGlbAnimation) {
            console.log('CombinedViewer: Current selected animation:', selectedGlbAnimation);
            console.log('CombinedViewer: URL to pass to ModelViewer:', selectedGlbAnimation.url);
        }
    }, [selectedGlbAnimation]);

    if (!isVisible) return null;

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
                p: embedded ? 0 : 3
            }}
        >
            {/* Контейнер для контента в виде "коробочки" */}
            <Paper
                elevation={embedded ? 0 : 8}
                sx={{
                    width: embedded ? '100%' : '90%',
                    height: embedded ? '100%' : '85%',
                    position: 'relative',
                    borderRadius: embedded ? 0 : 2,
                    overflow: 'hidden',
                    backgroundColor: '#1a1a1a',
                    display: 'flex',
                    flexDirection: 'column',
                    overscrollBehavior: 'contain',
                    touchAction: 'pan-y',
                    '& *': {
                        overscrollBehavior: 'contain'
                    }
                }}
            >
                {/* Кнопки в верхних углах */}
                <MuiBox
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        p: 2,
                        zIndex: 10
                    }}
                >
                    {/* Кнопка слева */}
                    <Button
                        variant="contained"
                        startIcon={<ThreeDRotation />}
                        onClick={() => setActiveView('3d')}
                        color={activeView === '3d' ? 'primary' : 'inherit'}
                        sx={{
                            backgroundColor: activeView === '3d' ? 'primary.main' : 'rgba(255, 255, 255, 0.15)',
                            color: 'white',
                            '&:hover': {
                                backgroundColor: activeView === '3d' ? 'primary.dark' : 'rgba(255, 255, 255, 0.25)',
                            }
                        }}
                    >
                        Посмотреть 3D анимацию
                    </Button>

                    {/* Кнопка справа - отображается только если есть видео или с отключенным состоянием */}
                    <Button
                        variant="contained"
                        startIcon={<Videocam />}
                        onClick={() => isVideoAvailable && setActiveView('video')}
                        color={activeView === 'video' ? 'primary' : 'inherit'}
                        sx={{
                            backgroundColor: activeView === 'video' ? 'primary.main' : 'rgba(255, 255, 255, 0.15)',
                            color: isVideoAvailable ? 'white' : 'rgba(255, 255, 255, 0.5)',
                            '&:hover': {
                                backgroundColor: isVideoAvailable ?
                                    (activeView === 'video' ? 'primary.dark' : 'rgba(255, 255, 255, 0.25)') :
                                    'rgba(255, 255, 255, 0.15)',
                            },
                            cursor: isVideoAvailable ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {isVideoAvailable ? 'Посмотреть видео' : 'Видео не загружено'}
                    </Button>
                </MuiBox>

                {/* Выбор GLB анимации, если они доступны */}
                {glbAnimations && glbAnimations.length > 0 && activeView === '3d' && (
                    <MuiBox
                        sx={{
                            position: 'absolute',
                            top: 60,
                            left: 0,
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            p: 1,
                            zIndex: 10,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        <Typography variant="body2" sx={{ color: 'white', mr: 2, alignSelf: 'center' }}>
                            Выберите анимацию:
                        </Typography>
                        {glbAnimations.map((anim) => (
                            <Button
                                key={anim.id}
                                variant={selectedGlbAnimation && selectedGlbAnimation.id === anim.id ? "contained" : "outlined"}
                                size="small"
                                onClick={() => handleGlbAnimationSelect(anim)}
                                sx={{ mr: 1 }}
                            >
                                {anim.name}
                            </Button>
                        ))}
                    </MuiBox>
                )}

                {/* Контейнер для 3D модели */}
                <MuiBox
                    sx={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        display: activeView === '3d' ? 'block' : 'none',
                        mt: glbAnimations && glbAnimations.length > 0 ? 10 : 5, // Увеличиваем отступ, если есть выбор анимаций
                        overflow: 'hidden',
                        overscrollBehavior: 'contain' // Предотвращает прокрутку родительского элемента
                    }}
                >
                    <ModelViewer
                        isVisible={activeView === '3d'}
                        onClose={() => { }}
                        playerDuration={playerDuration}
                        currentTime={currentTime}
                        isPlaying={isPlaying}
                        onTimeUpdate={onTimeUpdate}
                        elementKeyframes={elementKeyframes}
                        elementId={elementId}
                        embedded={true}
                        onSaveAnimations={handleSaveAnimations}
                        glbAnimationUrl={selectedGlbAnimation && selectedGlbAnimation.url ? selectedGlbAnimation.url : null}
                    />
                </MuiBox>

                {/* Контейнер для видео - всегда показываем VideoViewer */}
                <MuiBox
                    sx={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        display: activeView === 'video' ? 'block' : 'none',
                        mt: 5, // Добавляем отступ сверху, чтобы не перекрывать кнопки
                        overflow: 'hidden',
                        overscrollBehavior: 'contain' // Предотвращает прокрутку родительского элемента
                    }}
                >
                    <VideoViewer
                        isVisible={activeView === 'video'}
                        onClose={() => { }}
                        videoUrl={videoUrl}
                        embedded={true}
                    />
                </MuiBox>
            </Paper>

            {/* Кнопка закрытия - только если не в режиме embedded */}
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

export default CombinedViewer; 