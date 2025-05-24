import React, { useState, useEffect } from 'react';
import { Box as MuiBox, Typography, Button, IconButton, Tooltip, Paper, Alert, Box } from '@mui/material';
import { ThreeDRotation, Videocam, Close, Save } from '@mui/icons-material';
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
    glbAnimations = [], // Поддержка GLB анимаций
    embedded = false, // Add support for embedded mode
    modelUrl = null // Add support for direct model URL
}) => {
    const [activeView, setActiveView] = useState('3d'); // '3d' или 'video'
    const [selectedGlbAnimation, setSelectedGlbAnimation] = useState(null);

    // Log all props received by CombinedViewer
    useEffect(() => {
        console.log('CombinedViewer: Received props:', {
            isVisible,
            elementId,
            hasElementKeyframes: !!(elementKeyframes && elementKeyframes.length > 0),
            elementKeyframesCount: elementKeyframes?.length || 0,
            modelUrl,
            hasModelUrl: !!modelUrl,
            glbAnimationsCount: glbAnimations?.length || 0,
            videoUrl
        });
    }, [isVisible, elementId, elementKeyframes, modelUrl, glbAnimations, videoUrl]);

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

    // Выбираем первую GLB анимацию или используем modelPath из элемента
    useEffect(() => {
        // Подробное логирование для отладки
        console.log('CombinedViewer: Selecting model with params:', {
            elementId,
            hasElementKeyframes: !!(elementKeyframes && elementKeyframes.length > 0),
            glbAnimationsCount: glbAnimations?.length || 0,
            modelUrl: modelUrl // Log the modelUrl prop
        });

        // First check if modelUrl prop is provided
        if (modelUrl) {
            console.log('CombinedViewer: Using provided modelUrl prop:', modelUrl);

            // Format the URL to use the correct path
            let formattedUrl = modelUrl;

            // If it contains '/uploads/models/', change to '/models/'
            if (formattedUrl.includes('/uploads/models/')) {
                const filename = formattedUrl.split('/').pop();
                formattedUrl = `/models/${filename}`;
                console.log('CombinedViewer: Reformatted URL from /uploads/models/ to /models/:', formattedUrl);
            }

            const elementAnimation = {
                id: `direct-model-url`,
                name: 'Модель элемента',
                url: formattedUrl
            };
            setSelectedGlbAnimation(elementAnimation);
            setActiveView('3d');
            return;
        }

        // Continue with original logic
        // Сначала проверяем, есть ли modelPath у выбранного элемента
        if (elementId && elementKeyframes && elementKeyframes.length > 0) {
            const element = elementKeyframes.find(kf => kf.id === elementId || kf.elementId === elementId);
            console.log('CombinedViewer: Looking for element with ID:', elementId, {
                found: !!element,
                hasModelPath: !!element?.modelPath,
                modelPath: element?.modelPath || 'none',
                has3DModel: !!element?.has3DModel
            });

            if (element && (element.modelPath || element.has3DModel)) {
                console.log('CombinedViewer: Found model data in element:', {
                    modelPath: element.modelPath || 'none',
                    has3DModel: !!element.has3DModel
                });

                // Process the model URL to ensure it's correctly formatted
                let modelUrl = element.modelPath;

                // If no modelPath but has3DModel is set, check if we have model info in keyframes
                if (!modelUrl && element.has3DModel && element.keyframes && element.keyframes.length > 0) {
                    console.log('CombinedViewer: Element has has3DModel flag but no modelPath, checking keyframes');
                    // Find first keyframe with modelPath
                    const keyframeWithModel = element.keyframes.find(kf => kf.modelPath);
                    if (keyframeWithModel && keyframeWithModel.modelPath) {
                        console.log('CombinedViewer: Found model path in keyframe:', keyframeWithModel.modelPath);
                        modelUrl = keyframeWithModel.modelPath;
                    }
                }

                // If the URL doesn't start with http, ensure it has the correct prefix
                if (!modelUrl.startsWith('http')) {
                    // Convert /uploads/models/ to /models/ if needed
                    if (modelUrl.startsWith('/uploads/models/')) {
                        const filename = modelUrl.split('/').pop();
                        modelUrl = `/models/${filename}`;
                    } else if (modelUrl.startsWith('uploads/models/')) {
                        const filename = modelUrl.split('/').pop();
                        modelUrl = `/models/${filename}`;
                    }

                    // If it doesn't start with /, add it
                    if (!modelUrl.startsWith('/')) {
                        modelUrl = `/models/${modelUrl.split('/').pop()}`;
                    }

                    // If it's not a full URL, add the origin
                    if (!modelUrl.includes('://')) {
                        modelUrl = `${window.location.origin}${modelUrl}`;
                    }
                }

                console.log('CombinedViewer: Processed model URL:', modelUrl);

                // Создаем объект анимации из modelPath элемента
                const elementAnimation = {
                    id: `element-model-${elementId}`,
                    name: element.modelName || 'Модель элемента',
                    url: modelUrl
                };

                setSelectedGlbAnimation(elementAnimation);
                setActiveView('3d'); // Автоматически переключаемся на 3D вид
                return;
            } else {
                console.log('CombinedViewer: Element does not have a modelPath');
                // Если у элемента нет modelPath, не показываем модель
                setSelectedGlbAnimation(null);
                // Переключаемся на видео, если оно доступно
                if (videoUrl) {
                    console.log('CombinedViewer: Switching to video view because element has no model');
                    setActiveView('video');
                }
                return;
            }
        }

        // Если нет elementId (общий просмотр) и есть glbAnimations, используем первую
        if (!elementId && glbAnimations && glbAnimations.length > 0) {
            // Проверяем URL первой анимации
            const firstAnimation = glbAnimations[0];
            console.log('CombinedViewer: No elementId, using first animation from glbAnimations:', {
                url: firstAnimation.url,
                valid: Boolean(firstAnimation.url),
                type: typeof firstAnimation.url
            });

            setSelectedGlbAnimation(firstAnimation);
            console.log('CombinedViewer: Auto-selected first GLB animation:', firstAnimation);
            setActiveView('3d'); // Автоматически переключаемся на 3D вид
        } else {
            console.log('CombinedViewer: No animations available for the element, not showing 3D model');
            setSelectedGlbAnimation(null);
            // Переключаемся на видео, если оно доступно
            if (videoUrl) {
                console.log('CombinedViewer: Switching to video view because no models are available');
                setActiveView('video');
            }
        }
    }, [glbAnimations, elementId, elementKeyframes, videoUrl, modelUrl]);

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
    const handleSaveAnimations = (data, elemId) => {
        if (onSaveAnimations) {
            // Проверяем формат данных
            if (typeof data === 'object' && data.modelUrl) {
                // Если данные уже содержат modelUrl, просто передаем их дальше
                console.log('CombinedViewer: Forwarding complete model data:', {
                    modelUrl: data.modelUrl,
                    animationsCount: data.animations ? data.animations.length : 0,
                    elementId: elemId || elementId,
                    isLocalFile: data.isLocalFile || false
                });
                onSaveAnimations(data, elemId || elementId);
            } else {
                // Если данные не содержат modelUrl, добавляем URL выбранной анимации
                const modelUrl = selectedGlbAnimation ? selectedGlbAnimation.url : null;
                const animations = Array.isArray(data) ? data : [];

                console.log('CombinedViewer: Selected animation for saving:', selectedGlbAnimation);
                console.log('CombinedViewer: Model URL to save:', modelUrl);

                if (!modelUrl) {
                    console.warn('CombinedViewer: No model URL available for saving!');
                }

                const dataToSave = {
                    animations: animations,
                    modelUrl: modelUrl
                };

                console.log('CombinedViewer: Saving model data with constructed object:', {
                    modelUrl: modelUrl || 'не указан',
                    modelName: selectedGlbAnimation ? selectedGlbAnimation.name : 'не выбрана',
                    animationsCount: animations.length,
                    elementId: elemId || elementId,
                    fullData: JSON.stringify(dataToSave).substring(0, 100) + '...'
                });

                onSaveAnimations(dataToSave, elemId || elementId);
            }
        } else {
            console.error('CombinedViewer: Cannot save - no onSaveAnimations callback provided');
        }
    };

    // Обработчик закрытия просмотрщика
    const handleClose = () => {
        console.log('CombinedViewer: Closing viewer, preparing to save model state');

        // Сохраняем текущие анимации перед закрытием
        if (onSaveAnimations && selectedGlbAnimation) {
            let modelUrl = selectedGlbAnimation ? selectedGlbAnimation.url : null;

            // Process the model URL to ensure it's properly formatted
            if (modelUrl) {
                // Extract the filename from the path
                const filename = modelUrl.split('/').pop();
                console.log('CombinedViewer: Extracted filename on close:', filename);

                // Try using the API endpoint if we have a filename
                if (filename) {
                    modelUrl = `${window.location.origin}/api/models/file/${filename}`;
                    console.log('CombinedViewer: Using API endpoint URL on close:', modelUrl);
                } else if (modelUrl.startsWith('/') && !modelUrl.startsWith('//')) {
                    // URL starts with a single slash - add origin
                    modelUrl = `${window.location.origin}${modelUrl}`;
                    console.log('CombinedViewer: Added origin to URL on close:', modelUrl);
                } else if (modelUrl.startsWith('uploads/')) {
                    // URL starts with 'uploads/' - add slash and origin
                    modelUrl = `${window.location.origin}/${modelUrl}`;
                    console.log('CombinedViewer: Added slash and origin to uploads URL on close:', modelUrl);
                } else if (!modelUrl.startsWith('http') && !modelUrl.startsWith('/')) {
                    // URL doesn't start with protocol, blob: or / - consider it relative
                    modelUrl = `${window.location.origin}/${modelUrl}`;
                    console.log('CombinedViewer: Converted to absolute URL on close:', modelUrl);
                }
            }

            console.log('CombinedViewer: Selected model details:', {
                name: selectedGlbAnimation.name,
                url: modelUrl,
                originalUrl: selectedGlbAnimation.url,
            });

            // Создаем объект с анимациями и URL модели
            const dataToSave = {
                animations: glbAnimations || [],
                modelUrl: modelUrl,
                // Explicitly set visibility to true to ensure the object remains visible
                visible: true,
                style: {
                    opacity: 1 // Ensure opacity is set to fully visible
                }
            };

            console.log('CombinedViewer: Saving data on close:', {
                modelUrl: dataToSave.modelUrl || 'не указан',
                modelName: selectedGlbAnimation ? selectedGlbAnimation.name : 'не выбрана',
                animationsCount: glbAnimations ? glbAnimations.length : 0,
                elementId: elementId || 'не указан',
                visible: dataToSave.visible,
                opacity: dataToSave.style.opacity,
                fullData: JSON.stringify(dataToSave).substring(0, 100) + '...'
            });

            // Call the save animations callback
            onSaveAnimations(dataToSave, elementId);
            console.log('CombinedViewer: onSaveAnimations callback executed with elementId:', elementId);
        } else if (!selectedGlbAnimation) {
            console.warn('CombinedViewer: No model selected, nothing to save on close');
        } else if (!onSaveAnimations) {
            console.error('CombinedViewer: Cannot save - no onSaveAnimations callback provided');
        }

        // Вызываем onClose из props
        if (onClose) {
            console.log('CombinedViewer: Calling onClose callback');
            onClose();
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

    // Эффект для проверки наличия локальных файлов моделей при монтировании компонента
    useEffect(() => {
        // Проверяем, есть ли у элемента локальный файл модели
        if (elementId && elementKeyframes && elementKeyframes.length > 0) {
            const element = elementKeyframes.find(el => el.id === elementId);
            if (element && element.isLocalModelFile && element.modelPath && element.modelPath.startsWith('blob:')) {
                // Локальный файл модели не может быть восстановлен после перезагрузки страницы
                console.warn('CombinedViewer: Element has local model file that cannot be restored:', element.modelPath);

                // Показываем уведомление пользователю
                alert('Внимание: Локальный файл 3D модели не может быть восстановлен после перезагрузки страницы. Пожалуйста, загрузите модель снова.');
            }
        }
    }, [elementId, elementKeyframes]);

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
                    width: embedded ? '100%' : '95%',
                    height: embedded ? '100%' : '95%',
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
                {/* Commented out animation selection UI
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
                */}

                {/* Контейнер для 3D модели */}
                <MuiBox
                    sx={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        display: activeView === '3d' ? 'block' : 'none', // Only show when 3d view is active
                        mt: 0, // No top margin needed since buttons are removed
                        overflow: 'hidden',
                        overscrollBehavior: 'contain' // Предотвращает прокрутку родительского элемента
                    }}
                >
                    {/* Enhanced debugging for model URL */}
                    {console.log('CombinedViewer: Direct model URL debugging:', {
                        modelUrl: modelUrl,
                        selectedGlbAnimationUrl: selectedGlbAnimation ? selectedGlbAnimation.url : null,
                        effectiveUrl: selectedGlbAnimation ? selectedGlbAnimation.url : modelUrl,
                        elementId,
                        hasElementKeyframes: !!(elementKeyframes && elementKeyframes.length > 0),
                        origin: window.location.origin
                    })}

                    {/* Add absolute URL model test */}
                    {console.log('CombinedViewer: Absolute URL test:', {
                        rawUrl: modelUrl,
                        absoluteUrl: modelUrl ? `${window.location.origin}${modelUrl.startsWith('/') ? '' : '/'}${modelUrl}` : null
                    })}

                    {/* Create direct working URL */}
                    {(() => {
                        // Get filename from URL or use a default
                        const getFilename = (url) => {
                            if (!url) return null;
                            return url.split('/').pop();
                        };

                        // Get direct model URL
                        const directUrl = (() => {
                            // First try filename from model URL
                            const filename = getFilename(modelUrl) || getFilename(selectedGlbAnimation?.url);

                            // If we have a filename, use it with the correct path
                            if (filename) {
                                return `/models/${filename}`;
                            }

                            // Fallback to known working model
                            return `/api/uploads/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb`;
                        })();

                        console.log('CombinedViewer: Using direct override URL:', directUrl);

                        return null;  // Don't render anything in JSX
                    })()}

                    <ModelViewer
                        isVisible={true} // Always visible
                        onClose={handleClose}
                        playerDuration={playerDuration}
                        currentTime={currentTime}
                        isPlaying={isPlaying}
                        onTimeUpdate={onTimeUpdate}
                        elementKeyframes={elementKeyframes}
                        elementId={elementId}
                        embedded={true}
                        onSaveAnimations={handleSaveAnimations}
                        glbAnimationUrl={(() => {
                            // FIXED: Use the original modelUrl directly without modification
                            // This ensures the server URL structure is preserved

                            // First priority: use the direct model URL if it exists
                            if (modelUrl) {
                                console.log('CombinedViewer: Using original modelUrl directly:', modelUrl);
                                return modelUrl;
                            }

                            // Second priority: use selected animation URL
                            if (selectedGlbAnimation && selectedGlbAnimation.url) {
                                console.log('CombinedViewer: Using selected animation URL:', selectedGlbAnimation.url);
                                return selectedGlbAnimation.url;
                            }

                            // Fallback to default model with correct path for Go server
                            console.log('CombinedViewer: Using fallback model URL with correct server path');
                            return '/api/uploads/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb';
                        })()}
                    />
                </MuiBox>

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
                        onClose={handleClose}
                        videoUrl={videoUrl}
                        embedded={true}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                    />
                </MuiBox>
            </Paper>

            {/* Кнопка закрытия - только если не в режиме embedded */}
            {!embedded && (
                <Box sx={{ mt: 2 }}>
                    {/* Commented out save button
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Save />}
                        onClick={() => {
                            // Сохраняем текущие анимации
                            if (onSaveAnimations) {
                                const dataToSave = {
                                    animations: glbAnimations || [],
                                    modelUrl: selectedGlbAnimation ? selectedGlbAnimation.url : null,
                                    // Explicitly set visibility to true to ensure the object remains visible
                                    visible: true,
                                    style: {
                                        opacity: 1 // Ensure opacity is set to fully visible
                                    }
                                };

                                console.log('CombinedViewer: Saving from save button:', {
                                    modelUrl: dataToSave.modelUrl || 'не указан',
                                    modelName: selectedGlbAnimation ? selectedGlbAnimation.name : 'не выбрана',
                                    animationsCount: glbAnimations ? glbAnimations.length : 0,
                                    elementId: elementId || 'не указан'
                                });

                                onSaveAnimations(dataToSave, elementId);

                                // Показываем уведомление с подробной информацией
                                const modelName = selectedGlbAnimation ? selectedGlbAnimation.name : 'Модель';
                                const animCount = glbAnimations ? glbAnimations.length : 0;
                                const animInfo = animCount > 0 ? ` и ${animCount} анимаций` : '';

                                alert(`${modelName}${animInfo} успешно сохранена!`);
                            } else {
                                console.error('CombinedViewer: Cannot save - no onSaveAnimations callback provided');
                                alert('Ошибка: Невозможно сохранить модель. Обратитесь к разработчику.');
                            }
                        }}
                    >
                        Сохранить
                    </Button>
                    */}
                    <Button
                        variant="outlined"
                        onClick={handleClose}
                    >
                        Закрыть
                    </Button>
                </Box>
            )}
        </MuiBox>
    );
};

export default CombinedViewer; 