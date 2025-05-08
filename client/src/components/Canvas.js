import React, { useEffect, useRef, useState, useCallback, createRef } from 'react';
import { fabric } from 'fabric';
import { Box, IconButton, Modal, Typography, Grid, Button } from '@mui/material';
import { ContentCopy, Delete, Visibility, ThreeDRotation, Videocam } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import ReactDOM from 'react-dom';
import ModelViewer from './ModelViewer';
import VideoViewer from './VideoViewer';

// Выносим canvas полностью за пределы React-дерева
const fabricInstances = new Map();

const Canvas = ({ elements, currentTime, isPlaying, onElementsChange, selectedElement, onElementSelect, readOnly = false }) => {
    const containerRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const canvasId = useRef(`canvas-${uuidv4()}`);
    const [isRecordingKeyframe, setIsRecordingKeyframe] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const buttonContainerRef = useRef(null);
    const [showChoreoModal, setShowChoreoModal] = useState(false);
    const [viewMode, setViewMode] = useState('3d'); // '3d' or 'video'

    // Инициализация canvas и контейнера
    useEffect(() => {
        if (!containerRef.current) return;

        // Создаем отдельный контейнер для canvas
        const canvasContainer = document.createElement('div');
        canvasContainer.id = `fabric-container-${canvasId.current}`;
        canvasContainer.style.position = 'absolute';
        canvasContainer.style.top = '0';
        canvasContainer.style.left = '0';
        canvasContainer.style.width = '100%';
        canvasContainer.style.height = '100%';
        canvasContainer.style.pointerEvents = readOnly ? 'none' : 'auto';
        containerRef.current.appendChild(canvasContainer);
        canvasContainerRef.current = canvasContainer;

        // Создаем canvas
        const canvas = document.createElement('canvas');
        canvas.id = canvasId.current;

        // Ждем, пока контейнер будет полностью инициализирован
        setTimeout(() => {
            canvas.width = canvasContainer.clientWidth;
            canvas.height = canvasContainer.clientHeight;
            canvasContainer.appendChild(canvas);

            // Инициализируем Fabric
            const fabricCanvas = new fabric.Canvas(canvasId.current, {
                width: canvasContainer.clientWidth,
                height: canvasContainer.clientHeight,
                backgroundColor: '#ffffff',
                preserveObjectStacking: true,
                selection: !readOnly, // Disable selection in readOnly mode
                interactive: !readOnly // Disable interaction in readOnly mode
            });

            fabricInstances.set(canvasId.current, fabricCanvas);

            // Set selection properties based on readOnly mode
            if (readOnly) {
                fabricCanvas.selection = false;
                fabricCanvas.skipTargetFind = true;
                fabricCanvas.selectable = false;
                fabricCanvas.hoverCursor = 'default';
            }

            // Устанавливаем обработчики событий
            setupEventHandlers(fabricCanvas);

            // Добавляем обработчик клавиши Delete для удаления элементов
            const handleKeyDown = (e) => {
                if (!readOnly && e.key === 'Delete' && fabricCanvas.getActiveObject()) {
                    e.preventDefault();
                    handleDeleteElement();
                }
            };

            document.addEventListener('keydown', handleKeyDown);

            // Добавляем обработчик изменения размера окна
            const handleResize = () => {
                if (canvasContainer) {
                    const width = canvasContainer.clientWidth;
                    const height = canvasContainer.clientHeight;

                    // Сохраняем текущие объекты и их позиции
                    const objects = fabricCanvas.getObjects();
                    const oldWidth = fabricCanvas.width;
                    const oldHeight = fabricCanvas.height;

                    // Обновляем размеры canvas
                    canvas.width = width;
                    canvas.height = height;
                    fabricCanvas.setWidth(width);
                    fabricCanvas.setHeight(height);

                    // Масштабируем позиции объектов
                    objects.forEach(obj => {
                        const scaleX = width / oldWidth;
                        const scaleY = height / oldHeight;

                        obj.set({
                            left: obj.left * scaleX,
                            top: obj.top * scaleY,
                            scaleX: obj.scaleX * scaleX,
                            scaleY: obj.scaleY * scaleY
                        });
                    });

                    fabricCanvas.renderAll();
                }
            };

            window.addEventListener('resize', handleResize);
            setInitialized(true);

            // Очистка при размонтировании
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('resize', handleResize);
                if (fabricInstances.has(canvasId.current)) {
                    const instance = fabricInstances.get(canvasId.current);
                    instance.dispose();
                    fabricInstances.delete(canvasId.current);
                }
            };
        }, 0);

        // Создаем контейнер для кнопок, только если не в режиме чтения
        if (!readOnly) {
            const btnContainer = document.createElement('div');
            btnContainer.id = `btn-container-${canvasId.current}`;
            btnContainer.style.position = 'absolute';
            btnContainer.style.top = '0';
            btnContainer.style.left = '0';
            btnContainer.style.width = '100%';
            btnContainer.style.height = '100%';
            btnContainer.style.pointerEvents = 'none';
            btnContainer.style.zIndex = '10';
            containerRef.current.appendChild(btnContainer);
            buttonContainerRef.current = btnContainer;
        }

        return () => {
            // Удаляем DOM элементы
            if (canvasContainerRef.current && containerRef.current) {
                containerRef.current.removeChild(canvasContainerRef.current);
            }

            if (buttonContainerRef.current && containerRef.current) {
                containerRef.current.removeChild(buttonContainerRef.current);
            }
        };
    }, [readOnly]);

    // Функция установки обработчиков событий
    const setupEventHandlers = useCallback((fabricCanvas) => {
        if (!fabricCanvas) return;

        // Очищаем существующие обработчики
        fabricCanvas.off();

        // Skip event handlers in readOnly mode
        if (readOnly) return;

        // Обработчик модификации объекта
        fabricCanvas.on('object:modified', (e) => {
            const modifiedObject = e.target;
            console.log('Object modified event fired');

            if (!modifiedObject || !modifiedObject.data || !modifiedObject.data.elementId) {
                console.warn('Modified object is missing data or elementId');
                return;
            }

            const elementId = modifiedObject.data.elementId;
            console.log('Modified element ID:', elementId);

            const element = elements.find(el => el.id === elementId);

            if (!element) {
                console.warn('Element not found in elements array:', elementId);
                return;
            }

            console.log('Found element in array:', element.id);
            console.log('Current element position:', element.position);
            console.log('Modified object position:', { left: modifiedObject.left, top: modifiedObject.top });

            // Create updated array of elements
            let updatedElements;

            // If recording keyframes is active, update keyframes
            if (isRecordingKeyframe) {
                console.log('Recording keyframe mode is active, creating keyframe');

                // Create properties for the keyframe
                const keyframeProps = {
                    time: currentTime,
                    position: {
                        x: modifiedObject.left,
                        y: modifiedObject.top
                    },
                    opacity: modifiedObject.opacity || 1,
                    scale: modifiedObject.scaleX || 1
                };

                console.log('Creating keyframe with time:', currentTime, 'props:', keyframeProps);

                // Add or update the keyframe
                const updatedElement = addOrUpdateKeyframe(
                    element,
                    currentTime,
                    keyframeProps
                );

                console.log('Updated element keyframes count:', updatedElement.keyframes?.length || 0);

                // Update the elements array
                updatedElements = elements.map(elem =>
                    elem.id === elementId ? updatedElement : elem
                );
            } else {
                console.log('Recording keyframe mode is NOT active, updating base properties');

                // Update base properties while preserving keyframes
                updatedElements = elements.map(elem => {
                    if (elem.id === elementId) {
                        return {
                            ...elem,
                            position: {
                                x: modifiedObject.left,
                                y: modifiedObject.top
                            },
                            size: {
                                width: modifiedObject.width * (modifiedObject.scaleX || 1),
                                height: modifiedObject.height * (modifiedObject.scaleY || 1)
                            },
                            style: {
                                ...elem.style,
                                opacity: modifiedObject.opacity || 1
                            },
                            keyframes: elem.keyframes || [] // Preserve existing keyframes
                        };
                    }
                    return elem;
                });
            }

            // Notify parent component of changes
            if (onElementsChange) {
                console.log('Notifying parent of element changes');
                onElementsChange(updatedElements);
            }
        });

        // Обработчик выбора элемента
        fabricCanvas.on('selection:created', (e) => {
            if (e.selected && e.selected.length > 0) {
                const selectedObject = e.selected[0];
                if (selectedObject.data && selectedObject.data.elementId) {
                    const element = elements.find(el => el.id === selectedObject.data.elementId);
                    if (element) {
                        setTimeout(() => {
                            onElementSelect(element);
                        }, 0);
                    }
                }
            }
        });

        fabricCanvas.on('selection:updated', (e) => {
            if (e.selected && e.selected.length > 0) {
                const selectedObject = e.selected[0];
                if (selectedObject.data && selectedObject.data.elementId) {
                    const element = elements.find(el => el.id === selectedObject.data.elementId);
                    if (element) {
                        setTimeout(() => {
                            onElementSelect(element);
                        }, 0);
                    }
                }
            }
        });

        fabricCanvas.on('selection:cleared', () => {
            setTimeout(() => {
                onElementSelect(null);
            }, 0);
        });
    }, [elements, currentTime, isRecordingKeyframe, onElementsChange, onElementSelect, readOnly]);

    // Функция для применения эффектов анимации
    const applyAnimationEffects = useCallback((fabricObject, element) => {
        // Проверка на существование keyframes и элемента
        if (!element) {
            console.warn('Cannot apply animation: element is null or undefined');
            return;
        }

        if (!element.keyframes || !Array.isArray(element.keyframes) || element.keyframes.length === 0) {
            console.log(`No keyframes for element ${element?.id}, using base properties`);

            // Если нет keyframes, используем базовые свойства элемента
            if (element.position) {
                fabricObject.set({
                    left: element.position.x,
                    top: element.position.y,
                    opacity: element.style?.opacity || 1,
                    scaleX: 1,
                    scaleY: 1
                });
            } else {
                console.warn(`Element ${element.id} has invalid position data`);
            }
            return;
        }

        console.log(`Applying animation effects for element ${element.id} at time ${currentTime}. Keyframes count: ${element.keyframes.length}`);

        // Dump first keyframe for debugging
        if (element.keyframes.length > 0) {
            console.log(`First keyframe sample: ${JSON.stringify(element.keyframes[0])}`);
        }

        // Находим два keyframe между которыми находимся
        let prevKeyframe = null;
        let nextKeyframe = null;

        // Фильтруем и сортируем keyframes по времени
        const sortedKeyframes = [...element.keyframes]
            .filter(kf => {
                const isValid = kf &&
                    typeof kf.time === 'number' && !isNaN(kf.time) &&
                    kf.position &&
                    typeof kf.position.x === 'number' && !isNaN(kf.position.x) &&
                    typeof kf.position.y === 'number' && !isNaN(kf.position.y) &&
                    typeof kf.opacity === 'number' && !isNaN(kf.opacity);

                if (!isValid) {
                    console.warn(`Filtering out invalid keyframe for element ${element.id}:`, kf);
                }

                return isValid;
            })
            .sort((a, b) => a.time - b.time);

        // Проверяем, есть ли у нас ключевые кадры с временем
        if (sortedKeyframes.length === 0) {
            console.log(`No valid keyframes for element ${element.id}`);
            // Если нет валидных ключевых кадров, используем базовые свойства
            fabricObject.set({
                left: element.position.x,
                top: element.position.y,
                opacity: element.style.opacity,
                scaleX: 1,
                scaleY: 1
            });
            return;
        }

        // Если текущее время точно соответствует ключевому кадру, используем его без интерполяции
        const exactKeyframe = sortedKeyframes.find(k => Math.abs(k.time - currentTime) < 0.01);
        if (exactKeyframe) {
            console.log(`Using exact keyframe at time ${exactKeyframe.time}`);

            // Make sure all properties exist and are valid
            const posX = exactKeyframe.position?.x ?? element.position.x;
            const posY = exactKeyframe.position?.y ?? element.position.y;
            const opacity = exactKeyframe.opacity !== undefined ? exactKeyframe.opacity : element.style.opacity;
            const scale = exactKeyframe.scale || 1;

            fabricObject.set({
                left: posX,
                top: posY,
                opacity: opacity,
                scaleX: scale,
                scaleY: scale
            });

            console.log(`Applied keyframe properties: x=${posX}, y=${posY}, opacity=${opacity}, scale=${scale}`);
            return;
        }

        // Находим предыдущий и следующий ключевые кадры
        for (let i = 0; i < sortedKeyframes.length; i++) {
            if (sortedKeyframes[i].time <= currentTime) {
                prevKeyframe = sortedKeyframes[i];
            }

            if (sortedKeyframes[i].time > currentTime && !nextKeyframe) {
                nextKeyframe = sortedKeyframes[i];
            }
        }

        // Если у нас нет обоих keyframes, используем ближайший
        if (!prevKeyframe && !nextKeyframe) {
            console.log(`No applicable keyframes for element ${element.id} at time ${currentTime}`);
            // Если нет keyframes вообще, используем базовые свойства
            fabricObject.set({
                left: element.position.x,
                top: element.position.y,
                opacity: element.style.opacity,
                scaleX: 1,
                scaleY: 1
            });
            return;
        }

        if (!prevKeyframe) {
            // Если нет предыдущего кадра, используем первый с базовыми свойствами элемента для предыдущего
            prevKeyframe = {
                time: 0,
                position: { x: element.position.x, y: element.position.y },
                opacity: element.style.opacity,
                scale: 1
            };
        }

        if (!nextKeyframe) {
            // Если нет следующего кадра, используем последний с его же свойствами
            nextKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
        }

        // Вычисляем прогресс между keyframes
        const totalDuration = nextKeyframe.time - prevKeyframe.time;
        if (totalDuration === 0 || prevKeyframe === nextKeyframe) {
            console.log(`Using single keyframe at time ${prevKeyframe.time}`);
            // Если кадры совпадают по времени, используем свойства кадра
            fabricObject.set({
                left: prevKeyframe.position?.x ?? element.position.x,
                top: prevKeyframe.position?.y ?? element.position.y,
                opacity: prevKeyframe.opacity !== undefined ? prevKeyframe.opacity : element.style.opacity,
                scaleX: prevKeyframe.scale || 1,
                scaleY: prevKeyframe.scale || 1
            });
            return;
        }

        const progress = (currentTime - prevKeyframe.time) / totalDuration;

        console.log(`Interpolating between keyframes at ${prevKeyframe.time} and ${nextKeyframe.time} (progress: ${progress})`);

        // Обеспечиваем существование свойств position или используем базовые свойства элемента
        const prevX = prevKeyframe.position?.x ?? element.position.x;
        const prevY = prevKeyframe.position?.y ?? element.position.y;
        const nextX = nextKeyframe.position?.x ?? element.position.x;
        const nextY = nextKeyframe.position?.y ?? element.position.y;

        // Интерполируем позицию
        const currentX = prevX + (nextX - prevX) * progress;
        const currentY = prevY + (nextY - prevY) * progress;

        // Интерполируем прозрачность
        const prevOpacity = prevKeyframe.opacity !== undefined ? prevKeyframe.opacity : element.style.opacity;
        const nextOpacity = nextKeyframe.opacity !== undefined ? nextKeyframe.opacity : element.style.opacity;
        const currentOpacity = prevOpacity + (nextOpacity - prevOpacity) * progress;

        // Интерполируем масштаб
        const prevScale = prevKeyframe.scale || 1;
        const nextScale = nextKeyframe.scale || 1;
        const currentScale = prevScale + (nextScale - prevScale) * progress;

        // Применяем свойства
        fabricObject.set({
            left: currentX,
            top: currentY,
            opacity: currentOpacity,
            scaleX: currentScale,
            scaleY: currentScale
        });

        console.log(`Applied interpolated properties: x=${currentX}, y=${currentY}, opacity=${currentOpacity}, scale=${currentScale}`);
    }, [currentTime]);

    // Функция добавления или обновления keyframe
    const addOrUpdateKeyframe = (element, time, properties = {}) => {
        console.log('Adding/updating keyframe:', { elementId: element.id, time, properties });

        // Validate input
        if (!element || !element.id) {
            console.error('Invalid element in addOrUpdateKeyframe:', element);
            return element;
        }

        if (typeof time !== 'number' || isNaN(time)) {
            console.error('Invalid time in addOrUpdateKeyframe:', time);
            return element;
        }

        // Ensure properties are valid
        const validProperties = {
            time,
            position: {
                x: typeof properties.position?.x === 'number' ? properties.position.x : 0,
                y: typeof properties.position?.y === 'number' ? properties.position.y : 0
            },
            opacity: typeof properties.opacity === 'number' ? properties.opacity : 1,
            scale: typeof properties.scale === 'number' ? properties.scale : 1
        };

        // Create a new array of keyframes
        let updatedKeyframes = Array.isArray(element.keyframes) ? [...element.keyframes] : [];

        // Find existing keyframe at this time
        const existingIndex = updatedKeyframes.findIndex(kf => kf.time === time);

        if (existingIndex !== -1) {
            // Update existing keyframe
            updatedKeyframes[existingIndex] = {
                ...updatedKeyframes[existingIndex],
                ...validProperties
            };
            console.log('Updated existing keyframe at time:', time);
        } else {
            // Add new keyframe
            updatedKeyframes.push(validProperties);
            console.log('Added new keyframe at time:', time);
        }

        // Sort keyframes by time
        updatedKeyframes.sort((a, b) => a.time - b.time);

        // Create updated element
        const updatedElement = {
            ...element,
            keyframes: updatedKeyframes
        };

        console.log('Updated element keyframes count:', updatedKeyframes.length);
        return updatedElement;
    };

    // Функция дублирования выбранного элемента
    const handleDuplicateElement = useCallback(() => {
        if (!selectedElement) return;

        // Создаем глубокую копию выбранного элемента
        const duplicatedElement = JSON.parse(JSON.stringify(selectedElement));

        // Генерируем новый ID для дублированного элемента
        duplicatedElement.id = uuidv4();

        // Сдвигаем позицию чтобы было видно
        duplicatedElement.position = {
            x: duplicatedElement.position.x + 20,
            y: duplicatedElement.position.y + 20
        };

        // Обновляем позиции всех keyframes
        if (duplicatedElement.keyframes && duplicatedElement.keyframes.length > 0) {
            duplicatedElement.keyframes.forEach(keyframe => {
                if (keyframe.position) {
                    keyframe.position.x += 20;
                    keyframe.position.y += 20;
                }
            });
        }

        // Добавляем дублированный элемент в массив элементов
        const updatedElements = [...elements, duplicatedElement];
        onElementsChange(updatedElements);

        // Выбираем новый элемент
        onElementSelect(duplicatedElement);
    }, [elements, selectedElement, onElementsChange, onElementSelect]);

    // Функция удаления выбранного элемента
    const handleDeleteElement = useCallback(() => {
        if (!selectedElement) return;

        // Создаем новый массив элементов без удаляемого элемента
        const updatedElements = elements.filter(elem => elem.id !== selectedElement.id);

        // Обновляем состояние
        onElementsChange(updatedElements);

        // Снимаем выделение
        onElementSelect(null);

        // Обновляем canvas
        if (fabricInstances.has(canvasId.current)) {
            const fabricCanvas = fabricInstances.get(canvasId.current);
            fabricCanvas.discardActiveObject();
            fabricCanvas.renderAll();
        }
    }, [elements, selectedElement, onElementsChange, onElementSelect, canvasId]);

    // Обновляем canvas при изменении элементов или времени
    useEffect(() => {
        if (!initialized || !fabricInstances.has(canvasId.current)) return;

        const fabricCanvas = fabricInstances.get(canvasId.current);

        // Используем requestAnimationFrame для обеспечения синхронизации с рендерингом браузера
        const updateCanvas = () => {
            try {
                // Очищаем canvas
                fabricCanvas.clear();
                fabricCanvas.backgroundColor = '#ffffff';

                // Добавляем элементы на canvas
                const imageLoadPromises = [];

                elements.forEach(element => {
                    // Проверяем должен ли элемент быть видимым в текущее время
                    const startTime = element.animation?.startTime || 0;
                    const endTime = element.animation?.endTime;

                    if (currentTime >= startTime && (endTime === null || currentTime <= endTime)) {
                        let fabricObject;

                        // Создаем fabric объект на основе типа элемента
                        switch (element.type) {
                            case 'rectangle':
                                fabricObject = new fabric.Rect({
                                    left: element.position.x,
                                    top: element.position.y,
                                    width: element.size.width,
                                    height: element.size.height,
                                    fill: element.style.backgroundColor,
                                    stroke: element.style.borderColor,
                                    strokeWidth: element.style.borderWidth,
                                    opacity: element.style.opacity,
                                    selectable: true,
                                    hasControls: true
                                });
                                break;

                            case 'circle':
                                fabricObject = new fabric.Circle({
                                    left: element.position.x,
                                    top: element.position.y,
                                    radius: Math.min(element.size.width, element.size.height) / 2,
                                    fill: element.style.backgroundColor,
                                    stroke: element.style.borderColor,
                                    strokeWidth: element.style.borderWidth,
                                    opacity: element.style.opacity,
                                    selectable: true,
                                    hasControls: true
                                });
                                break;

                            case 'text':
                                fabricObject = new fabric.Text(element.content, {
                                    left: element.position.x,
                                    top: element.position.y,
                                    fontSize: element.size.height,
                                    fill: element.style.color,
                                    opacity: element.style.opacity,
                                    selectable: true,
                                    hasControls: true
                                });
                                break;

                            case 'image':
                                const promise = new Promise((resolve) => {
                                    fabric.Image.fromURL(element.content, (img) => {
                                        img.set({
                                            left: element.position.x,
                                            top: element.position.y,
                                            opacity: element.style.opacity,
                                            selectable: true,
                                            hasControls: true
                                        });
                                        img.scaleToWidth(element.size.width);
                                        img.scaleToHeight(element.size.height);

                                        // Сохраняем полные данные об элементе для доступа к keyframes
                                        img.data = {
                                            elementId: element.id,
                                            element: element // Сохраняем полный элемент для доступа к keyframes
                                        };

                                        // Применяем эффекты анимации на основе keyframes
                                        applyAnimationEffects(img, element);

                                        fabricCanvas.add(img);
                                        resolve();
                                    }, { crossOrigin: 'anonymous' });
                                });

                                imageLoadPromises.push(promise);
                                return; // Пропускаем остальное для изображений

                            default:
                                return; // Пропускаем неизвестные типы
                        }

                        // Сохраняем полные данные об элементе для доступа к keyframes
                        fabricObject.data = {
                            elementId: element.id,
                            element: element // Сохраняем полный элемент для доступа к keyframes
                        };

                        // Применяем эффекты анимации на основе keyframes
                        applyAnimationEffects(fabricObject, element);

                        // Добавляем на canvas
                        fabricCanvas.add(fabricObject);
                    }
                });

                // Восстанавливаем обработчики событий
                setupEventHandlers(fabricCanvas);

                // Рендерим после загрузки всех изображений
                Promise.all(imageLoadPromises).then(() => {
                    // Выбираем активный элемент после добавления всех объектов
                    if (selectedElement) {
                        const objects = fabricCanvas.getObjects();
                        const objectToSelect = objects.find(obj =>
                            obj.data && obj.data.elementId === selectedElement.id
                        );

                        if (objectToSelect) {
                            fabricCanvas.setActiveObject(objectToSelect);
                        }
                    }

                    fabricCanvas.renderAll();
                });
            } catch (error) {
                console.error("Ошибка обновления canvas:", error);
            }
        };

        // Выполняем обновление canvas с небольшой задержкой
        const timeoutId = setTimeout(updateCanvas, 0);

        // Анимация для плеера
        let animationFrame;

        const animateCanvas = () => {
            if (isPlaying) {
                fabricCanvas.renderAll();
                animationFrame = requestAnimationFrame(animateCanvas);
            }
        };

        if (isPlaying) {
            animationFrame = requestAnimationFrame(animateCanvas);
        }

        return () => {
            clearTimeout(timeoutId);
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [initialized, elements, currentTime, selectedElement, isPlaying, setupEventHandlers, applyAnimationEffects]);

    // Переключение записи keyframe
    const toggleKeyframeRecording = useCallback(() => {
        setIsRecordingKeyframe(prev => {
            const newState = !prev;
            console.log(`Recording mode toggled from ${prev} to ${newState}`);

            return newState;
        });
    }, []);

    // Функция для открытия модального окна с хореографией
    const handleShowChoreography = useCallback(() => {
        setShowChoreoModal(true);
    }, []);

    // Функция для закрытия модального окна с хореографией
    const handleCloseChoreography = useCallback(() => {
        setShowChoreoModal(false);
    }, []);

    // Функция для переключения между 3D моделью и видео
    const handleViewModeChange = useCallback((mode) => {
        setViewMode(mode);
        setShowChoreoModal(true);
    }, []);

    // Используем ReactDOM.createPortal для рендеринга кнопок в отдельном контейнере
    const renderButtons = () => {
        if (!buttonContainerRef.current) return null;

        return ReactDOM.createPortal(
            <>
                <div
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 100,
                        backgroundColor: isRecordingKeyframe ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        pointerEvents: 'auto'
                    }}
                    onClick={toggleKeyframeRecording}
                >
                    {isRecordingKeyframe ? 'Запись ключевых кадров (ВКЛ)' : 'Запись ключевых кадров (ВЫКЛ)'}
                </div>

                {selectedElement && (
                    <div style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        zIndex: 100,
                        display: 'flex',
                        gap: '8px'
                    }}>
                        <IconButton
                            onClick={handleDuplicateElement}
                            sx={{
                                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                },
                                pointerEvents: 'auto'
                            }}
                            title="Дублировать элемент"
                        >
                            <ContentCopy fontSize="small" />
                        </IconButton>

                        <IconButton
                            onClick={handleDeleteElement}
                            sx={{
                                backgroundColor: 'rgba(255, 87, 87, 0.7)',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 87, 87, 0.9)',
                                },
                                pointerEvents: 'auto'
                            }}
                            title="Удалить элемент (Delete)"
                        >
                            <Delete fontSize="small" />
                        </IconButton>

                        <IconButton
                            onClick={() => handleViewModeChange('3d')}
                            sx={{
                                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                                '&:hover': {
                                    backgroundColor: 'rgba(52, 152, 219, 0.9)',
                                },
                                pointerEvents: 'auto'
                            }}
                            title="Просмотр 3D модели"
                        >
                            <ThreeDRotation fontSize="small" />
                        </IconButton>

                        <IconButton
                            onClick={() => handleViewModeChange('video')}
                            sx={{
                                backgroundColor: 'rgba(76, 175, 80, 0.7)',
                                '&:hover': {
                                    backgroundColor: 'rgba(76, 175, 80, 0.9)',
                                },
                                pointerEvents: 'auto'
                            }}
                            title="Просмотр видео"
                        >
                            <Videocam fontSize="small" />
                        </IconButton>
                    </div>
                )}
            </>,
            buttonContainerRef.current
        );
    };

    return (
        <Box
            ref={containerRef}
            sx={{
                width: '100%',
                height: '100%',
                border: '1px solid #ccc',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 1,
                backgroundColor: '#ffffff'
            }}
        >
            {initialized && renderButtons()}

            {/* Модальное окно для просмотра хореографии */}
            <Modal
                open={showChoreoModal}
                onClose={handleCloseChoreography}
                aria-labelledby="choreography-modal-title"
            >
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '80%',
                    height: '80%',
                    bgcolor: 'background.paper',
                    boxShadow: 24,
                    p: 4,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Typography id="choreography-modal-title" variant="h6" component="h2" gutterBottom>
                        {viewMode === '3d' ? '3D модель' : 'Видео'} для {selectedElement?.title || 'танцора'}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }}>
                        {viewMode === '3d' ? (
                            <ModelViewer
                                isVisible={true}
                                onClose={() => setShowChoreoModal(false)}
                            />
                        ) : (
                            <VideoViewer
                                isVisible={true}
                                videoUrl={selectedElement?.videoUrl}
                                onClose={() => setShowChoreoModal(false)}
                            />
                        )}
                    </Box>
                </Box>
            </Modal>
        </Box>
    );
};

export default Canvas; 