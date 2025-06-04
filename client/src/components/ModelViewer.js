import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF, Grid, Html } from '@react-three/drei';
import { Box as MuiBox, CircularProgress, Button, IconButton, Slider, Typography, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, List, ListItem, ListItemText, ListItemSecondaryAction, Menu, MenuItem, Select, FormControl, InputLabel, Tabs, Tab, Box } from '@mui/material';
import { PlayArrow, Pause, AddCircleOutline, Delete, Edit, DragIndicator, Save, FolderOpen, Upload, Close as CloseIcon, ThreeDRotation } from '@mui/icons-material';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ModelUploader from './ModelUploader';

// Компонент модели 
const Model = ({ currentTime, isPlaying, onTimeUpdate, onModelLoad, playerDuration, animationMarkers = [], activeAnimations = [], glbAnimationUrl = null, elementId = null, elementKeyframes = [] }) => {
    const [customModel, setCustomModel] = useState(null);
    const [loadingError, setLoadingError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [debugInfo, setDebugInfo] = useState({
        modelLoaded: false,
        animationsCount: 0,
        modelUrl: glbAnimationUrl,
        error: null
    });

    // ПРЯМАЯ ПЕРЕЗАПИСЬ - Принудительное использование заведомо рабочего URL
    const FORCE_MODEL_URL = `${window.location.origin}/api/uploads/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb`;
    console.log('Model: FORCING DIRECT MODEL URL:', FORCE_MODEL_URL);

    const mixer = useRef(null);
    const lastTimeRef = useRef(null);
    const animationRef = useRef(null);
    const clock = useRef(new THREE.Clock());
    const modelDuration = useRef(0);
    const animationsRef = useRef([]);
    const activeActionsRef = useRef({});
    const [externalAnimations, setExternalAnimations] = useState({});

    // Обработка потери контекста WebGL
    useEffect(() => {
        const handleContextLost = (event) => {
            event.preventDefault();
            console.warn('Model: WebGL context was lost');

            // Остановить все текущие анимации
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }

            // Сбросить микшер
            mixer.current = null;

            // Установить ошибку загрузки
            setLoadingError('WebGL контекст был потерян. Пожалуйста, перезагрузите страницу.');
        };

        const handleContextRestored = () => {
            console.log('Model: WebGL context was restored');

            // Очистить ошибку
            setLoadingError(null);

            // Перезагрузить модель
            if (glbAnimationUrl) {
                console.log('Model: Reloading model after context restore');
                // Модель будет перезагружена эффектом, который следит за glbAnimationUrl
            }
        };

        // Добавить обработчики событий
        window.addEventListener('webglcontextlost', handleContextLost);
        window.addEventListener('webglcontextrestored', handleContextRestored);

        return () => {
            // Удалить обработчики событий
            window.removeEventListener('webglcontextlost', handleContextLost);
            window.removeEventListener('webglcontextrestored', handleContextRestored);
        };
    }, [glbAnimationUrl]);

    // Загрузить пользовательскую GLB модель, если предоставлен URL
    useEffect(() => {
        // Отладочный лог для проверки значения URL
        console.log('Model: glbAnimationUrl check:', {
            url: glbAnimationUrl,
            type: typeof glbAnimationUrl,
            isNull: glbAnimationUrl === null,
            isUndefined: glbAnimationUrl === undefined,
            isFalsy: !glbAnimationUrl,
            stringValue: String(glbAnimationUrl),
            forcedUrl: FORCE_MODEL_URL
        });

        // НАПРЯМУЮ ЗАГРУЖАЕМ ПРИНУДИТЕЛЬНЫЙ URL НЕЗАВИСИМО ОТ ВХОДНЫХ ДАННЫХ
        console.log('Model: BYPASSING normal URL and loading forced URL:', FORCE_MODEL_URL);
        setIsLoading(true);
        setLoadingError(null);

        // Отправить прямой fetch-запрос для проверки доступности URL
        fetch(FORCE_MODEL_URL, { method: 'HEAD' })
            .then(response => {
                console.log('Model: HEAD request result for forced URL:', {
                    status: response.status,
                    ok: response.ok,
                    statusText: response.statusText,
                    url: FORCE_MODEL_URL
                });

                if (response.ok) {
                    console.log('Model: Forced URL is accessible, loading model');
                    loadModelFromUrl(FORCE_MODEL_URL);
                } else {
                    console.error('Model: Forced URL is not accessible, status:', response.status);
                    // Всё равно попробовать прямую загрузку
                    loadModelFromUrl(FORCE_MODEL_URL);
                }
            })
            .catch(error => {
                console.error('Model: Error checking forced URL accessibility:', error);
                // Всё равно попробовать прямую загрузку
                loadModelFromUrl(FORCE_MODEL_URL);
            });

    }, [glbAnimationUrl, onModelLoad, elementId, elementKeyframes]);

    // Вспомогательная функция для загрузки модели по URL
    const loadModelFromUrl = useCallback((url) => {
        console.log('Model: Loading model from URL:', url);

        // Отслеживать время начала загрузки
        const loadStartTime = Date.now();

        // Логирование сетевого запроса напрямую
        console.log(`Model: Sending direct fetch GET request to ${url}`);

        // Сделать прямой GET-запрос fetch, чтобы явно проверить, доступна ли модель
        fetch(url)
            .then(response => {
                console.log('Model: Fetch response:', {
                    status: response.status,
                    ok: response.ok,
                    type: response.type,
                    url: response.url
                });

                if (!response.ok) {
                    throw new Error(`Model fetch failed with status ${response.status}`);
                }

                return response.blob();
            })
            .then(blob => {
                console.log('Model: Model fetched successfully, blob size:', blob.size);
                // Если мы получили blob, значит URL доступен
            })
            .catch(error => {
                console.error('Model: Direct fetch test failed:', error);
            });

        new GLTFLoader()
            .load(
                url,
                (gltf) => {
                    // Колбэк успешной загрузки
                    const loadEndTime = Date.now();
                    console.log(`Model: Model loaded successfully in ${loadEndTime - loadStartTime}ms`);
                    console.log('Model: Animations found:', gltf.animations ? gltf.animations.length : 0);

                    // Установить пользовательскую модель
                    setCustomModel({ scene: gltf.scene, animations: gltf.animations });

                    // Обновить отладочную информацию
                    setDebugInfo(prev => ({
                        ...prev,
                        modelLoaded: true,
                        animationsCount: gltf.animations ? gltf.animations.length : 0,
                        modelScene: !!gltf.scene,
                        loadUrl: url,
                        loadSuccess: true
                    }));

                    // Передать анимации родителю, если доступны
                    if (onModelLoad && gltf.animations) {
                        onModelLoad(gltf.animations);
                    }

                    // Очистить состояние загрузки
                    setIsLoading(false);
                },
                (progress) => {
                    // Колбэк прогресса
                    const percentComplete = progress.loaded / progress.total * 100;
                    console.log(`Model: Loading progress: ${percentComplete.toFixed(2)}%`);

                    // Обновить отладочную информацию with progress
                    setDebugInfo(prev => ({
                        ...prev,
                        loadProgress: percentComplete,
                        loadUrl: url
                    }));
                },
                (error) => {
                    // Колбэк ошибки
                    console.error('Model: Error loading GLB model:', error);
                    console.error('Model: Failed URL was:', url);

                    // Обновить отладочную информацию with error
                    setDebugInfo(prev => ({
                        ...prev,
                        error: error.message,
                        loadUrl: url,
                        loadSuccess: false
                    }));

                    // Использовать более простой запасной URL как последнее средство
                    const simpleUrl = `/api/uploads/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb`;
                    console.log(`Model: Trying one last fallback URL: ${simpleUrl}`);

                    new GLTFLoader().load(
                        simpleUrl,
                        (gltf) => {
                            console.log('Model: Fallback model loaded successfully');
                            setCustomModel({ scene: gltf.scene, animations: gltf.animations });
                            setDebugInfo(prev => ({
                                ...prev,
                                modelLoaded: true,
                                animationsCount: gltf.animations ? gltf.animations.length : 0,
                                modelScene: !!gltf.scene,
                                fallbackUsed: true,
                                loadUrl: simpleUrl,
                                loadSuccess: true
                            }));
                            if (onModelLoad && gltf.animations) {
                                onModelLoad(gltf.animations);
                            }
                            setIsLoading(false);
                        },
                        null,
                        (fallbackError) => {
                            console.error('Model: Error loading fallback GLB model:', fallbackError);
                            setLoadingError(`Ошибка загрузки модели: ${error.message}. Также не удалось загрузить запасную модель.`);
                            setDebugInfo(prev => ({
                                ...prev,
                                error: error.message + ' + fallback failed',
                                modelLoaded: false,
                                fallbackUrl: simpleUrl,
                                loadSuccess: false
                            }));
                            setIsLoading(false);
                        }
                    );
                }
            );
    }, [onModelLoad]);

    // Инициализировать микшер анимаций
    useEffect(() => {
        if (customModel && customModel.animations && customModel.animations.length > 0) {
            console.log('Model: Model loaded successfully with animations:', customModel.animations);
            console.log('Model: Animation names:', customModel.animations.map(anim => anim.name));

            // Создать новый микшер для текущей модели
            mixer.current = new THREE.AnimationMixer(customModel.scene);
            animationsRef.current = customModel.animations;

            // Сохранить оригинальную длительность анимации модели из первой анимации
            modelDuration.current = customModel.animations[0].duration;
            console.log('Model: Model duration:', modelDuration.current);

            // Передать анимации родителю
            onModelLoad(customModel.animations);

            // Обновить отладочную информацию
            setDebugInfo(prev => ({
                ...prev,
                modelLoaded: true,
                animationsCount: customModel.animations.length,
                modelScene: true
            }));
        } else if (customModel) {
            console.warn('Model: Model loaded but no animations found:', customModel);

            // Обновить отладочную информацию even if no animations
            setDebugInfo(prev => ({
                ...prev,
                modelLoaded: true,
                animationsCount: 0,
                modelScene: true
            }));
        }
    }, [customModel, onModelLoad]);

    // Загрузить внешнюю анимацию
    const loadExternalAnimation = useCallback(async (url) => {
        if (!url || externalAnimations[url]) return;

        try {
            console.log('Model: Loading external animation from URL:', url);

            // Использовать GLTFLoader напрямую
            const loader = new GLTFLoader();

            // Специальная обработка для blob URL
            if (url.startsWith('blob:')) {
                console.log('Model: Detected blob URL for animation, using special handling for local file');
            }

            // Устанавливаем crossOrigin для загрузчика
            THREE.DefaultLoadingManager.crossOrigin = 'anonymous';

            loader.load(
                url,
                (gltf) => {
                    const animations = gltf.animations;

                    if (animations && animations.length > 0) {
                        console.log(`Loaded ${animations.length} animations from ${url}`);

                        // Сохранить анимации с их URL в качестве ключа
                        setExternalAnimations(prev => ({
                            ...prev,
                            [url]: animations
                        }));

                        // Добавить к доступным анимациям
                        const newAnimations = [...animationsRef.current];
                        animations.forEach(anim => {
                            // Установить пользовательское свойство для идентификации внешних анимаций
                            anim.isExternal = true;
                            anim.sourceUrl = url;
                            newAnimations.push(anim);
                        });

                        animationsRef.current = newAnimations;

                        // Уведомить родителя о новых анимациях
                        onModelLoad(newAnimations);
                    }
                },
                (xhr) => {
                    console.log(`Loading animation progress: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
                },
                (error) => {
                    console.error(`Error loading animation from ${url}:`, error);
                }
            );
        } catch (error) {
            console.error(`Error in loadExternalAnimation for ${url}:`, error);
        }
    }, [externalAnimations, onModelLoad]);

    // Обновить активные анимации, когда изменяется свойство activeAnimations
    useEffect(() => {
        if (!mixer.current || !customModel) return;

        // Сначала загрузить любые внешние анимации
        activeAnimations.forEach(anim => {
            if (anim.url) {
                loadExternalAnimation(anim.url);
            }
        });

        // Остановить все текущие действия
        Object.values(activeActionsRef.current).forEach(action => {
            if (action) action.stop();
        });

        // Сбросить активные действия
        activeActionsRef.current = {};

        // Создать новые действия для каждой активной анимации
        activeAnimations.forEach(anim => {
            // Найти анимацию по имени, индексу или из внешнего источника
            let animation;

            if (anim.url && externalAnimations[anim.url]) {
                // Найти анимацию во внешних анимациях
                const externalAnims = externalAnimations[anim.url];
                animation = externalAnims[anim.externalIndex || 0];
            } else {
                // Найти в стандартных анимациях
                animation = typeof anim.index === 'number'
                    ? animationsRef.current[anim.index]
                    : animationsRef.current.find(a => a.name === anim.name);
            }

            if (animation) {
                const action = mixer.current.clipAction(animation);
                action.setLoop(THREE.LoopRepeat);
                action.clampWhenFinished = true;
                action.play();

                // Сохранить ссылку на действие
                activeActionsRef.current[anim.id] = action;

                // Рассчитать правильный timeScale на основе длительности плеера и модели
                let effectiveTimeScale = anim.timeScale || 1;

                // Если у нас есть обе длительности, убедиться, что timeScale установлен правильно
                if (playerDuration && modelDuration.current && animation.duration) {
                    // Это гарантирует, что анимация завершится в пределах длительности плеера
                    const correctTimeScale = playerDuration / animation.duration;

                    // Если timeScale анимации сильно отличается от того, каким он должен быть, обновить его
                    if (Math.abs(effectiveTimeScale - correctTimeScale) > 0.1) {
                        console.log(`ModelViewer: Correcting timeScale from ${effectiveTimeScale} to ${correctTimeScale}`);
                        effectiveTimeScale = correctTimeScale;
                    }
                }

                // Установить масштаб времени
                action.timeScale = effectiveTimeScale;

                // Установить вес, если указан (для смешивания)
                if (typeof anim.weight === 'number') {
                    action.weight = anim.weight;
                }

                console.log('Model: Added animation action:', {
                    id: anim.id,
                    name: animation.name,
                    duration: animation.duration,
                    timeScale: action.timeScale,
                    weight: action.weight
                });
            } else {
                console.warn('Model: Could not find animation for:', anim);
            }
        });

        // Принудительно обновить микшер для применения изменений
        if (mixer.current) {
            mixer.current.update(0);
        }
    }, [activeAnimations, externalAnimations, loadExternalAnimation, customModel, playerDuration, modelDuration]);

    // Найти текущий сегмент анимации на основе маркеров
    const getCurrentAnimationSegment = useCallback(() => {
        if (!animationMarkers || animationMarkers.length === 0) {
            return { start: 0, end: modelDuration.current, modelStart: 0, modelEnd: modelDuration.current };
        }

        // Отсортировать маркеры по времени
        const sortedMarkers = [...animationMarkers].sort((a, b) => a.time - b.time);

        // Найти текущий сегмент
        for (let i = 0; i < sortedMarkers.length - 1; i++) {
            if (currentTime >= sortedMarkers[i].time && currentTime < sortedMarkers[i + 1].time) {
                return {
                    start: sortedMarkers[i].time,
                    end: sortedMarkers[i + 1].time,
                    modelStart: sortedMarkers[i].modelTime,
                    modelEnd: sortedMarkers[i + 1].modelTime
                };
            }
        }

        // Если мы прошли последний маркер, вернуться к первому сегменту
        if (currentTime >= sortedMarkers[sortedMarkers.length - 1].time) {
            return {
                start: sortedMarkers[sortedMarkers.length - 1].time,
                end: playerDuration,
                modelStart: sortedMarkers[sortedMarkers.length - 1].modelTime,
                modelEnd: modelDuration.current
            };
        }

        // По умолчанию использовать первый сегмент
        return {
            start: 0,
            end: sortedMarkers[0]?.time || playerDuration,
            modelStart: 0,
            modelEnd: sortedMarkers[0]?.modelTime || modelDuration.current
        };
    }, [currentTime, animationMarkers, playerDuration]);

    // Найти активную анимацию в текущее время
    const getActiveAnimationAtTime = useCallback(() => {
        if (!activeAnimations || activeAnimations.length === 0) {
            return [];
        }

        // Найти анимации, которые активны в текущее время
        return activeAnimations.filter(anim =>
            currentTime >= anim.start && currentTime <= anim.end
        );
    }, [currentTime, activeAnimations]);

    // Обновить время анимации при перемотке
    useEffect(() => {
        if (mixer.current && !isPlaying) {
            // Получить активные анимации в текущее время
            const activeAnimsAtTime = getActiveAnimationAtTime();

            // Если в это время нет активных анимаций, использовать поведение по умолчанию с маркерами
            if (activeAnimsAtTime.length === 0) {
                let scaledTime;

                if (animationMarkers && animationMarkers.length > 0) {
                    // Использовать маркеры для точного отображения сегментов анимации
                    const segment = getCurrentAnimationSegment();
                    const segmentProgress = (currentTime - segment.start) / (segment.end - segment.start);
                    scaledTime = segment.modelStart + segmentProgress * (segment.modelEnd - segment.modelStart);
                } else {
                    // Масштабирование по умолчанию, когда нет маркеров
                    // Исправление: Обеспечить правильное масштабирование между длительностью плеера и модели
                    // Если время плеера 2.5с в 5с временной шкале, а модель 10с, мы должны быть на 5с в модели
                    scaledTime = playerDuration && modelDuration.current
                        ? (currentTime / playerDuration) * modelDuration.current
                        : currentTime;
                }

                // Применить масштабированное время к микшеру
                mixer.current.time = scaledTime;

                // Принудительно обновить микшер для применения изменений
                mixer.current.update(0);
                return;
            }

            // Для каждой активной анимации установить её время на основе текущего времени плеера
            activeAnimsAtTime.forEach(anim => {
                const action = activeActionsRef.current[anim.id];
                if (action) {
                    // Рассчитать прогресс в пределах временного диапазона этой анимации
                    const animProgress = (currentTime - anim.start) / (anim.end - anim.start);

                    // Рассчитать время модели на основе длительности анимации
                    const animation = animationsRef.current[anim.index];
                    if (animation) {
                        const animDuration = animation.duration;
                        const modelTime = animProgress * animDuration;

                        // Установить время действия напрямую
                        action.time = modelTime;

                        // Принудительно обновить микшер для применения изменений
                        mixer.current.update(0);
                    }
                }
            });
        }
    }, [currentTime, isPlaying, playerDuration, animationMarkers, getCurrentAnimationSegment, getActiveAnimationAtTime]);

    // Цикл анимации с точным таймингом
    const animate = useCallback(() => {
        if (!mixer.current || !isPlaying) return;

        // Используем фиксированный шаг для обновления миксера
        const MODEL_TIME_STEP = 0.016; // ~60 кадров в секунду

        // Обновляем миксер с фиксированным шагом для плавной анимации модели
        mixer.current.update(MODEL_TIME_STEP);

        // Коэффициент масштабирования для синхронизации плеера с анимацией
        // Увеличиваем его, если анимация идёт быстрее плеера
        const PLAYER_SPEED_MULTIPLIER = 5.0; // Подбираем этот коэффициент эмпирически

        // Ускоряем время плеера, чтобы оно соответствовало реальной скорости анимации
        let newTime = currentTime + (MODEL_TIME_STEP * PLAYER_SPEED_MULTIPLIER);

        // Проверка на окончание анимации
        if (newTime >= playerDuration) {
            newTime = 0;
            if (mixer.current) mixer.current.setTime(0);
        }

        // Обновляем время плеера
        onTimeUpdate(newTime);

        // Запрашиваем следующий кадр анимации
        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
        }
    }, [isPlaying, currentTime, playerDuration, onTimeUpdate]);

    // Настройка и очистка кадра анимации
    useEffect(() => {
        if (isPlaying) {
            // Запускаем анимацию
            animationRef.current = requestAnimationFrame(animate);

            // Устанавливаем нормальную скорость для анимаций модели
            if (mixer.current) {
                Object.values(activeActionsRef.current).forEach(action => {
                    if (action) {
                        // Скорость анимации модели оставляем нормальной
                        action.timeScale = 1.0;
                    }
                });
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isPlaying, animate]);

    // Обработка окончания анимации
    useEffect(() => {
        if (mixer.current && playerDuration && currentTime >= playerDuration) {
            onTimeUpdate(0);
            mixer.current.time = 0;
        }
    }, [currentTime, playerDuration, onTimeUpdate]);

    return (
        <>
            {isLoading && (
                <>
                    <mesh position={[0, 0, 0]}>
                        <sphereGeometry args={[0.5, 16, 16]} />
                        <meshStandardMaterial color="gray" wireframe />
                    </mesh>
                </>
            )}

            {loadingError && (
                <>
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color="red" />
                    </mesh>
                    <Html position={[0, 2, 0]}>
                        <div style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.7)', padding: '8px', borderRadius: '4px', maxWidth: '200px' }}>
                            {loadingError}
                        </div>
                    </Html>
                </>
            )}

            {/* Debug information overlay - HIDDEN 
            <Html position={[0, -2.5, 0]}>
                <div style={{
                    color: 'white',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    width: '300px',
                    maxHeight: '200px',
                    overflow: 'auto'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Model Debug Info:</div>
                    <div>URL: {debugInfo.loadUrl || debugInfo.modelUrl || 'None'}</div>
                    <div>Loaded: {debugInfo.modelLoaded ? '✓ Yes' : '✗ No'}</div>
                    <div>Animations: {debugInfo.animationsCount}</div>
                    <div>Scene: {debugInfo.modelScene ? '✓ Yes' : '✗ No'}</div>
                    <div>Fallback: {debugInfo.fallbackUsed ? '✓ Yes' : '✗ No'}</div>
                    <div>Origin: {window.location.origin}</div>
                    {debugInfo.loadProgress && <div>Load Progress: {debugInfo.loadProgress.toFixed(0)}%</div>}
                    {debugInfo.error && <div style={{ color: 'red' }}>Error: {debugInfo.error}</div>}
                    <button
                        style={{
                            marginTop: '10px',
                            background: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            // Перезагрузить с запасным URL
                            const fallbackUrl = `/api/uploads/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb`;
                            console.log('Manual reload with fallback URL:', fallbackUrl);
                            loadModelFromUrl(fallbackUrl);
                        }}
                    >
                        Reload with Fallback
                    </button>
                </div>
            </Html>
            */}

            {/* Add axis helper for orientation - HIDDEN 
            <axesHelper args={[5]} />
            */}

            {!isLoading && !loadingError && customModel && (
                <>
                    {/* Render the custom model */}
                    <primitive
                        object={customModel.scene}
                        scale={[1.0, 1.0, 1.0]}
                        position={[0, -1, 0]}
                        rotation={[0, 0, 0]}
                    />
                </>
            )}
        </>
    );
};

// Пользовательский слайдер с маркерами
const MarkedSlider = ({ value, min, max, onChange, markers = [], disabled, onMarkerAdd, onMarkerEdit, onMarkerDelete }) => {
    const getMarkerPosition = (time) => ((time - min) / (max - min)) * 100;

    return (
        <MuiBox sx={{ position: 'relative', width: '100%', mx: 2 }}>
            <Slider
                value={value}
                min={min}
                max={max}
                onChange={onChange}
                step={0.001}
                disabled={disabled}
                sx={{ zIndex: 1 }}
            />
            {markers.map((marker, index) => (
                <Tooltip
                    key={index}
                    title={`${marker.label || `Маркер ${index + 1}`} (${marker.time.toFixed(2)}с)`}
                    arrow
                >
                    <MuiBox
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkerEdit(index);
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            onMarkerDelete(index);
                        }}
                        sx={{
                            position: 'absolute',
                            left: `${getMarkerPosition(marker.time)}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '12px',
                            height: '12px',
                            backgroundColor: marker.color || '#f44336',
                            borderRadius: '50%',
                            border: '2px solid white',
                            zIndex: 2,
                            cursor: 'pointer',
                            '&:hover': {
                                transform: 'translate(-50%, -50%) scale(1.2)',
                                boxShadow: '0 0 5px rgba(0,0,0,0.3)'
                            }
                        }}
                    />
                </Tooltip>
            ))}
            <IconButton
                size="small"
                onClick={onMarkerAdd}
                sx={{
                    position: 'absolute',
                    right: '-30px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.2)'
                    }
                }}
            >
                <AddCircleOutline fontSize="small" />
            </IconButton>
        </MuiBox>
    );
};

// Компонент управления анимацией
const AnimationManager = ({ animations = [], activeAnimations = [], onAnimationsChange }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedAnimIndex, setSelectedAnimIndex] = useState(null);
    const [animationDialogOpen, setAnimationDialogOpen] = useState(false);
    const [currentAnimation, setCurrentAnimation] = useState(null);

    // Состояние формы диалога анимации
    const [animName, setAnimName] = useState('');
    const [animIndex, setAnimIndex] = useState(0);
    const [animStart, setAnimStart] = useState(0);
    const [animEnd, setAnimEnd] = useState(10);
    const [animWeight, setAnimWeight] = useState(1);
    const [animTimeScale, setAnimTimeScale] = useState(1);
    const [animExternalIndex, setAnimExternalIndex] = useState(0);

    // Сгенерировать уникальный ID для новых анимаций
    const generateUniqueId = () => {
        return 'anim_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    };

    // Открыть контекстное меню для анимации
    const handleAnimationMenuOpen = (event, index) => {
        event.preventDefault();
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
        setSelectedAnimIndex(index);
    };

    // Закрыть контекстное меню
    const handleAnimationMenuClose = () => {
        setAnchorEl(null);
        setSelectedAnimIndex(null);
    };

    // Открыть диалог для добавления новой анимации
    const handleAddAnimation = () => {
        setCurrentAnimation(null);

        // Установить значения по умолчанию для новой анимации
        setAnimName('');
        setAnimIndex(0);
        setAnimStart(0);
        setAnimEnd(10);
        setAnimWeight(1);
        setAnimTimeScale(1);
        setAnimExternalIndex(0);

        setAnimationDialogOpen(true);
    };

    // Открыть диалог для редактирования существующей анимации
    const handleEditAnimation = () => {
        const anim = activeAnimations[selectedAnimIndex];

        setCurrentAnimation(anim);
        setAnimName(anim.name || '');
        setAnimIndex(anim.index || 0);
        setAnimStart(anim.start || 0);
        setAnimEnd(anim.end || 10);
        setAnimWeight(anim.weight || 1);
        setAnimTimeScale(anim.timeScale || 1);
        setAnimExternalIndex(anim.externalIndex || 0);

        setAnimationDialogOpen(true);
        handleAnimationMenuClose();
    };

    // Удалить анимацию
    const handleDeleteAnimation = () => {
        const newAnimations = [...activeAnimations];
        newAnimations.splice(selectedAnimIndex, 1);
        onAnimationsChange(newAnimations);
        handleAnimationMenuClose();
    };

    // Сохранить изменения анимации
    const handleSaveAnimation = () => {
        if (currentAnimation) {
            // Обновить существующую анимацию
            const newAnimations = activeAnimations.map(anim =>
                anim.id === currentAnimation.id
                    ? {
                        ...anim,
                        name: animName,
                        index: animIndex,
                        start: animStart,
                        end: animEnd,
                        weight: animWeight,
                        timeScale: animTimeScale,
                        externalIndex: animExternalIndex
                    }
                    : anim
            );
            onAnimationsChange(newAnimations);
        } else {
            // Добавить новую анимацию
            const newAnimation = {
                id: generateUniqueId(),
                name: animName,
                index: animIndex,
                start: animStart,
                end: animEnd,
                weight: animWeight,
                timeScale: animTimeScale,
                externalIndex: animExternalIndex
            };
            onAnimationsChange([...activeAnimations, newAnimation]);
        }

        setAnimationDialogOpen(false);
    };

    return (
        <>
            <MuiBox sx={{ width: '100%', mt: 2, color: 'white' }}>
                <Typography variant="subtitle1" gutterBottom>
                    Анимации ({activeAnimations.length})
                    <IconButton
                        size="small"
                        onClick={handleAddAnimation}
                        sx={{ ml: 1, color: 'white' }}
                    >
                        <AddCircleOutline />
                    </IconButton>
                </Typography>

                {activeAnimations.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        Нет активных анимаций. Нажмите + чтобы добавить анимацию.
                    </Typography>
                ) : (
                    <List dense sx={{ bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1 }}>
                        {activeAnimations.map((anim, index) => (
                            <ListItem
                                key={anim.id}
                                sx={{
                                    borderBottom: index < activeAnimations.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                }}
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        size="small"
                                        onClick={(e) => handleAnimationMenuOpen(e, index)}
                                        sx={{ color: 'white' }}
                                    >
                                        <Edit fontSize="small" />
                                    </IconButton>
                                }
                            >
                                <DragIndicator sx={{ mr: 1, opacity: 0.5, fontSize: '1rem' }} />
                                <ListItemText
                                    primary={anim.name || `Анимация ${animations[anim.index]?.name || anim.index}`}
                                    secondary={
                                        <>
                                            {`${anim.start}с - ${anim.end}с (скорость: ${anim.timeScale}x)`}
                                        </>
                                    }
                                    primaryTypographyProps={{ variant: 'body2' }}
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </MuiBox>

            {/* Контекстное меню анимации */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleAnimationMenuClose}
            >
                <MenuItem onClick={handleEditAnimation}>
                    <Edit fontSize="small" sx={{ mr: 1 }} /> Редактировать
                </MenuItem>
                <MenuItem onClick={handleDeleteAnimation}>
                    <Delete fontSize="small" sx={{ mr: 1 }} /> Удалить
                </MenuItem>
            </Menu>

            {/* Диалог редактирования анимации */}
            <Dialog open={animationDialogOpen} onClose={() => setAnimationDialogOpen(false)}>
                <DialogTitle>
                    {currentAnimation ? 'Редактировать анимацию' : 'Добавить анимацию'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        margin="dense"
                        label="Название"
                        type="text"
                        fullWidth
                        value={animName}
                        onChange={(e) => setAnimName(e.target.value)}
                        sx={{ mb: 2 }}
                    />

                    {/* Выбор анимации */}
                    <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
                        <InputLabel>Анимация</InputLabel>
                        <Select
                            value={animIndex}
                            onChange={(e) => setAnimIndex(Number(e.target.value))}
                            label="Анимация"
                        >
                            {animations.map((anim, index) => (
                                <MenuItem key={index} value={index}>
                                    {anim.name || `Анимация ${index + 1}`}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        margin="dense"
                        label="Начало (секунды)"
                        type="number"
                        fullWidth
                        value={animStart}
                        onChange={(e) => setAnimStart(Number(e.target.value))}
                        inputProps={{ step: 0.1, min: 0 }}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        margin="dense"
                        label="Конец (секунды)"
                        type="number"
                        fullWidth
                        value={animEnd}
                        onChange={(e) => setAnimEnd(Number(e.target.value))}
                        inputProps={{ step: 0.1, min: animStart }}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        margin="dense"
                        label="Вес (для смешивания)"
                        type="number"
                        fullWidth
                        value={animWeight}
                        onChange={(e) => setAnimWeight(Number(e.target.value))}
                        inputProps={{ step: 0.1, min: 0, max: 1 }}
                        sx={{ mb: 2 }}
                        helperText="От 0 до 1, используется для смешивания анимаций"
                    />

                    <TextField
                        margin="dense"
                        label="Скорость воспроизведения"
                        type="number"
                        fullWidth
                        value={animTimeScale}
                        onChange={(e) => setAnimTimeScale(Number(e.target.value))}
                        inputProps={{ step: 0.1, min: 0.1 }}
                        helperText="1 = нормальная скорость, 0.5 = замедленно, 2 = ускоренно"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAnimationDialogOpen(false)}>Отмена</Button>
                    <Button onClick={handleSaveAnimation} color="primary">Сохранить</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

// Компонент временной шкалы анимации
const AnimationTimeline = ({ animations = [], activeAnimations = [], duration = 60, currentTime = 0, onAnimationsChange }) => {
    const [draggingAnimation, setDraggingAnimation] = useState(null);
    const [draggingEdge, setDraggingEdge] = useState(null); // 'start' или 'end'
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartTime, setDragStartTime] = useState(0);
    const timelineRef = useRef(null);

    // Рассчитать позицию на временной шкале из времени
    const getPositionFromTime = (time) => {
        return (time / duration) * 100;
    };

    // Рассчитать время из позиции на временной шкале
    const getTimeFromPosition = (position, width) => {
        const percent = position / width;
        return Math.max(0, Math.min(duration, percent * duration));
    };

    // Начать перетаскивание анимации
    const handleDragStart = (e, animId, edge = null) => {
        e.preventDefault();
        e.stopPropagation();

        const timelineRect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - timelineRect.left;

        setDraggingAnimation(animId);
        setDraggingEdge(edge);
        setDragStartX(mouseX);

        // Найти перетаскиваемую анимацию
        const anim = activeAnimations.find(a => a.id === animId);
        if (anim) {
            setDragStartTime(edge === 'start' ? anim.start : edge === 'end' ? anim.end : anim.start);
        }

        // Добавить обработчики событий for drag and drop
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    };

    // Обработка движения перетаскивания
    const handleDragMove = (e) => {
        if (!draggingAnimation || !timelineRef.current) return;

        const timelineRect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - timelineRect.left;
        const deltaX = mouseX - dragStartX;

        // Рассчитать разницу времени на основе расстояния перетаскивания
        const timeDelta = getTimeFromPosition(deltaX, timelineRect.width);

        // Обновить позицию или длину анимации
        const newAnimations = activeAnimations.map(anim => {
            if (anim.id !== draggingAnimation) return anim;

            if (draggingEdge === 'start') {
                // Перетаскивание начального края - обновить время начала
                const newStart = Math.max(0, Math.min(anim.end - 0.5, dragStartTime + timeDelta));
                return { ...anim, start: newStart };
            } else if (draggingEdge === 'end') {
                // Перетаскивание конечного края - обновить время окончания
                const newEnd = Math.max(anim.start + 0.5, Math.min(duration, dragStartTime + timeDelta));
                return { ...anim, end: newEnd };
            } else {
                // Перетаскивание всей анимации - переместить и начало, и конец
                const newStart = Math.max(0, dragStartTime + timeDelta);
                const animDuration = anim.end - anim.start;
                const newEnd = Math.min(duration, newStart + animDuration);

                // Если мы достигли правого края, подкорректировать начало для сохранения длительности
                if (newEnd === duration) {
                    return { ...anim, start: duration - animDuration, end: duration };
                }

                return { ...anim, start: newStart, end: newEnd };
            }
        });

        onAnimationsChange(newAnimations);
    };

    // Завершить перетаскивание
    const handleDragEnd = () => {
        setDraggingAnimation(null);
        setDraggingEdge(null);

        // Удалить обработчики событий
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
    };

    // Сгенерировать цвет для анимации на основе её индекса
    const getAnimationColor = (index) => {
        const colors = [
            '#4caf50', '#2196f3', '#f44336', '#ff9800', '#9c27b0',
            '#00bcd4', '#ffeb3b', '#795548', '#607d8b', '#e91e63'
        ];
        return colors[index % colors.length];
    };

    return (
        <MuiBox sx={{ width: '100%', mt: 2 }}>
            <Typography variant="subtitle2" sx={{ color: 'white', mb: 1 }}>
                Временная шкала анимаций
            </Typography>

            <MuiBox
                ref={timelineRef}
                sx={{
                    position: 'relative',
                    width: '100%',
                    height: '80px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'pointer'
                }}
            >
                {/* Временные маркеры */}
                {Array.from({ length: Math.floor(duration / 5) + 1 }).map((_, i) => (
                    <MuiBox
                        key={i}
                        sx={{
                            position: 'absolute',
                            left: `${(i * 5 / duration) * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: '1px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            zIndex: 1,
                            '&::after': {
                                content: `"${i * 5}s"`,
                                position: 'absolute',
                                top: '2px',
                                left: '4px',
                                fontSize: '10px',
                                color: 'rgba(255,255,255,0.5)'
                            }
                        }}
                    />
                ))}

                {/* Индикатор текущего времени */}
                <MuiBox
                    sx={{
                        position: 'absolute',
                        left: `${getPositionFromTime(currentTime)}%`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: 'white',
                        zIndex: 3
                    }}
                />

                {/* Блоки анимаций */}
                {activeAnimations.map((anim, index) => (
                    <MuiBox
                        key={anim.id}
                        sx={{
                            position: 'absolute',
                            left: `${getPositionFromTime(anim.start)}%`,
                            width: `${getPositionFromTime(anim.end - anim.start)}%`,
                            top: `${10 + (index % 3) * 20}px`,
                            height: '18px',
                            backgroundColor: getAnimationColor(index),
                            borderRadius: '4px',
                            zIndex: 2,
                            opacity: draggingAnimation === anim.id ? 0.7 : 0.9,
                            cursor: 'move',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            fontSize: '10px',
                            padding: '2px 4px',
                            color: 'white',
                            boxSizing: 'border-box',
                            border: '1px solid rgba(255,255,255,0.3)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            userSelect: 'none',
                            '&:hover': {
                                boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                            }
                        }}
                        onMouseDown={(e) => handleDragStart(e, anim.id)}
                    >
                        {anim.name || `Анимация ${animations[anim.index]?.name || anim.index}`}

                        {/* Маркеры изменения размера */}
                        <MuiBox
                            sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: '6px',
                                cursor: 'w-resize',
                                '&:hover': {
                                    backgroundColor: 'rgba(255,255,255,0.3)'
                                }
                            }}
                            onMouseDown={(e) => handleDragStart(e, anim.id, 'start')}
                        />
                        <MuiBox
                            sx={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '6px',
                                cursor: 'e-resize',
                                '&:hover': {
                                    backgroundColor: 'rgba(255,255,255,0.3)'
                                }
                            }}
                            onMouseDown={(e) => handleDragStart(e, anim.id, 'end')}
                        />
                    </MuiBox>
                ))}
            </MuiBox>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                Перетаскивайте блоки для изменения позиции. Растягивайте за края для изменения длительности.
            </Typography>
        </MuiBox>
    );
};

const ModelViewer = ({ isVisible, onClose, playerDuration, currentTime: initialTime = 0, isPlaying: initialPlaying = false, onTimeUpdate: externalTimeUpdate, elementKeyframes = [], elementId = null, embedded = false, onSaveAnimations = null, glbAnimationUrl = null }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(initialPlaying);
    const [currentTime, setCurrentTime] = useState(initialTime);
    const [duration, setDuration] = useState(playerDuration || 60); // Использовать длительность плеера, если предоставлена
    const [modelLoaded, setModelLoaded] = useState(false);
    const [animationMarkers, setAnimationMarkers] = useState([
        { time: 0, modelTime: 0, label: 'Начало', color: '#4caf50' }
    ]);
    const [markerDialogOpen, setMarkerDialogOpen] = useState(false);
    const [currentMarker, setCurrentMarker] = useState(null);
    const [newMarkerTime, setNewMarkerTime] = useState(0);
    const [newMarkerModelTime, setNewMarkerModelTime] = useState(0);
    const [newMarkerLabel, setNewMarkerLabel] = useState('');
    const [newMarkerColor, setNewMarkerColor] = useState('#f44336');
    const [modelDuration, setModelDuration] = useState(0);
    const [activeAnimations, setActiveAnimations] = useState([]);
    const [availableAnimations, setAvailableAnimations] = useState([]);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveAnimationName, setSaveAnimationName] = useState('');
    const [savedAnimations, setSavedAnimations] = useState([]);
    const [loadDialogOpen, setLoadDialogOpen] = useState(false);
    const prevElementIdRef = useRef(null);
    const [selectedModel, setSelectedModel] = useState(null);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const fileInputRef = useRef(null);
    const [glbUrl, setGlbUrl] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

    // Дополнительные состояния для отсутствующих переменных
    const [isLoadingModel, setIsLoadingModel] = useState(false);
    const [tabIndex, setTabIndex] = useState(0);
    const [animations, setAnimations] = useState([]);
    const [glbInputUrl, setGlbInputUrl] = useState('');

    // Добавить эти отсутствующие функции-обработчики
    const handleCloseViewerConfirm = () => {
        // Проверить, есть ли несохраненные изменения
        if (hasUnsavedChanges) {
            setConfirmDialogOpen(true);
        } else {
            closeViewerWithoutSaving();
        }
    };

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue);
    };

    const handleSaveModelWithAnimation = () => {
        // Сохранить и настройки модели, и анимации
        handleSaveModel();
        if (onSaveAnimations) {
            onSaveAnimations(activeAnimations);
        }
        onClose();
    };

    // Загрузить сохраненные анимации из localStorage при монтировании компонента
    useEffect(() => {
        console.log('ModelViewer: Component mounted, checking for saved animations');

        const loadSavedAnimations = () => {
            try {
                const savedData = localStorage.getItem('savedAnimations');
                if (savedData) {
                    const parsed = JSON.parse(savedData);
                    setSavedAnimations(parsed);
                    console.log(`ModelViewer: Loaded ${parsed.length} saved animations from localStorage`);
                } else {
                    console.log('ModelViewer: No saved animations found in localStorage');
                }
            } catch (error) {
                console.error('Error loading saved animations:', error);
            }
        };

        loadSavedAnimations();

        // Если у нас есть elementId и элемент содержит сохраненные анимации,
        // загружаем их из свойств элемента
        if (elementId && elementKeyframes && elementKeyframes.length > 0) {
            console.log('ModelViewer: Found element keyframes, checking for saved animations');

            // Проверить, имеет ли какой-либо ключевой кадр наш elementId
            const matchingKeyframes = elementKeyframes.filter(kf => kf.elementId === elementId || kf.id === elementId);

            if (matchingKeyframes.length > 0) {
                console.log('ModelViewer: Found matching keyframes for element ID:', elementId);

                // Проверить наличие glbAnimations в любом подходящем ключевом кадре
                const keyframeWithAnimations = matchingKeyframes.find(kf => kf.glbAnimations && kf.glbAnimations.length > 0);

                if (keyframeWithAnimations) {
                    console.log('ModelViewer: Loading saved animations from keyframe:', keyframeWithAnimations.glbAnimations);
                    setSavedAnimations(keyframeWithAnimations.glbAnimations);

                    // Если у этого ключевого кадра есть modelPath, использовать его
                    if (keyframeWithAnimations.modelPath && !selectedModel && !glbAnimationUrl) {
                        console.log('ModelViewer: Using modelPath from keyframe:', keyframeWithAnimations.modelPath);

                        setSelectedModel({
                            url: keyframeWithAnimations.modelPath,
                            name: keyframeWithAnimations.modelName || 'Saved Model',
                            id: keyframeWithAnimations.modelId
                        });
                    }
                } else {
                    console.log('ModelViewer: No glbAnimations found in matching keyframes');
                }
            } else {
                console.warn(`ModelViewer: Element with ID ${elementId} not found in keyframes`);
            }
        } else {
            console.log('ModelViewer: No element keyframes available or no elementId provided', {
                hasElementId: !!elementId,
                hasKeyframes: !!elementKeyframes,
                keyframesLength: elementKeyframes ? elementKeyframes.length : 0
            });
        }
    }, [elementId, elementKeyframes, selectedModel, glbAnimationUrl]);

    // Обновить состояние, когда изменяются пропсы
    useEffect(() => {
        if (playerDuration) {
            setDuration(playerDuration);

            // Обновить timeScale активных анимаций, когда изменяется playerDuration
            if (modelDuration && activeAnimations.length > 0) {
                // Рассчитать новый timeScale на основе соотношения длительности плеера к длительности модели
                const newTimeScale = playerDuration / modelDuration;

                // Обновить все активные анимации с новым timeScale
                setActiveAnimations(current =>
                    current.map(anim => ({
                        ...anim,
                        end: Math.min(anim.end, playerDuration), // Убедиться, что время окончания не превышает длительность плеера
                        timeScale: newTimeScale
                    }))
                );

                console.log(`ModelViewer: Updated animation timeScale to ${newTimeScale} for playerDuration ${playerDuration}`);
            }
        }
    }, [playerDuration, modelDuration]);

    useEffect(() => {
        setCurrentTime(initialTime);
    }, [initialTime]);

    useEffect(() => {
        setIsPlaying(initialPlaying);
    }, [initialPlaying]);

    // Синхронизировать маркеры с ключевыми кадрами элемента, когда они изменяются или когда меняется элемент
    useEffect(() => {
        // Обновлять маркеры только если у нас есть действительные ключевые кадры и либо элемент изменился, либо это начальная настройка
        if (elementKeyframes && elementKeyframes.length > 0 && (elementId !== prevElementIdRef.current || prevElementIdRef.current === null)) {
            console.log(`Syncing markers with ${elementKeyframes.length} keyframes from element ${elementId}`);

            // Найдем элемент в keyframes по ID
            const element = elementKeyframes.find(kf =>
                kf.id === elementId ||
                kf.elementId === elementId
            );

            if (element) {
                console.log('ModelViewer: Found matching element in keyframes:', element);

                // Если у элемента есть свои keyframes, используем их
                const keyframes = element.keyframes || [];

                if (keyframes.length > 0) {
                    console.log(`ModelViewer: Using ${keyframes.length} keyframes from element`);

                    // Преобразовать ключевые кадры элемента в маркеры анимации
                    const newMarkers = keyframes.map((keyframe, index) => {
                        // Убедиться, что у ключевого кадра действительное время
                        if (typeof keyframe.time !== 'number' || isNaN(keyframe.time)) {
                            console.warn(`Invalid keyframe time at index ${index}:`, keyframe);
                            return null;
                        }

                        // Рассчитать время модели пропорционально, если оно еще не установлено
                        // Для первого маркера использовать начало анимации модели
                        // Для последующих маркеров распределить пропорционально по длительности модели
                        const modelTime = index === 0 ? 0 : (keyframe.time / playerDuration) * modelDuration;

                        return {
                            time: keyframe.time,
                            modelTime: modelTime,
                            label: `Ключевой кадр ${index + 1}`,
                            color: index === 0 ? '#4caf50' : '#f44336'
                        };
                    }).filter(marker => marker !== null);

                    // Отсортировать маркеры по времени
                    newMarkers.sort((a, b) => a.time - b.time);

                    // Всегда убеждаться, что у нас есть хотя бы начальный маркер
                    if (newMarkers.length === 0) {
                        newMarkers.push({
                            time: 0,
                            modelTime: 0,
                            label: 'Начало',
                            color: '#4caf50'
                        });
                    }

                    // Всегда убеждаться, что у нас есть конечный маркер
                    const hasEndMarker = newMarkers.some(marker => marker.time === playerDuration);
                    if (!hasEndMarker && playerDuration) {
                        newMarkers.push({
                            time: playerDuration,
                            modelTime: modelDuration || playerDuration,
                            label: 'Конец',
                            color: '#f44336'
                        });
                    }

                    setAnimationMarkers(newMarkers);

                    // Если у элемента есть сохраненные glbAnimations, используем их
                    if (element.glbAnimations && element.glbAnimations.length > 0) {
                        console.log('ModelViewer: Using saved glbAnimations from element:', element.glbAnimations);
                        setSavedAnimations(element.glbAnimations);

                        // Создаем активные анимации на основе сохраненных
                        if (activeAnimations.length === 0) {
                            const newActiveAnimations = element.glbAnimations.map(anim => ({
                                id: anim.id || `anim_${Date.now()}_${Math.random()}`,
                                name: anim.name || 'Анимация',
                                index: anim.index || 0,
                                start: 0,
                                end: playerDuration || modelDuration || 10,
                                weight: 1,
                                timeScale: 1
                            }));

                            console.log('ModelViewer: Created active animations from saved ones:', newActiveAnimations);
                            setActiveAnimations(newActiveAnimations);
                        }
                    }
                } else {
                    console.log('ModelViewer: Element has no keyframes, using default markers');

                    // Создать маркеры по умолчанию
                    const newMarkers = [
                        {
                            time: 0,
                            modelTime: 0,
                            label: 'Начало',
                            color: '#4caf50'
                        }
                    ];

                    // Добавить конечный маркер, если у нас есть длительность
                    if (playerDuration) {
                        newMarkers.push({
                            time: playerDuration,
                            modelTime: modelDuration || playerDuration,
                            label: 'Конец',
                            color: '#f44336'
                        });
                    }

                    setAnimationMarkers(newMarkers);
                }
            } else {
                console.warn(`ModelViewer: Element with ID ${elementId} not found in keyframes`);

                // Создать маркеры по умолчанию
                const newMarkers = [
                    {
                        time: 0,
                        modelTime: 0,
                        label: 'Начало',
                        color: '#4caf50'
                    }
                ];

                // Добавить конечный маркер, если у нас есть длительность
                if (playerDuration) {
                    newMarkers.push({
                        time: playerDuration,
                        modelTime: modelDuration || playerDuration,
                        label: 'Конец',
                        color: '#f44336'
                    });
                }

                setAnimationMarkers(newMarkers);
            }

            prevElementIdRef.current = elementId;
        }
    }, [elementKeyframes, elementId, playerDuration, modelDuration, activeAnimations.length]);

    useEffect(() => {
        // Имитировать загрузку движка
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    // Форматировать время в ММ:СС
    const formatTime = (timeInSeconds) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // Обработать изменение слайдера времени с миллисекундной точностью
    const handleTimeChange = (_, newValue) => {
        const time = Number(newValue.toFixed(3)); // Сохранить 3 десятичных знака для миллисекунд
        setCurrentTime(time);
        if (externalTimeUpdate) {
            externalTimeUpdate(time);
        }
    };

    // Обработать воспроизведение/паузу
    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    // Обработать обновление времени из анимации
    const handleTimeUpdate = useCallback((newTime) => {
        setCurrentTime(newTime);
        if (externalTimeUpdate) {
            externalTimeUpdate(newTime);
        }
    }, [externalTimeUpdate]);

    // Обработать загрузку модели
    const handleModelLoad = useCallback((animations) => {
        if (animations && animations.length > 0) {
            const animDuration = animations[0].duration;
            setModelDuration(animDuration);
            setAvailableAnimations(animations);

            // Использовать длительность модели, только если не предоставлена длительность плеера
            if (!playerDuration) {
                setDuration(animDuration);
            }

            // Автоматически добавляем первую анимацию из модели
            setActiveAnimations(current => {
                // Если уже есть анимации, не добавляем новую
                if (current && current.length > 0) {
                    return current;
                }

                // Исправление: Инвертировать расчет timeScale, чтобы анимация воспроизводилась с правильной скоростью
                // Если длительность модели 10с, а длительность плеера 5с, нам нужно воспроизводить со скоростью 2x
                const timeScale = playerDuration && animDuration ? playerDuration / animDuration : 1;

                // Добавляем первую анимацию из загруженной модели
                const newAnimation = {
                    id: 'anim_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    name: animations[0].name || 'Анимация 1',
                    index: 0,
                    start: 0,
                    end: playerDuration || animDuration,
                    weight: 1,
                    timeScale: timeScale // Исправленный timeScale
                };

                return [newAnimation];
            });

            setModelLoaded(true);

            // Если у нас уже есть ключевые кадры элемента, не добавлять здесь конечный маркер
            // так как это будет обработано эффектом, который синхронизируется с ключевыми кадрами элемента
            if (elementKeyframes.length === 0) {
                // Добавить конечный маркер, если он не существует
                setAnimationMarkers(current => {
                    const hasEndMarker = current.some(marker => marker.time === playerDuration);
                    if (!hasEndMarker) {
                        return [
                            ...current,
                            {
                                time: playerDuration || animDuration,
                                modelTime: animDuration,
                                label: 'Конец',
                                color: '#f44336'
                            }
                        ];
                    }
                    return current;
                });
            }
        }
    }, [playerDuration, elementKeyframes]);

    // Добавить новый маркер
    const handleAddMarker = () => {
        setCurrentMarker(null);
        setNewMarkerTime(currentTime);
        setNewMarkerModelTime(modelDuration / 2); // По умолчанию к середине анимации модели
        setNewMarkerLabel(`Маркер ${animationMarkers.length + 1}`);
        setNewMarkerColor('#f44336');
        setMarkerDialogOpen(true);
    };

    // Редактировать существующий маркер
    const handleEditMarker = (index) => {
        const marker = animationMarkers[index];
        setCurrentMarker(index);
        setNewMarkerTime(marker.time);
        setNewMarkerModelTime(marker.modelTime || 0);
        setNewMarkerLabel(marker.label || `Маркер ${index + 1}`);
        setNewMarkerColor(marker.color || '#f44336');
        setMarkerDialogOpen(true);
    };

    // Удалить маркер
    const handleDeleteMarker = (index) => {
        // Не позволять удалять первый маркер (начальную точку)
        if (index === 0) return;

        setAnimationMarkers(current => current.filter((_, i) => i !== index));
    };

    // Сохранить изменения маркера
    const handleSaveMarker = () => {
        if (currentMarker !== null) {
            // Редактировать существующий маркер
            setAnimationMarkers(current => {
                const updated = [...current];
                updated[currentMarker] = {
                    time: newMarkerTime,
                    modelTime: newMarkerModelTime,
                    label: newMarkerLabel,
                    color: newMarkerColor
                };
                return updated.sort((a, b) => a.time - b.time);
            });
        } else {
            // Добавить новый маркер
            setAnimationMarkers(current => {
                return [...current, {
                    time: newMarkerTime,
                    modelTime: newMarkerModelTime,
                    label: newMarkerLabel,
                    color: newMarkerColor
                }].sort((a, b) => a.time - b.time);
            });
        }
        setMarkerDialogOpen(false);
    };

    // Обработать изменение анимаций
    const handleAnimationsChange = useCallback((newAnimations) => {
        setActiveAnimations(newAnimations);
    }, []);

    // Открыть диалог сохранения
    const handleOpenSaveDialog = () => {
        setSaveAnimationName('');
        setSaveDialogOpen(true);
    };

    // Сохранить текущие анимации
    const handleSaveAnimations = () => {
        if (!saveAnimationName.trim()) return;

        try {
            // Создать объект пресета анимации
            const animationPreset = {
                id: `preset_${Date.now()}`,
                name: saveAnimationName,
                animations: activeAnimations,
                markers: animationMarkers,
                createdAt: new Date().toISOString()
            };

            // Добавить к сохраненным анимациям
            const updatedSavedAnimations = [...savedAnimations, animationPreset];
            setSavedAnimations(updatedSavedAnimations);

            // Сохранить в localStorage
            localStorage.setItem('savedAnimations', JSON.stringify(updatedSavedAnimations));

            // Если предоставлен колбэк onSaveAnimations, вызвать его
            if (onSaveAnimations) {
                onSaveAnimations(updatedSavedAnimations);
            }

            // Закрыть диалог
            setSaveDialogOpen(false);
        } catch (error) {
            console.error('Error saving animations:', error);
            // Показать уведомление об ошибке
        }
    };

    // Открыть диалог загрузки
    const handleOpenLoadDialog = () => {
        setLoadDialogOpen(true);
    };

    // Загрузить сохраненный пресет анимации
    const handleLoadAnimationPreset = (preset) => {
        if (!preset) return;

        // Установить активные анимации из пресета
        if (preset.animations && preset.animations.length > 0) {
            setActiveAnimations(preset.animations);
        }

        // Установить маркеры из пресета, если доступны
        if (preset.markers && preset.markers.length > 0) {
            setAnimationMarkers(preset.markers);
        }

        // Закрыть диалог
        setLoadDialogOpen(false);
    };

    // Удалить сохраненный пресет анимации
    const handleDeleteAnimationPreset = (presetId) => {
        const updatedSavedAnimations = savedAnimations.filter(preset => preset.id !== presetId);
        setSavedAnimations(updatedSavedAnimations);
        localStorage.setItem('savedAnimations', JSON.stringify(updatedSavedAnimations));
    };

    // Обработать выбор модели из загрузчика
    const handleModelSelect = (model) => {
        console.log('Selected model:', model);
        setSelectedModel(model);

        // Обновить glbAnimationUrl для использования выбранной модели
        // Это вызовет useEffect в Model для загрузки новой модели
        if (model && model.url) {
            // Мы будем использовать этот URL для загрузки модели
            console.log('Setting model URL:', model.url);

            // Сохранить URL модели немедленно, чтобы убедиться, что он не потерян
            if (onSaveAnimations) {
                const dataToSave = {
                    animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
                    modelUrl: model.url,
                    visible: true,
                    style: {
                        opacity: 1
                    }
                };

                // Если это blob URL, отметить его как локальный файл
                if (model.url.startsWith('blob:')) {
                    dataToSave.isLocalFile = true;
                    dataToSave.modelName = model.name || 'Uploaded Model';
                }

                console.log('ModelViewer: Saving model URL after selection:', model.url);
                onSaveAnimations(dataToSave, elementId);
            }
        }
    };

    // Обработать открытие диалога загрузки
    const handleOpenUploadDialog = () => {
        console.log('ModelViewer: Opening upload dialog');
        setUploadDialogOpen(true);
    };

    // Обработать закрытие диалога загрузки
    const handleCloseUploadDialog = () => {
        setUploadDialogOpen(false);
    };

    // Загрузить модель на сервер
    const uploadModelToServer = async (file) => {
        console.log('ModelViewer: Uploading model to server:', file.name);
        setIsLoading(true);

        try {
            // Получить токен аутентификации из localStorage
            const token = localStorage.getItem('token');

            if (!token) {
                console.error('ModelViewer: No authentication token found');
                throw new Error('Authentication required. Please log in.');
            }

            // Создать данные формы
            const formData = new FormData();
            formData.append('model', file);
            formData.append('name', file.name.split('.')[0]);

            // Получить URL API из окружения или использовать значение по умолчанию
            const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

            // Загрузить на сервер с аутентификацией
            const response = await fetch(`${API_URL}/models/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Upload failed with status: ${response.status}`);
            }

            const modelData = await response.json();
            console.log('ModelViewer: Model uploaded successfully:', modelData);

            // Создать объект модели с URL сервера
            const modelObj = {
                url: modelData.url,
                name: modelData.name,
                id: modelData.id
            };

            // Установить выбранную модель
            setSelectedModel(modelObj);

            // Немедленно сохранить URL модели
            if (onSaveAnimations) {
                const dataToSave = {
                    animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
                    modelUrl: modelData.url,
                    modelId: modelData.id,
                    visible: true,
                    style: {
                        opacity: 1
                    }
                };

                console.log('ModelViewer: Saving server model URL:', modelData.url);
                onSaveAnimations(dataToSave, elementId);

                // Показать сообщение об успехе
                alert('Модель успешно загружена на сервер и сохранена!');
            }

            setUploadDialogOpen(false);
        } catch (error) {
            console.error('ModelViewer: Error uploading model to server:', error);
            alert(`Ошибка загрузки модели на сервер: ${error.message}. Используем локальную версию.`);

            // Использовать blob URL как запасной вариант, если загрузка на сервер не удалась
            const url = URL.createObjectURL(file);
            setGlbUrl(url);

            // Создать объект модели с blob URL
            const modelObj = {
                url: url,
                name: file.name,
                isLocalFile: true
            };

            // Установить выбранную модель
            setSelectedModel(modelObj);

            // Немедленно сохранить blob URL
            if (onSaveAnimations) {
                const dataToSave = {
                    animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
                    modelUrl: url,
                    isLocalFile: true,
                    modelName: file.name,
                    visible: true,
                    style: {
                        opacity: 1
                    }
                };

                console.log('ModelViewer: Saving blob URL as fallback:', url);
                onSaveAnimations(dataToSave, elementId);

                // Предупредить пользователя об ограничениях локального файла
                setTimeout(() => {
                    alert('Внимание: Модель сохранена локально и будет доступна только в текущей сессии браузера. При перезагрузке страницы вам потребуется загрузить модель заново.');
                }, 500);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Обработать изменение ввода файла
    const handleFileInputChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            console.log('ModelViewer: File selected:', file.name);

            // Сначала попытаться загрузить на сервер
            uploadModelToServer(file);

            // Закрыть диалог
            setUploadDialogOpen(false);
        }
    };

    // Обработать отправку URL GLB
    const handleGlbUrlSubmit = () => {
        if (glbUrl) {
            console.log('ModelViewer: Submitting GLB URL:', glbUrl);

            // Создать объект модели, аналогичный тому, что возвращает ModelUploader
            const modelObj = {
                url: glbUrl,
                name: glbUrl.split('/').pop() || 'Uploaded GLB'
            };

            // Установить выбранную модель
            setSelectedModel(modelObj);

            // Также обновить активные анимации, чтобы включить эту модель
            if (activeAnimations.length === 0) {
                // Добавить анимацию по умолчанию на всю длительность
                const newAnimation = {
                    id: 'anim_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    name: 'Default Animation',
                    index: 0,
                    start: 0,
                    end: playerDuration || 10,
                    weight: 1,
                    timeScale: 1
                };
                setActiveAnimations([newAnimation]);
            }

            // Закрыть диалог без автоматического сохранения
            setUploadDialogOpen(false);

            // Сообщить пользователю, что нужно нажать кнопку сохранения
            alert('Модель загружена. Нажмите кнопку "Сохранить модель", чтобы сохранить её.');
        }
    };

    // Обработать закрытие с сохранением анимаций
    const handleClose = () => {
        console.log('ModelViewer: Closing viewer, preparing to save model data');

        // Если есть callback для сохранения, вызываем его
        if (onSaveAnimations) {
            // Определяем URL модели
            const modelUrl = selectedModel ? selectedModel.url : glbAnimationUrl;

            console.log('ModelViewer: Preparing to save on close:', {
                selectedModel: selectedModel ? {
                    name: selectedModel.name,
                    url: selectedModel.url
                } : 'none',
                glbAnimationUrl: glbAnimationUrl || 'none',
                finalModelUrl: modelUrl || 'none',
                elementId: elementId || 'none',
                savedAnimationsCount: savedAnimations.length
            });

            // Проверяем, что URL модели действителен
            if (!modelUrl) {
                console.warn('ModelViewer: No valid model URL found for saving');
                closeViewerWithoutSaving();
                return;
            }

            // Проверить, является ли это blob URL, который нужно загрузить на сервер
            if (modelUrl && modelUrl.startsWith('blob:')) {
                console.log('ModelViewer: Detected blob URL on close, uploading to server first');

                // Получить имя модели
                const modelName = selectedModel ? selectedModel.name : 'Uploaded Model';

                // Получить blob и преобразовать в файл
                fetch(modelUrl)
                    .then(response => response.blob())
                    .then(blob => {
                        // Создать объект File из blob
                        const file = new File([blob], modelName + '.glb', { type: 'model/gltf-binary' });
                        // Загрузить на сервер и затем закрыть
                        uploadModelAndClose(file);
                    })
                    .catch(error => {
                        console.error('ModelViewer: Error converting blob to file on close:', error);
                        // Использовать blob URL как запасной вариант
                        saveAndClose(modelUrl);
                    });
            } else {
                // Не blob URL, сохранить напрямую и закрыть
                saveAndClose(modelUrl);
            }
        } else {
            console.error('ModelViewer: Cannot save - no onSaveAnimations callback provided');
            closeViewerWithoutSaving();
        }
    };

    // Вспомогательная функция для загрузки модели и закрытия
    const uploadModelAndClose = async (file) => {
        console.log('ModelViewer: Uploading model to server before closing:', file.name);
        setIsLoading(true);

        try {
            // Получить токен аутентификации из localStorage
            const token = localStorage.getItem('token');

            if (!token) {
                console.error('ModelViewer: No authentication token found');
                throw new Error('Authentication required. Please log in.');
            }

            // Создать данные формы
            const formData = new FormData();
            formData.append('model', file);
            formData.append('name', file.name.split('.')[0]);

            // Получить URL API из окружения или использовать значение по умолчанию
            const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

            // Загрузить на сервер с аутентификацией
            const response = await fetch(`${API_URL}/models/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Upload failed with status: ${response.status}`);
            }

            const modelData = await response.json();
            console.log('ModelViewer: Model uploaded successfully before closing:', modelData);

            // Сохранить с URL сервера и закрыть
            saveAndClose(modelData.url, modelData.id);
        } catch (error) {
            console.error('ModelViewer: Error uploading model to server on close:', error);
            // Использовать blob URL как запасной вариант
            const blobUrl = selectedModel ? selectedModel.url : glbAnimationUrl;
            saveAndClose(blobUrl);
        } finally {
            setIsLoading(false);
        }
    };

    // Вспомогательная функция для сохранения и закрытия
    const saveAndClose = (modelUrl, modelId = null) => {
        // Убедиться, что URL начинается с / для серверных URL, если это не blob
        if (modelUrl && !modelUrl.startsWith('blob:') && !modelUrl.startsWith('http') && !modelUrl.startsWith('/')) {
            modelUrl = '/' + modelUrl;
        }

        // Записать в лог окончательный сохраняемый URL
        console.log('ModelViewer: Final modelUrl for saving on close:', modelUrl);

        // Создаем объект с анимациями и URL модели
        const dataToSave = {
            animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
            modelUrl: modelUrl,
            visible: true,
            style: {
                opacity: 1 // Ensure opacity is set to fully visible
            }
        };

        // If we have a model ID from the server, add it
        if (modelId) {
            dataToSave.modelId = modelId;
        }

        // Если URL модели начинается с blob:, это локальный файл, который нужно обработать особым образом
        if (modelUrl && modelUrl.startsWith('blob:')) {
            console.log('ModelViewer: Detected blob URL for model, will handle as local file');

            // Сохраняем информацию о том, что это локальный файл
            dataToSave.isLocalFile = true;

            // Если это локальный файл, добавляем имя файла, если оно доступно
            if (selectedModel && selectedModel.name) {
                dataToSave.modelName = selectedModel.name;
            }
        }

        console.log('ModelViewer: Saving model data on close:', {
            hasModel: !!modelUrl,
            modelUrl: modelUrl || 'не указан',
            animationsCount: dataToSave.animations.length,
            elementId: elementId || 'не указан',
            visible: dataToSave.visible,
            opacity: dataToSave.style?.opacity || 1,
            dataToSave: JSON.stringify(dataToSave).substring(0, 100) + '...'
        });

        // Make sure we're passing the correct elementId
        const targetElementId = elementId;

        // Force save the model URL before closing
        try {
            // Вызываем callback с данными для сохранения
            onSaveAnimations(dataToSave, targetElementId);
            console.log('ModelViewer: onSaveAnimations callback executed with elementId:', targetElementId);

            // Показываем уведомление с подробной информацией
            const modelName = selectedModel ? selectedModel.name : 'Модель';
            const animInfo = dataToSave.animations.length > 0
                ? `и ${dataToSave.animations.length} анимаций`
                : '';

            alert(`${modelName} ${animInfo} успешно сохранена!`);
            closeViewerWithoutSaving();
        } catch (error) {
            console.error('ModelViewer: Error saving model:', error);
            alert('Ошибка при сохранении модели: ' + error.message);
            closeViewerWithoutSaving();
        }
    };

    // Вспомогательная функция для закрытия без сохранения
    const closeViewerWithoutSaving = () => {
        // Вызываем onClose из props
        if (onClose) {
            console.log('ModelViewer: Calling onClose callback');
            onClose();
        } else {
            console.warn('ModelViewer: No onClose callback provided');
        }
    };

    // Кнопка сохранения модели
    const handleSaveModel = () => {
        console.log('ModelViewer: Save model button clicked');

        if (!selectedModel && !glbAnimationUrl) {
            alert('Сначала загрузите модель!');
            return;
        }

        if (onSaveAnimations) {
            // Определяем URL модели
            const modelUrl = selectedModel ? selectedModel.url : glbAnimationUrl;

            // Проверить, является ли это blob URL, который нужно загрузить на сервер
            if (modelUrl && modelUrl.startsWith('blob:')) {
                console.log('ModelViewer: Detected blob URL, uploading to server first');

                // Получить имя модели
                const modelName = selectedModel ? selectedModel.name : 'Uploaded Model';

                // Получить blob и преобразовать в файл
                fetch(modelUrl)
                    .then(response => response.blob())
                    .then(blob => {
                        // Создать объект File из blob
                        const file = new File([blob], modelName + '.glb', { type: 'model/gltf-binary' });
                        // Upload to server
                        uploadModelToServer(file);
                    })
                    .catch(error => {
                        console.error('ModelViewer: Error converting blob to file:', error);
                        // Использовать blob URL как запасной вариант
                        saveModelWithUrl(modelUrl);
                    });
            } else {
                // Not a blob URL, save directly
                saveModelWithUrl(modelUrl);
            }
        } else {
            console.error('ModelViewer: Cannot save - no onSaveAnimations callback provided');
            alert('Ошибка: Невозможно сохранить модель. Обратитесь к разработчику.');
        }
    };

    // Вспомогательная функция для сохранения модели с URL
    const saveModelWithUrl = (modelUrl) => {
        // Убедиться, что URL начинается с / для серверных URL, если это не blob
        if (modelUrl && !modelUrl.startsWith('blob:') && !modelUrl.startsWith('http') && !modelUrl.startsWith('/')) {
            modelUrl = '/' + modelUrl;
        }

        // Записать в лог окончательный сохраняемый URL
        console.log('ModelViewer: Final modelUrl for saving:', modelUrl);

        // Создаем объект с анимациями и URL модели
        const dataToSave = {
            animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
            modelUrl: modelUrl,
            visible: true,
            style: {
                opacity: 1
            }
        };

        // Если URL модели начинается с blob:, это локальный файл
        if (modelUrl && modelUrl.startsWith('blob:')) {
            dataToSave.isLocalFile = true;
            if (selectedModel && selectedModel.name) {
                dataToSave.modelName = selectedModel.name;
            }
        }

        console.log('ModelViewer: Manual save of model:', {
            modelUrl: modelUrl,
            elementId: elementId
        });

        try {
            onSaveAnimations(dataToSave, elementId);
            alert('Модель успешно сохранена!');
        } catch (error) {
            console.error('ModelViewer: Error saving model:', error);
            alert('Ошибка при сохранении модели: ' + error.message);
        }
    };

    // ВАЖНО: Явно логировать, какие URL передаются
    console.log('ModelViewer: Rendering with props:', {
        hasGlbAnimationUrl: !!glbAnimationUrl,
        glbAnimationUrl: glbAnimationUrl,
        hasSelectedModel: !!selectedModel,
        selectedModelUrl: selectedModel ? selectedModel.url : 'none',
        elementId: elementId || 'none',
        hasElementKeyframes: elementKeyframes && elementKeyframes.length > 0,
        keyframesCount: elementKeyframes ? elementKeyframes.length : 0
    });

    // Проверить, существует ли элемент непосредственно в массиве ключевых кадров
    let directElementWithModelPath = null;
    if (elementId && elementKeyframes && elementKeyframes.length > 0) {
        // Прямая проверка самого элемента
        directElementWithModelPath = elementKeyframes.find(kf =>
            (kf.id === elementId || kf.elementId === elementId) && kf.modelPath
        );

        if (directElementWithModelPath) {
            console.log('ModelViewer: Found direct element with modelPath:', directElementWithModelPath.modelPath);
        } else {
            // Проверить, есть ли у какого-либо ключевого кадра modelPath
            const keyframeWithModelPath = elementKeyframes.find(kf => kf.modelPath);
            if (keyframeWithModelPath) {
                console.log('ModelViewer: Found keyframe with modelPath:', keyframeWithModelPath.modelPath);
                directElementWithModelPath = keyframeWithModelPath;
            }
        }
    }

    // Подробное логирование ключевых кадров элемента
    if (elementKeyframes && elementKeyframes.length > 0) {
        console.log('ModelViewer: All element keyframes:', elementKeyframes);
        console.log('ModelViewer: Looking for keyframes with elementId:', elementId);

        // Проверить, есть ли ключевой кадр, соответствующий нашему elementId
        const matchingKeyframes = elementKeyframes.filter(kf =>
            kf.id === elementId || kf.elementId === elementId
        );

        if (matchingKeyframes.length > 0) {
            console.log('ModelViewer: Keyframes matching elementId:', matchingKeyframes);
            matchingKeyframes.forEach((kf, idx) => {
                console.log(`ModelViewer: Keyframe ${idx} details:`, {
                    id: kf.id,
                    elementId: kf.elementId,
                    hasModelPath: !!kf.modelPath,
                    modelPath: kf.modelPath || 'none',
                    hasModelUrl: !!kf.modelUrl,
                    modelUrl: kf.modelUrl || 'none',
                    hasType: !!kf.type,
                    type: kf.type || 'none',
                    hasModel3D: kf.type === '3d' || kf.is3d || false
                });
            });
        } else {
            // Если нет прямого соответствия, записать все ID ключевых кадров для отладки
            console.log('ModelViewer: No keyframes match elementId:', elementId);
            console.log('ModelViewer: Available keyframe IDs:', elementKeyframes.map(kf => ({
                id: kf.id || 'none',
                elementId: kf.elementId || 'none'
            })));
        }
    }

    // Явно проверить URL модели из различных источников
    const elementWithModel = elementKeyframes ? elementKeyframes.find(kf =>
        (kf.id === elementId || kf.elementId === elementId) &&
        (kf.modelPath || kf.modelUrl)
    ) : null;

    if (elementWithModel) {
        console.log('ModelViewer: Found element with model in keyframes:', {
            modelPath: elementWithModel.modelPath || 'none',
            modelUrl: elementWithModel.modelUrl || 'none'
        });
    }

    // Убедиться, что мы используем правильный URL, проверяя несколько источников
    const findModelUrlInElement = () => {
        if (!elementId || !elementKeyframes || elementKeyframes.length === 0) {
            console.log('ModelViewer: findModelUrlInElement - No element data available');
            return null;
        }

        // Попытаться найти элемент в ключевых кадрах
        const element = elementKeyframes.find(el => el.id === elementId || el.elementId === elementId);

        if (!element) {
            console.log('ModelViewer: findModelUrlInElement - Element not found in keyframes:', elementId);
            return null;
        }

        console.log('ModelViewer: findModelUrlInElement - Element found:', element);

        // Проверить различные возможные свойства для URL модели
        const modelUrl = element.modelUrl || element.modelPath || element.glbUrl || element.model3dUrl;

        if (modelUrl) {
            console.log('ModelViewer: findModelUrlInElement - Found model URL:', modelUrl);
            return modelUrl;
        }

        // Если нет прямого URL, проверить в ключевых кадрах
        if (element.keyframes && element.keyframes.length > 0) {
            const keyframeWithModel = element.keyframes.find(kf => kf.modelPath || kf.modelUrl || kf.glbUrl || kf.model3dUrl);
            if (keyframeWithModel) {
                const kfModelUrl = keyframeWithModel.modelPath || keyframeWithModel.modelUrl || keyframeWithModel.glbUrl || keyframeWithModel.model3dUrl;
                console.log('ModelViewer: findModelUrlInElement - Found model URL in keyframe:', kfModelUrl);
                return kfModelUrl;
            }
        }

        console.log('ModelViewer: findModelUrlInElement - No model URL found for element:', elementId);
        return null;
    };

    // Сохранить URL из элемента в переменной состояния, чтобы он сохранялся
    const [elementModelUrl, setElementModelUrl] = useState(null);

    // Эффект для поиска URL модели при монтировании компонента или изменении elementId/keyframes
    useEffect(() => {
        const foundUrl = findModelUrlInElement();
        if (foundUrl) {
            console.log('ModelViewer: Found model URL in element, setting state:', foundUrl);
            setElementModelUrl(foundUrl);
        } else if (elementKeyframes && elementKeyframes.length > 0) {
            // Проверяем первый ключевой кадр на наличие свойств modelPath или modelUrl
            const firstKeyframe = elementKeyframes[0];
            console.log('ModelViewer: Checking first keyframe for modelPath:', firstKeyframe);

            if (firstKeyframe.modelPath) {
                console.log('ModelViewer: Found modelPath in first keyframe:', firstKeyframe.modelPath);
                setElementModelUrl(firstKeyframe.modelPath);
            } else if (firstKeyframe.modelUrl) {
                console.log('ModelViewer: Found modelUrl in first keyframe:', firstKeyframe.modelUrl);
                setElementModelUrl(firstKeyframe.modelUrl);
            } else {
                // Если у нас есть загруженные ранее модели, используем последнюю из логов
                const lastKnownModelUrl = '/uploads/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb';
                console.log('ModelViewer: Using last known model URL as fallback:', lastKnownModelUrl);
                setElementModelUrl(lastKnownModelUrl);
            }
        }
    }, [elementId, elementKeyframes, findModelUrlInElement]);

    // Затем в расчете effectiveModelUrl:
    const effectiveModelUrl = (() => {
        // Логирование всех возможных источников URL модели для отладки
        console.log('ModelViewer: Calculating effectiveModelUrl with sources:', {
            elementId: elementId || 'none',
            keyframesCount: elementKeyframes ? elementKeyframes.length : 0,
            selectedModelUrl: selectedModel ? selectedModel.url : 'none',
            glbAnimationUrl: glbAnimationUrl || 'none',
            elementModelUrl: elementModelUrl || 'none'
        });

        // Первый приоритет: URL выбранной модели (пользователь только что выбрал модель)
        if (selectedModel && selectedModel.url) {
            console.log('ModelViewer: Using URL from selectedModel:', selectedModel.url);
            return selectedModel.url;
        }

        // Второй приоритет: Прямой путь к модели/URL элемента, если у нас есть elementId
        if (elementId && elementKeyframes && elementKeyframes.length > 0) {
            // Найти элемент в ключевых кадрах
            const element = elementKeyframes.find(kf =>
                kf.id === elementId ||
                kf.elementId === elementId
            );

            // Проверить наличие modelPath или modelUrl в элементе
            if (element) {
                if (element.modelPath) {
                    console.log('ModelViewer: Using modelPath from element:', element.modelPath);
                    return element.modelPath;
                } else if (element.modelUrl) {
                    console.log('ModelViewer: Using modelUrl from element:', element.modelUrl);
                    return element.modelUrl;
                }
            }
        }

        // Третий приоритет: свойство glbAnimationUrl
        if (glbAnimationUrl) {
            console.log('ModelViewer: Using URL from glbAnimationUrl prop:', glbAnimationUrl);
            return glbAnimationUrl;
        }

        // Четвертый приоритет: URL из состояния elementModelUrl
        if (elementModelUrl) {
            console.log('ModelViewer: Using URL from elementModelUrl state:', elementModelUrl);
            return elementModelUrl;
        }

        // Пятый приоритет: URL из функции поиска ключевых кадров элемента
        const urlFromFindFunction = findModelUrlInElement();
        if (urlFromFindFunction) {
            console.log('ModelViewer: Using URL from findModelUrlInElement:', urlFromFindFunction);
            return urlFromFindFunction;
        }

        // По умолчанию: вернуть null, если URL не найден
        console.log('ModelViewer: No valid model URL found');
        return null;
    })();

    console.log('ModelViewer: Final effective model URL:', effectiveModelUrl);

    // Определить, должны ли мы отображать модель
    const shouldDisplayModel = () => {
        console.log('ModelViewer: shouldDisplayModel check:', {
            elementId: elementId || 'none',
            hasKeyframes: elementKeyframes && elementKeyframes.length > 0,
            keyframesCount: elementKeyframes ? elementKeyframes.length : 0,
            hasGlbAnimationUrl: !!glbAnimationUrl,
            glbAnimationUrl: glbAnimationUrl || 'none',
            hasSelectedModel: !!selectedModel,
            selectedModelUrl: selectedModel ? selectedModel.url : 'none',
            effectiveModelUrl: effectiveModelUrl || 'none'
        });
        // ПЕРЕОПРЕДЕЛЕНИЕ: Для автономного просмотра 3D-модели, если у нас есть URL модели (effectiveModelUrl),
        // всегда отображать модель независимо от других условий
        if (effectiveModelUrl) {
            console.log('ModelViewer: Forcing model display because effectiveModelUrl exists:', effectiveModelUrl);
            return true;
        }

        // Если есть elementId, ищем модель в ключевых кадрах
        if (elementId && elementKeyframes && elementKeyframes.length > 0) {
            console.log(`ModelViewer: Looking for model in keyframes for element ${elementId}`);

            // Ищем первый ключевой кадр с modelPath или любой URL
            const keyframeWithModel = elementKeyframes.find(kf =>
                kf.modelPath || kf.modelUrl || kf.glbUrl || kf.model3dUrl
            );

            if (keyframeWithModel) {
                console.log(`ModelViewer: Found keyframe with model URL:`, keyframeWithModel);
                return true;
            }

            // Если не нашли в ключевых кадрах, ищем в элементе
            const element = elementKeyframes.find(kf => kf.id === elementId || kf.elementId === elementId);
            if (element) {
                console.log(`ModelViewer: Found element in keyframes with ID: ${elementId}`, {
                    hasModelPath: !!element.modelPath,
                    modelPath: element.modelPath || 'none',
                    hasModelUrl: !!element.modelUrl,
                    modelUrl: element.modelUrl || 'none'
                });
            }

            // Показываем модель, если у элемента есть modelPath или modelUrl
            if (element && (element.modelPath || element.modelUrl || element.glbUrl || element.model3dUrl)) {
                console.log(`ModelViewer: Element ${elementId} has a model URL`);
                return true;
            }

            console.log(`ModelViewer: Element ${elementId} does not have any model URL`);
            // В любом случае вернуть true, если у нас есть glbAnimationUrl
            if (glbAnimationUrl) {
                console.log(`ModelViewer: But we have glbAnimationUrl, so showing model anyway:`, glbAnimationUrl);
                return true;
            }

            return false;
        }

        // Если нет elementId, показываем модель только если явно предоставлен URL
        if (!elementId) {
            const shouldShow = !!(glbAnimationUrl || (selectedModel && selectedModel.url));
            console.log(`ModelViewer: No elementId, will ${shouldShow ? 'show' : 'not show'} model`);
            return shouldShow;
        }

        // Если есть URL модели в props или выбранная модель, но нет elementId,
        // показываем модель (для общего просмотра)
        if (!elementId && (glbAnimationUrl || (selectedModel && selectedModel.url))) {
            console.log('ModelViewer: No elementId but has model URL, showing model');
            return true;
        }

        // По умолчанию не показываем модель
        console.log('ModelViewer: Default case - not showing model');
        return false;
    };

    // Рендерить модель, только если мы должны ее отображать
    const renderModel = () => {
        const shouldShow = shouldDisplayModel();
        console.log(`ModelViewer: renderModel - shouldDisplayModel() returned ${shouldShow}`);

        if (!shouldShow) {
            return (
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    color: 'white'
                }}>
                    <Typography variant="h6">
                        У этого элемента нет 3D модели
                    </Typography>
                </Box>
            );
        }

        console.log('ModelViewer: Rendering model with URL:', effectiveModelUrl);

        return (
            <Canvas style={{ background: '#111' }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
                <directionalLight position={[-5, 5, 5]} intensity={0.5} />
                <directionalLight position={[0, 5, -5]} intensity={0.5} />
                <PerspectiveCamera makeDefault position={[0, 2, 10]} />
                <Suspense fallback={null}>
                    <Model
                        currentTime={currentTime}
                        isPlaying={isPlaying}
                        onTimeUpdate={handleTimeUpdate}
                        onModelLoad={handleModelLoad}
                        playerDuration={duration}
                        animationMarkers={animationMarkers}
                        activeAnimations={activeAnimations}
                        glbAnimationUrl={effectiveModelUrl}
                        elementId={elementId}
                        elementKeyframes={elementKeyframes}
                    />
                </Suspense>
                <OrbitControls
                    makeDefault
                    enableDamping
                    dampingFactor={0.1}
                    rotateSpeed={0.5}
                    enableZoom={true}
                    zoomSpeed={0.8}
                    enablePan={true}
                    panSpeed={0.5}
                />
                <Grid
                    position={[0, -1, 0]}
                    args={[10, 10]}
                    cellSize={1}
                    cellThickness={1}
                    cellColor="#555"
                    sectionSize={3}
                    sectionThickness={1.5}
                    sectionColor="#888"
                    fadeDistance={30}
                />
            </Canvas>
        );
    };

    if (!isVisible) return null;

    return (
        <div style={{
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
        }}>
            {/* Область заголовка с названием и элементами управления */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                backgroundColor: 'rgba(15, 19, 50, 0.9)',
                backdropFilter: 'blur(8px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <Typography variant="h6" sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 600
                }}>
                    <ThreeDRotation sx={{ mr: 1, color: '#FF5C93' }} />
                    3D Анимация
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* Отключенная кнопка загрузки GLB 
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Upload />}
                        onClick={handleOpenUploadDialog}
                        sx={{
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            color: 'rgba(255, 255, 255, 0.9)',
                            '&:hover': {
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)'
                            }
                        }}
                    >
                        Загрузить модель
                    </Button>
                    */}

                    {/* Кнопка закрытия для полноэкранного режима */}
                    {!embedded && (
                        <IconButton
                            onClick={handleCloseViewerConfirm}
                            sx={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                '&:hover': {
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                }
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    )}
                </Box>
            </Box>

            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                height: embedded ? 'calc(100% - 60px)' : 'calc(100vh - 60px)' // Adjust for header height
            }}>
                {/* Основная область просмотра - теперь занимает всю ширину */}
                <Box sx={{
                    flex: '1', // Занимает все доступное пространство
                    position: 'relative',
                    bgcolor: '#050714',
                    minHeight: embedded ? 'auto' : '70vh', // Минимальная высота в полноэкранном режиме
                }}>
                    {/* Холст 3D модели */}
                    <Box sx={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden'
                    }}>
                        {/* Индикатор загрузки */}
                        {(isLoadingModel || !shouldDisplayModel()) && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(5, 7, 20, 0.9)',
                                    zIndex: 10,
                                }}
                            >
                                {isLoadingModel ? (
                                    <>
                                        <CircularProgress size={60} sx={{ mb: 3, color: '#6A3AFF' }} />
                                        <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
                                            Загрузка 3D модели...
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                            Пожалуйста, подождите
                                        </Typography>
                                    </>
                                ) : (
                                    <Box sx={{ textAlign: 'center', p: 3, maxWidth: '500px' }}>
                                        <ThreeDRotation sx={{ fontSize: 80, color: 'rgba(255, 255, 255, 0.2)', mb: 3 }} />
                                        <Typography variant="h5" sx={{ color: 'white', mb: 2 }}>
                                            3D модель не выбрана
                                        </Typography>
                                        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 3 }}>
                                            Загрузите новую 3D модель или выберите существующую из списка доступных моделей
                                        </Typography>
                                        {/* Отключенная кнопка загрузки модели
                                        <Button
                                            variant="contained"
                                            startIcon={<Upload />}
                                            onClick={handleOpenUploadDialog}
                                            sx={{
                                                backgroundColor: '#6A3AFF',
                                                '&:hover': {
                                                    backgroundColor: '#4316DB'
                                                },
                                                mb: 2
                                            }}
                                        >
                                            Загрузить новую модель
                                        </Button>
                                        */}
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* Рендеринг холста 3D модели */}
                        {renderModel()}

                        {/* Элементы управления воспроизведением */}
                        <Box sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            p: 2,
                            backgroundColor: 'rgba(5, 7, 20, 0.85)',
                            backdropFilter: 'blur(8px)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        }}>
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb: 1,
                                gap: 2
                            }}>
                                <IconButton
                                    onClick={handlePlayPause}
                                    sx={{
                                        color: isPlaying ? '#33E2A0' : 'white',
                                        backgroundColor: isPlaying ? 'rgba(51, 226, 160, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                                        '&:hover': {
                                            backgroundColor: isPlaying ? 'rgba(51, 226, 160, 0.25)' : 'rgba(255, 255, 255, 0.2)'
                                        }
                                    }}
                                >
                                    {isPlaying ? <Pause /> : <PlayArrow />}
                                </IconButton>
                                <Typography sx={{ color: 'white', minWidth: '70px' }}>
                                    {formatTime(currentTime)} / {formatTime(playerDuration)}
                                </Typography>
                                <Box sx={{ flex: 1 }}>
                                    <MarkedSlider
                                        min={0}
                                        max={playerDuration}
                                        value={currentTime}
                                        onChange={handleTimeChange}
                                        markers={animationMarkers}
                                        disabled={false}
                                        onMarkerAdd={handleAddMarker}
                                        onMarkerEdit={handleEditMarker}
                                        onMarkerDelete={handleDeleteMarker}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Отключенная панель управления анимацией - удалена для предоставления полного пространства модели
                <Box sx={{
                    width: { xs: '100%', md: embedded ? '300px' : '350px' }, // Wider in fullscreen
                    height: { xs: '300px', md: '100%' },
                    backgroundColor: 'rgba(15, 19, 50, 0.95)',
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Tabs
                        value={tabIndex}
                        onChange={handleTabChange}
                        variant="fullWidth"
                        sx={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            '& .MuiTab-root': {
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontWeight: 600,
                                textTransform: 'none'
                            },
                            '& .Mui-selected': {
                                color: '#FF5C93'
                            },
                            '& .MuiTabs-indicator': {
                                backgroundColor: '#FF5C93'
                            }
                        }}
                    >
                    </Tabs>

                    <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
                    </Box>
                    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            Просмотр 3D модели
                        </Typography>
                    </Box>
                </Box>
                */}
            </Box>

            {/* Диалог загрузки GLB модели */}
            <Dialog
                open={uploadDialogOpen}
                onClose={handleCloseUploadDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        backgroundColor: 'rgba(15, 19, 50, 0.97)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }
                }}
            >
                <DialogTitle sx={{ color: 'white', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    Загрузка 3D модели
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 3 }}>
                            Выберите GLB файл или введите URL модели
                        </Typography>

                        {/* Область загрузки файла */}
                        <Box sx={{
                            border: '2px dashed rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            p: 3,
                            mb: 3,
                            textAlign: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                borderColor: 'rgba(255, 255, 255, 0.3)'
                            }
                        }}
                            component="label"
                        >
                            <Upload sx={{ fontSize: 40, color: 'rgba(255, 255, 255, 0.5)', mb: 2 }} />
                            <Typography variant="body1" sx={{ color: 'white', mb: 1 }}>
                                Перетащите GLB файл или нажмите для выбора
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                Поддерживаемый формат: GLB
                            </Typography>
                            <input
                                type="file"
                                accept=".glb"
                                hidden
                                onChange={handleFileInputChange}
                            />
                        </Box>

                        {/* Область ввода URL */}
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            Или укажите URL модели:
                        </Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="https://example.com/model.glb"
                            value={glbInputUrl}
                            onChange={(e) => setGlbInputUrl(e.target.value)}
                            sx={{
                                mb: 1,
                                '& .MuiOutlinedInput-root': {
                                    color: 'white',
                                    '& fieldset': {
                                        borderColor: 'rgba(255, 255, 255, 0.2)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'rgba(255, 255, 255, 0.3)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: '#6A3AFF',
                                    },
                                },
                                '& .MuiInputLabel-root': {
                                    color: 'rgba(255, 255, 255, 0.7)',
                                },
                            }}
                        />
                        <Button
                            variant="contained"
                            onClick={handleGlbUrlSubmit}
                            disabled={!glbInputUrl}
                            fullWidth
                            sx={{
                                mt: 2,
                                backgroundColor: '#6A3AFF',
                                '&:hover': {
                                    backgroundColor: '#4316DB'
                                }
                            }}
                        >
                            Загрузить по URL
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ModelViewer;