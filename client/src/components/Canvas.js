import React, { useEffect, useRef, useState, useCallback, createRef } from 'react';
import { fabric } from 'fabric';
import { Box, IconButton } from '@mui/material';
import { ContentCopy, Delete } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import ReactDOM from 'react-dom';

// Выносим canvas полностью за пределы React-дерева
const fabricInstances = new Map();

const Canvas = ({ elements, currentTime, isPlaying, onElementsChange, selectedElement, onElementSelect }) => {
    const containerRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const canvasId = useRef(`canvas-${uuidv4()}`);
    const [isRecordingKeyframe, setIsRecordingKeyframe] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const buttonContainerRef = useRef(null);

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
        canvasContainer.style.pointerEvents = 'auto';
        containerRef.current.appendChild(canvasContainer);
        canvasContainerRef.current = canvasContainer;

        // Создаем canvas
        const canvas = document.createElement('canvas');
        canvas.id = canvasId.current;
        canvas.width = 800;
        canvas.height = 600;
        canvasContainer.appendChild(canvas);

        // Создаем контейнер для кнопок
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

        // Инициализируем Fabric
        const fabricCanvas = new fabric.Canvas(canvasId.current, {
            width: 800,
            height: 600,
            backgroundColor: '#ffffff',
            preserveObjectStacking: true
        });

        fabricInstances.set(canvasId.current, fabricCanvas);

        // Устанавливаем обработчики событий
        setupEventHandlers(fabricCanvas);

        // Добавляем обработчик клавиши Delete для удаления элементов
        const handleKeyDown = (e) => {
            if (e.key === 'Delete' && fabricCanvas.getActiveObject()) {
                e.preventDefault();
                handleDeleteElement();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        setInitialized(true);

        return () => {
            // Удаляем обработчик клавиш
            document.removeEventListener('keydown', handleKeyDown);

            // Удаляем все обработчики при размонтировании
            if (fabricInstances.has(canvasId.current)) {
                const instance = fabricInstances.get(canvasId.current);
                instance.dispose();
                fabricInstances.delete(canvasId.current);
            }

            // Удаляем DOM элементы
            if (canvasContainerRef.current && containerRef.current) {
                containerRef.current.removeChild(canvasContainerRef.current);
            }

            if (buttonContainerRef.current && containerRef.current) {
                containerRef.current.removeChild(buttonContainerRef.current);
            }
        };
    }, []);

    // Функция установки обработчиков событий
    const setupEventHandlers = useCallback((fabricCanvas) => {
        if (!fabricCanvas) return;

        // Очищаем существующие обработчики
        fabricCanvas.off();

        // Обработчик модификации объекта
        fabricCanvas.on('object:modified', (e) => {
            const modifiedObject = e.target;
            if (!modifiedObject || !modifiedObject.data || !modifiedObject.data.elementId) return;

            const elementId = modifiedObject.data.elementId;
            const element = elements.find(el => el.id === elementId);

            if (!element) return;

            // Создаем обновленный массив элементов
            let updatedElements;

            // Базовое обновление (позиция, размер)
            const basicUpdate = {
                position: {
                    x: modifiedObject.left,
                    y: modifiedObject.top
                },
                size: {
                    width: modifiedObject.width * (modifiedObject.scaleX || 1),
                    height: modifiedObject.height * (modifiedObject.scaleY || 1)
                }
            };

            // Если запись кадров активна, также обновляем keyframes
            if (isRecordingKeyframe) {
                // Создаем свойства для сохранения в кадре
                const keyframeProps = {
                    position: {
                        x: modifiedObject.left,
                        y: modifiedObject.top
                    },
                    opacity: modifiedObject.opacity,
                    scale: modifiedObject.scaleX || 1
                };

                // Добавляем или обновляем кадр для текущего времени
                const updatedElement = addOrUpdateKeyframe(
                    element,
                    currentTime,
                    keyframeProps
                );

                // Обновляем список элементов измененным элементом
                updatedElements = elements.map(elem =>
                    elem.id === elementId ? updatedElement : elem
                );
            } else {
                // Просто обновляем базовые свойства
                updatedElements = elements.map(elem =>
                    elem.id === elementId ? { ...elem, ...basicUpdate } : elem
                );
            }

            // Используем setTimeout для безопасного обновления состояния
            setTimeout(() => {
                onElementsChange(updatedElements);
            }, 0);
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
    }, [elements, currentTime, isRecordingKeyframe, onElementsChange, onElementSelect]);

    // Функция для применения эффектов анимации
    const applyAnimationEffects = useCallback((fabricObject, element) => {
        if (!element.keyframes || element.keyframes.length < 2) return;

        // Находим два keyframe между которыми находимся
        let prevKeyframe = null;
        let nextKeyframe = null;

        // Сортируем keyframes по времени
        const sortedKeyframes = [...element.keyframes].sort((a, b) => a.time - b.time);

        for (let i = 0; i < sortedKeyframes.length; i++) {
            if (sortedKeyframes[i].time <= currentTime) {
                prevKeyframe = sortedKeyframes[i];
            }

            if (sortedKeyframes[i].time > currentTime && !nextKeyframe) {
                nextKeyframe = sortedKeyframes[i];
            }
        }

        // Если у нас нет обоих keyframes, используем ближайший
        if (!prevKeyframe) {
            prevKeyframe = sortedKeyframes[0];
        }

        if (!nextKeyframe) {
            // Используем свойства последнего кадра
            fabricObject.set({
                left: prevKeyframe.position.x,
                top: prevKeyframe.position.y,
                opacity: prevKeyframe.opacity,
                scaleX: prevKeyframe.scale,
                scaleY: prevKeyframe.scale
            });
            return;
        }

        // Вычисляем прогресс между keyframes
        const totalDuration = nextKeyframe.time - prevKeyframe.time;
        if (totalDuration === 0) return;

        const progress = (currentTime - prevKeyframe.time) / totalDuration;

        // Интерполируем позицию
        const currentX = prevKeyframe.position.x + (nextKeyframe.position.x - prevKeyframe.position.x) * progress;
        const currentY = prevKeyframe.position.y + (nextKeyframe.position.y - prevKeyframe.position.y) * progress;

        // Интерполируем прозрачность
        const currentOpacity = prevKeyframe.opacity + (nextKeyframe.opacity - prevKeyframe.opacity) * progress;

        // Интерполируем масштаб
        const currentScale = prevKeyframe.scale + (nextKeyframe.scale - prevKeyframe.scale) * progress;

        // Применяем свойства
        fabricObject.set({
            left: currentX,
            top: currentY,
            opacity: currentOpacity,
            scaleX: currentScale,
            scaleY: currentScale
        });
    }, [currentTime]);

    // Функция добавления или обновления keyframe
    const addOrUpdateKeyframe = useCallback((element, time, properties) => {
        // Создаем глубокую копию элемента
        const updatedElement = JSON.parse(JSON.stringify(element));

        // Инициализируем массив keyframes если он не существует
        if (!updatedElement.keyframes) {
            updatedElement.keyframes = [];
        }

        // Проверяем существует ли keyframe на данное время
        const existingKeyframeIndex = updatedElement.keyframes.findIndex(k => Math.abs(k.time - time) < 0.01);

        if (existingKeyframeIndex >= 0) {
            // Обновляем существующий keyframe
            updatedElement.keyframes[existingKeyframeIndex] = {
                ...updatedElement.keyframes[existingKeyframeIndex],
                ...properties,
                time
            };
        } else {
            // Добавляем новый keyframe
            updatedElement.keyframes.push({
                time,
                ...properties
            });
        }

        // Сортируем keyframes по времени
        updatedElement.keyframes.sort((a, b) => a.time - b.time);

        return updatedElement;
    }, []);

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
                                fabricObject = new fabric.Textbox(element.content, {
                                    left: element.position.x,
                                    top: element.position.y,
                                    width: element.size.width,
                                    fill: element.style.color,
                                    fontSize: 20,
                                    opacity: element.style.opacity,
                                    selectable: true,
                                    hasControls: true
                                });
                                break;

                            case 'image':
                                // Обрабатываем загрузку изображения с promise
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

                                        // Добавляем data атрибут для идентификации элемента
                                        img.data = { elementId: element.id };

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

                        // Добавляем data атрибут для идентификации элемента
                        fabricObject.data = { elementId: element.id };

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
    }, [
        initialized,
        elements,
        currentTime,
        selectedElement,
        isPlaying,
        setupEventHandlers,
        applyAnimationEffects
    ]);

    // Переключение записи keyframe
    const toggleKeyframeRecording = useCallback(() => {
        setIsRecordingKeyframe(prev => !prev);
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
                height: 600,
                border: '1px solid #ccc',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 1
            }}
        >
            {initialized && renderButtons()}
        </Box>
    );
};

export default Canvas; 