import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { processVideoFrame } from '../services/api';

// Продвинутый алгоритм дифференцирования кадров для улучшенного обнаружения движения
/* ОТКЛЮЧЕНО - НЕ ТРЕБУЕТСЯ ДЛЯ ОБНАРУЖЕНИЯ РЕЖИМА ПАУЗЫ
const createImageProcessor = () => {
    // Создаем воркер только если браузер его поддерживает
    if (typeof Worker !== 'undefined') {
        try {
            const workerCode = `
                // Предварительно вычисляем таблицы преобразования для повышения производительности
                const YCbCrTable = {
                    r: new Float32Array(256),
                    g: new Float32Array(256),
                    b: new Float32Array(256)
                };
                
                for(let i = 0; i < 256; i++) {
                    // Предварительно вычисленное преобразование RGB в YCbCr (только компонент Y)
                    YCbCrTable.r[i] = 0.299 * i;
                    YCbCrTable.g[i] = 0.587 * i;
                    YCbCrTable.b[i] = 0.114 * i;
                }
                
                self.onmessage = function(e) {
                    const {videoData, width, height, lastFrameData, threshold} = e.data;
                    
                    // Создаем canvas в воркере
                    const canvas = new OffscreenCanvas(width, height);
                    const ctx = canvas.getContext('2d');
                    
                    // Рисуем данные изображения на canvas
                    const imgData = new ImageData(new Uint8ClampedArray(videoData), width, height);
                    ctx.putImageData(imgData, 0, 0);
                    
                    // Обнаруживаем движение, если lastFrameData существует
                    let motionDetected = true;
                    let diffScore = 0;
                    let motionAreas = [];
                    
                    if (lastFrameData) {
                        const currentData = ctx.getImageData(0, 0, width, height).data;
                        const lastData = new Uint8ClampedArray(lastFrameData);
                        
                        // Оптимизированное сравнение кадров - сравниваем только яркость
                        // и используем блочное сравнение для повышения производительности
                        const blockSize = 16; // блоки 16x16 пикселей
                        const blocksX = Math.ceil(width / blockSize);
                        const blocksY = Math.ceil(height / blockSize);
                        let diffBlocks = 0;
                        const totalBlocks = blocksX * blocksY;
                        
                        // Обрабатываем каждый блок
                        for (let by = 0; by < blocksY; by++) {
                            for (let bx = 0; bx < blocksX; bx++) {
                                let blockDiff = 0;
                                let pixelsChecked = 0;
                                
                                // Для эффективности проверяем несколько пикселей в блоке
                                const startX = bx * blockSize;
                                const startY = by * blockSize;
                                const endX = Math.min(startX + blockSize, width);
                                const endY = Math.min(startY + blockSize, height);
                                
                                // Пропускаем некоторые пиксели для повышения производительности
                                const skipFactor = 2;
                                
                                for (let y = startY; y < endY; y += skipFactor) {
                                    const rowOffset = y * width * 4;
                                    
                                    for (let x = startX; x < endX; x += skipFactor) {
                                        const idx = rowOffset + x * 4;
                                        
                                        // Быстрый расчет Y (яркости) с использованием предварительно вычисленных таблиц
                                        const y1 = YCbCrTable.r[currentData[idx]] + YCbCrTable.g[currentData[idx+1]] + YCbCrTable.b[currentData[idx+2]];
                                        const y2 = YCbCrTable.r[lastData[idx]] + YCbCrTable.g[lastData[idx+1]] + YCbCrTable.b[lastData[idx+2]];
                                        
                                        const diff = Math.abs(y1 - y2);
                                        if (diff > 15) { // Порог для различия яркости
                                            blockDiff++;
                                        }
                                        
                                        pixelsChecked++;
                                    }
                                }
                                
                                // Если изменилось достаточно пикселей, отмечаем блок как отличающийся
                                if (pixelsChecked > 0 && blockDiff / pixelsChecked > 0.2) {
                                    diffBlocks++;
                                    motionAreas.push({x: bx, y: by});
                                }
                            }
                        }
                        
                        diffScore = diffBlocks / totalBlocks;
                        motionDetected = diffScore > threshold;
                    }
                    
                    // Оптимизированное сжатие JPEG
                    const quality = motionDetected ? 0.7 : 0.6; // Более низкое качество, если нет движения
                    
                    // Создаем blob с оптимизированными настройками
                    canvas.convertToBlob({type: 'image/jpeg', quality}).then(blob => {
                        self.postMessage({
                            blob,
                            width,
                            height,
                            frameData: videoData,
                            motionDetected,
                            diffScore,
                            motionAreas
                        });
                    });
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));
            return worker;
        } catch (e) {
            console.warn('Failed to create worker:', e);
            return null;
        }
    }
    return null;
};
*/

// Создаем очередь запросов для лучшего управления сетевыми запросами
const createRequestQueue = () => {
    const queue = [];
    let isProcessing = false;

    const processQueue = async () => {
        if (isProcessing || queue.length === 0) return;

        isProcessing = true;
        const { request, resolve, reject } = queue.shift();

        try {
            const response = await request();
            resolve(response);
        } catch (error) {
            reject(error);
        } finally {
            isProcessing = false;
            processQueue(); // Обрабатываем следующий запрос
        }
    };

    return {
        add: (requestFn) => {
            return new Promise((resolve, reject) => {
                queue.push({ request: requestFn, resolve, reject });
                processQueue();
            });
        },
        clear: () => {
            queue.length = 0;
        },
        size: () => queue.length
    };
};

const VideoAnalyzer = ({ videoUrl, onPersonSelected, selectedPerson: externalSelectedPerson, isDancerSelectionMode, onVideoLoaded, videoQuality = 'high', currentTime, isPlaying }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const offscreenCanvasRef = useRef(null);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentPoses, setCurrentPoses] = useState([]);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const lastProcessTime = useRef(0);
    const animationFrameRef = useRef(null);
    const isProcessingRef = useRef(false);
    const processingInProgress = useRef(false);
    const lastFrameData = useRef(null);
    const imageProcessorWorker = useRef(null);
    const requestQueue = useRef(null);
    const consecutiveErrorCount = useRef(0);
    const processingTimes = useRef([]);
    const lastSelectedPose = useRef(null);  // Отслеживаем последнюю выбранную позу
    const poseSimilarityCache = useRef(new Map()); // Кэш для расчетов сходства поз
    const devicePixelRatio = useRef(window.devicePixelRatio || 1);
    const lastDetectedPoses = useRef([]);
    const framesToSkip = useRef(0);
    const [showMessage, setShowMessage] = useState(false);
    const overlayCanvasRef = useRef(null);
    const pausedForSelectionRef = useRef(false);
    const videoLoadAttempts = useRef(0); // Отслеживаем попытки загрузки
    const [videoError, setVideoError] = useState(null);
    const seekRequested = useRef(false);
    const manualPlayRequest = useRef(false);
    const playbackErrorCount = useRef(0);

    // Улучшенные адаптивные настройки, соответствующие возможностям устройства
    const [settings, setSettings] = useState({
        frameInterval: 1000 / 15, // Целевые 15 FPS 
        maxProcessingTime: 100, // Пропуск кадров, если обработка занимает слишком много времени (мс)
        quality: 0.8, // Качество JPEG (0-1)
        motionThreshold: 0.05, // Порог обнаружения движения (0-1)
        motionDetectionEnabled: true, // Включение/выключение обнаружения движения
        resizeEnabled: true, // Включение/выключение изменения размера кадра на бэкенде
        adaptiveQuality: true, // Включение/выключение адаптивного качества
        userDevicePerformance: 'medium', // 'low', 'medium', 'high'
        smartSkipping: true, // Включение умного пропуска кадров
        trackingMode: 'hybrid', // 'simple', 'advanced', 'hybrid'
        maxConcurrentRequests: 1, // Максимальное количество одновременных запросов к серверу
    });

    // Инициализация размеров canvas когда видео готово - ПЕРЕНЕСЕНА ЭТА ФУНКЦИЯ В НАЧАЛО
    const setupCanvases = useCallback(() => {
        if (!videoRef.current) return false;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const overlay = overlayCanvasRef.current;

        if (canvas && video.videoWidth && video.videoHeight) {
            console.log(`Setting up canvases for native video resolution: ${video.videoWidth}x${video.videoHeight}`);

            // Устанавливаем размер основного canvas соответствующим нативному разрешению видео
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Устанавливаем размер оверлейного canvas соответствующим нативному разрешению видео
            if (overlay) {
                // Всегда используем исходные размеры видео для размера canvas
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;

                console.log(`Overlay canvas set to: ${overlay.width}x${overlay.height}`);
            }

            // Логируем текущий статус видео для помощи с отладкой
            console.log(`Video status: currentTime=${video.currentTime}s, paused=${video.paused}, readyState=${video.readyState}`);

            return true; // Возвращаем true, если настройка прошла успешно
        } else {
            // Логируем информацию об ошибке, если настройка не удалась
            console.warn(`Canvas setup failed: video dimensions not available (${video.videoWidth}x${video.videoHeight})`);

            if (video.readyState < 2) {
                console.warn(`Video not ready yet, readyState=${video.readyState}`);
            }

            return false; // Возвращаем false, если настройка не удалась
        }
    }, []);

    // Расчетные настройки, основанные на производительности - более динамичный отклик на возможности устройства
    const computedSettings = useMemo(() => {
        let quality = settings.quality;
        let frameInterval = settings.frameInterval;
        let motionThreshold = settings.motionThreshold;
        let skipThreshold = 0.02; // Порог по умолчанию для пропуска кадров
        let sizeLimit = 640; // Максимальный размер по умолчанию для видеокадров

        // Корректировка на основе производительности устройства
        if (settings.adaptiveQuality) {
            const avgProcessingTime = processingTimes.current.length > 0
                ? processingTimes.current.reduce((a, b) => a + b, 0) / processingTimes.current.length
                : 50;

            // Более детальные уровни производительности
            if (avgProcessingTime > 250) {
                // Очень медленное устройство
                quality = 0.5;
                frameInterval = 1000 / 6; // 6 FPS
                motionThreshold = 0.15;
                skipThreshold = 0.05;
                sizeLimit = 320;
            } else if (avgProcessingTime > 200) {
                // Медленное устройство
                quality = 0.55;
                frameInterval = 1000 / 8; // 8 FPS
                motionThreshold = 0.12;
                skipThreshold = 0.04;
                sizeLimit = 480;
            } else if (avgProcessingTime > 150) {
                // Устройство ниже среднего
                quality = 0.6;
                frameInterval = 1000 / 10; // 10 FPS
                motionThreshold = 0.1;
                skipThreshold = 0.03;
                sizeLimit = 480;
            } else if (avgProcessingTime > 100) {
                // Среднее устройство
                quality = 0.65;
                frameInterval = 1000 / 12; // 12 FPS
                motionThreshold = 0.08;
                skipThreshold = 0.03;
                sizeLimit = 640;
            } else if (avgProcessingTime > 50) {
                // Хорошее устройство
                quality = 0.75;
                frameInterval = 1000 / 15; // 15 FPS
                motionThreshold = 0.05;
                skipThreshold = 0.02;
                sizeLimit = 720;
            } else if (avgProcessingTime < 30) {
                // Высокопроизводительное устройство
                quality = 0.85;
                frameInterval = 1000 / 24; // 24 FPS
                motionThreshold = 0.02;
                skipThreshold = 0.01;
                sizeLimit = 960;
            }
        }

        return {
            quality,
            frameInterval,
            motionThreshold,
            skipThreshold,
            sizeLimit,
            type: 'image/jpeg',
        };
    }, [settings, processingTimes.current.length]);

    const frameSkipCount = useRef(0);
    const lastProcessingDuration = useRef(0);

    // Инициализируем воркер и очередь запросов при монтировании компонента
    useEffect(() => {
        // Создаем очередь запросов для управления сетевыми запросами
        requestQueue.current = createRequestQueue();

        // Определяем производительность устройства
        detectDevicePerformance();

        // Очистка памяти
        return () => {
            // Очищаем очередь запросов
            if (requestQueue.current) {
                requestQueue.current.clear();
            }

            // Очищаем кэши
            poseSimilarityCache.current.clear();
            lastSelectedPose.current = null;
        };
    }, []);

    // Определяем производительность устройства
    const detectDevicePerformance = () => {
        // Более сложное определение устройства
        const hardwareConcurrency = navigator.hardwareConcurrency || 2;
        const memory = navigator.deviceMemory || 4; // По умолчанию 4 ГБ, если недоступно
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        let performanceLevel = 'medium';

        // Проверяем возможности устройства
        if (isMobile) {
            if (hardwareConcurrency <= 4 || memory <= 2) {
                performanceLevel = 'low';
            } else if (hardwareConcurrency >= 8 && memory >= 4) {
                performanceLevel = 'high';
            } else {
                performanceLevel = 'medium';
            }
        } else { // Настольный компьютер
            if (hardwareConcurrency <= 2 || memory <= 4) {
                performanceLevel = 'low';
            } else if (hardwareConcurrency >= 8 && memory >= 8) {
                performanceLevel = 'high';
            } else {
                performanceLevel = 'medium';
            }
        }

        setSettings(prev => ({
            ...prev,
            userDevicePerformance: performanceLevel,
            // Корректируем настройки на основе обнаруженной производительности
            quality: performanceLevel === 'low' ? 0.6 : performanceLevel === 'medium' ? 0.7 : 0.8,
            frameInterval: performanceLevel === 'low' ? 1000 / 10 : performanceLevel === 'medium' ? 1000 / 15 : 1000 / 24,
        }));
    };

    // Захватываем кадр видео в оригинальном разрешении
    const captureVideoFrame = useCallback((video) => {
        if (!video) return null;

        // Всегда используем исходные размеры видео
        const width = video.videoWidth;
        const height = video.videoHeight;

        // Создаем canvas при необходимости
        if (!offscreenCanvasRef.current) {
            offscreenCanvasRef.current = document.createElement('canvas');
        }

        const canvas = offscreenCanvasRef.current;

        // Устанавливаем размеры canvas, чтобы точно соответствовали размерам видео
        canvas.width = width;
        canvas.height = height;

        // Получаем контекст и рисуем кадр видео
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Очищаем канвас перед рисованием
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Сначала заполняем черным фоном, чтобы избежать прозрачности
        ctx.fillStyle = 'rgb(0,0,0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Рисуем видео на канвас, гарантируя непрозрачность
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Возвращаем как blob с оптимизированными настройками качества
        return new Promise(resolve => {
            // Используем более низкое качество при обработке кадров для производительности
            // Высокое качество используем только для выбора танцора
            const quality = isDancerSelectionMode && video.paused ? 0.9 : 0.7;
            canvas.toBlob(resolve, 'image/jpeg', quality);
        });
    }, [isDancerSelectionMode]);

    // Обработка кадра видео с оптимизированным планированием
    const processFrame = useCallback(async (timestamp) => {
        if (!isProcessingRef.current || !isVideoReady || !videoRef.current) {
            return;
        }

        // ========== ОПТИМИЗИРОВАННАЯ ЛОГИКА ОБРАБОТКИ КАДРОВ ==========
        // 1. Не обрабатывать кадры, если видео воспроизводится и мы не в режиме выбора танцора
        if (!isDancerSelectionMode && !videoRef.current.paused) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
            return;
        }

        // 2. Применить адаптивный интервал кадров
        const targetInterval = computedSettings.frameInterval *
            (isDancerSelectionMode ? 1 : 3); // Реже обрабатывать в обычном режиме

        if (timestamp - lastProcessTime.current < targetInterval) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
            return;
        }

        // 3. Пропустить, если уже обрабатывается кадр
        if (processingInProgress.current) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
            return;
        }

        // 4. Умная логика пропуска кадров
        if (settings.smartSkipping) {
            // Пропустить больше кадров, если видео воспроизводится
            const skipFrames = !videoRef.current.paused ? 3 : 1;
            if (framesToSkip.current > 0) {
                framesToSkip.current--;
                animationFrameRef.current = requestAnimationFrame(processFrame);
                return;
            }
            framesToSkip.current = skipFrames;
        }

        lastProcessTime.current = timestamp;

        // Получаем элемент видео
        const video = videoRef.current;

        // Обрабатываем только если нужно (режим выбора танцора или видео на паузе)
        if (isDancerSelectionMode || video.paused) {
            try {
                // Захватываем кадр
                const blob = await captureVideoFrame(video);

                // Обрабатываем только если в режиме выбора или на паузе
                if (blob && (isDancerSelectionMode || video.paused)) {
                    await processBlob(blob);
                }
            } catch (err) {
                console.error("Error processing frame:", err);
            }
        }

        // Продолжаем цикл анимации
        animationFrameRef.current = requestAnimationFrame(processFrame);
    }, [isVideoReady, captureVideoFrame, computedSettings, settings, isDancerSelectionMode]);

    // Оптимизированная обработка blob с улучшенной обработкой ошибок и регулированием
    const processBlob = async (blob) => {
        if (processingInProgress.current) {
            return;
        }

        processingInProgress.current = true;
        try {
            // Регулируем API-запросы на основе производительности
            const now = performance.now();
            const timeSinceLastProcess = now - lastProcessingDuration.current;

            // Если мы недавно обработали и видео воспроизводится, пропускаем эту обработку
            if (timeSinceLastProcess < 100 && !videoRef.current.paused && !isDancerSelectionMode) {
                processingInProgress.current = false;
                return;
            }

            // Создаем форму данных
            const formData = new FormData();
            formData.append('file', blob, 'frame.jpg');

            // Добавляем параметр изменения размера на основе настроек
            const resize = settings.resizeEnabled ? 1 : 0;

            // Запрашиваем наложение только в режиме выбора танцора и когда видео на паузе
            const overlay = isDancerSelectionMode && videoRef.current.paused ? 1 : 0;

            // Используем очередь запросов для управления параллельными запросами с тайм-аутом
            const makeRequest = async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000); // Более короткий тайм-аут

                try {
                    const response = await fetch(`http://127.0.0.1:8000/process-frame?resize=${resize}&overlay=${overlay}`, {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'Accept': 'application/json',
                        },
                        mode: 'cors',
                        credentials: 'omit',
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    return await response.json();
                } finally {
                    clearTimeout(timeoutId);
                }
            };

            const startTime = performance.now();

            // Используем очередь для управления запросом
            const result = await requestQueue.current.add(makeRequest);

            const processingTime = performance.now() - startTime;
            lastProcessingDuration.current = processingTime;

            // Обрабатываем результат только если мы все еще в правильном режиме
            if (isDancerSelectionMode || videoRef.current.paused) {
                // Устанавливаем умный пропуск кадров на основе времени обработки
                if (settings.smartSkipping) {
                    const skipFrames = Math.floor(processingTime / computedSettings.frameInterval);
                    framesToSkip.current = Math.min(5, skipFrames); // Ограничиваем 5 кадрами для пропуска
                }

                // Обрабатываем ответ
                if (result.image && canvasRef.current && overlayCanvasRef.current) {
                    // Создаем изображение из ответа
                    const img = new Image();
                    img.onload = () => {
                        // Рисуем только если мы все еще в режиме выбора танцора
                        if (!isDancerSelectionMode && !videoRef.current.paused) return;

                        const overlay = overlayCanvasRef.current;
                        if (!overlay) return;

                        const ctx = overlay.getContext('2d');
                        ctx.clearRect(0, 0, overlay.width, overlay.height);
                        ctx.drawImage(img, 0, 0, overlay.width, overlay.height);
                    };

                    // Устанавливаем источник изображения с обработкой ошибок
                    img.onerror = (err) => {
                        console.error("Failed to load image:", err);
                    };

                    img.src = result.image;
                }

                // Обрабатываем ключевые точки
                if (result.poses && result.poses.length > 0) {
                    setCurrentPoses(result.poses);
                    lastDetectedPoses.current = result.poses;

                    // Обрабатываем выбранную позу, если предоставлена
                    if (result.selected_pose_index !== undefined) {
                        setSelectedPerson(result.selected_pose_index);
                        if (onPersonSelected) {
                            onPersonSelected(result.selected_pose_index);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Processing error:', error);
            consecutiveErrorCount.current++;
        } finally {
            processingInProgress.current = false;
        }
    };

    // Оптимизированный расчет схожести поз с кэшированием
    const calculatePoseSimilarity = (pose1, pose2) => {
        if (!pose1 || !pose2) return 0;

        // Создаем ключ кэша
        const keypoints1 = JSON.stringify(pose1.keypoints.map(kp => [Math.round(kp.x), Math.round(kp.y), kp.score > 0.5 ? 1 : 0]));
        const keypoints2 = JSON.stringify(pose2.keypoints.map(kp => [Math.round(kp.x), Math.round(kp.y), kp.score > 0.5 ? 1 : 0]));

        const cacheKey = keypoints1 + '|' + keypoints2;
        const reverseCacheKey = keypoints2 + '|' + keypoints1;

        // Проверяем кэш
        if (poseSimilarityCache.current.has(cacheKey)) {
            return poseSimilarityCache.current.get(cacheKey);
        }

        if (poseSimilarityCache.current.has(reverseCacheKey)) {
            return poseSimilarityCache.current.get(reverseCacheKey);
        }

        // Вычисляем схожесть, если нет в кэше
        let totalScore = 0;
        let validPoints = 0;
        let importantPointsScore = 0;
        let importantPointsCount = 0;

        // Определяем важные ключевые точки для отслеживания (плечи, бедра, голова)
        const importantIndices = [0, 11, 12, 23, 24]; // предполагаем, что это индексы для головы, плеч, бедер

        pose1.keypoints.forEach((kp1, i) => {
            const kp2 = pose2.keypoints[i];
            const isImportant = importantIndices.includes(i);

            if (kp1.score > 0.5 && kp2.score > 0.5) {
                const dx = kp1.x - kp2.x;
                const dy = kp1.y - kp2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const similarity = Math.max(0, 1 - distance / 120);  // Скорректированная нормализация

                totalScore += similarity;
                validPoints++;

                if (isImportant) {
                    importantPointsScore += similarity;
                    importantPointsCount++;
                }
            }
        });

        // Вычисляем общую схожесть с акцентом на важные точки
        let finalScore = 0;
        if (validPoints > 0) {
            const regularScore = totalScore / validPoints;
            const importantScore = importantPointsCount > 0 ? importantPointsScore / importantPointsCount : 0;
            finalScore = regularScore * 0.4 + importantScore * 0.6;  // Придаем больший вес важным точкам
        }

        // Кэшируем результат (ограничиваем размер кэша для предотвращения проблем с памятью)
        if (poseSimilarityCache.current.size > 1000) {
            // Очищаем половину кэша, когда он становится слишком большим
            const keys = Array.from(poseSimilarityCache.current.keys());
            keys.slice(0, 500).forEach(key => poseSimilarityCache.current.delete(key));
        }

        poseSimilarityCache.current.set(cacheKey, finalScore);
        return finalScore;
    };

    // Настройка обработки видео - ОПТИМИЗИРОВАНО для активации обработки только в режиме выбора танцора
    useEffect(() => {
        if (!videoRef.current || !canvasRef.current || !isVideoReady) {
            return;
        }

        const video = videoRef.current;

        const handlePlay = () => {
            console.log('Video started playing');

            // Очищаем оверлей при начале воспроизведения
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }

            // Отключаем автоматическую обработку кадров - обрабатываем только по клику
            isProcessingRef.current = false;
            setIsProcessing(false);

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            // Если в режиме выбора танцора, ставим видео на паузу
            if (isDancerSelectionMode && !video.paused) {
                video.pause();
                pausedForSelectionRef.current = true;
                setShowMessage(true);
                setTimeout(() => setShowMessage(false), 5000);
            }
        };

        const handlePause = () => {
            // При паузе НЕ начинаем обрабатывать кадры автоматически
            console.log('Video paused');

            // Если в режиме выбора танцора, убеждаемся, что canvas готов для захвата
            if (isDancerSelectionMode) {
                console.log('Видео поставлено на паузу извне в режиме выбора танцора, подготавливаем canvas');
                setTimeout(() => {
                    setupCanvases();
                }, 50); // Небольшая задержка, чтобы убедиться, что видео полностью остановлено
            }
        };

        const handleEnded = () => {
            console.log('Video ended');

            // Очищаем все оверлеи
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }

            isProcessingRef.current = false;
            setIsProcessing(false);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);

        // Добавляем слушатель timeupdate для обработки длинных видео
        const handleTimeUpdate = () => {
            // Это событие срабатывает регулярно во время воспроизведения
            // Для длинных видео это подтверждает, что видео все еще воспроизводится
            if (video.currentTime > 0 && !video.paused) {
                // Видео успешно воспроизводится
            }

            // Если в режиме выбора танцора и видео на паузе, убеждаемся, что canvas готов
            // Это помогает, когда видео было перемотано на другую позицию
            if (isDancerSelectionMode && video.paused) {
                // Обновляем только если прошло время с последнего обновления или если была запрошена перемотка
                if (seekRequested.current) {
                    console.log(`Video seeked to ${video.currentTime}s, updating canvas for frame capture`);
                    setupCanvases();
                    seekRequested.current = false;
                }
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);

        return () => {
            console.log('Cleaning up video processing effect');
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isVideoReady, isDancerSelectionMode, setupCanvases]);

    // Реагируем на изменения в режиме выбора танцора
    useEffect(() => {
        if (!videoRef.current) return;

        console.log('Dancer selection mode changed:', isDancerSelectionMode);

        const video = videoRef.current;

        if (isDancerSelectionMode) {
            // Входим в режим выбора танцора

            // Если видео воспроизводится, ставим на паузу
            if (!video.paused) {
                video.pause();
                pausedForSelectionRef.current = true;
            }

            // Убеждаемся, что canvas настроены с правильными размерами при входе в режим выбора танцора
            // Это гарантирует, что мы готовы захватить текущий кадр
            setTimeout(() => {
                const setupSuccess = setupCanvases();
                console.log(`Canvas setup in dancer selection mode: ${setupSuccess ? 'successful' : 'failed'}`);
            }, 100); // Небольшая задержка, чтобы убедиться, что видео полностью остановлено

            // ВАЖНО: Не начинаем автоматическую обработку кадров в режиме выбора танцора
            // Обработка будет запускаться ТОЛЬКО по клику пользователя

            // Останавливаем любую текущую обработку
            isProcessingRef.current = false;
            setIsProcessing(false);

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            // Очищаем оверлей перед началом выбора танцора
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }

            setShowMessage(true);
            setTimeout(() => setShowMessage(false), 5000);
        } else {
            // Выходим из режима выбора танцора

            // Останавливаем обработку для экономии ресурсов
            isProcessingRef.current = false;
            setIsProcessing(false);

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            // Сбрасываем флаг паузы
            pausedForSelectionRef.current = false;

            // ВАЖНО: Явно очищаем оверлей при выходе из режима выбора танцора
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }

            // Сбрасываем состояние выбора
            setCurrentPoses([]);
        }
    }, [isDancerSelectionMode, setupCanvases]);

    // Обработчик клика по canvas - ТОЛЬКО здесь запускаем обработку кадра для выбора танцора
    const handleCanvasClick = useCallback(async (event) => {
        // Обрабатываем клики только в режиме выбора танцора и когда видео на паузе
        if (!isDancerSelectionMode || !videoRef.current || !videoRef.current.paused) {
            return;
        }

        setIsProcessing(true);
        setShowMessage(true);

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const overlay = overlayCanvasRef.current;

            if (!video || !canvas || !overlay) {
                throw new Error("Элементы видео или canvas недоступны");
            }

            // Убеждаемся, что canvas правильно настроен с корректными размерами
            // Это гарантирует, что мы работаем с текущими размерами видео
            setupCanvases();

            // Очищаем предыдущие результаты
            const overlayCtx = overlay.getContext('2d');
            overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

            // Получаем позицию и размеры оверлея
            const overlayRect = overlay.getBoundingClientRect();

            // Получаем исходные размеры видео
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            // Вычисляем фактические отображаемые размеры видео внутри оверлея
            const containerWidth = overlayRect.width;
            const containerHeight = overlayRect.height;
            const videoAspect = videoWidth / videoHeight;
            const containerAspect = containerWidth / containerHeight;

            let displayedWidth, displayedHeight, offsetX = 0, offsetY = 0;

            if (containerAspect > videoAspect) {
                // Высота видео ограничена высотой контейнера
                displayedHeight = containerHeight;
                displayedWidth = displayedHeight * videoAspect;
                // Вычисляем левое смещение для центрирования
                offsetX = (containerWidth - displayedWidth) / 2;
            } else {
                // Ширина видео ограничена шириной контейнера
                displayedWidth = containerWidth;
                displayedHeight = displayedWidth / videoAspect;
                // Вычисляем верхнее смещение для центрирования
                offsetY = (containerHeight - displayedHeight) / 2;
            }

            // Вычисляем позицию клика относительно области отображения видео
            const clickX = event.clientX - overlayRect.left - offsetX;
            const clickY = event.clientY - overlayRect.top - offsetY;

            // Преобразуем позицию клика в координаты видео
            const videoX = (clickX / displayedWidth) * videoWidth;
            const videoY = (clickY / displayedHeight) * videoHeight;

            console.log(`Клик в клиентских координатах (${event.clientX}, ${event.clientY})`);
            console.log(`Отображение видео: ${displayedWidth}x${displayedHeight} со смещением (${offsetX}, ${offsetY})`);
            console.log(`Преобразовано в координаты видео: (${videoX}, ${videoY})`);

            // Пропускаем, если клик за пределами области отображения видео
            if (clickX < 0 || clickX > displayedWidth || clickY < 0 || clickY > displayedHeight) {
                console.log("Клик за пределами области видео");
                setIsProcessing(false);
                setShowMessage(false);
                return;
            }

            // Убеждаемся, что кадр видео захвачен на canvas с правильными размерами
            canvas.width = videoWidth;
            canvas.height = videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // Очищаем канвас перед рисованием
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Рисуем ТЕКУЩИЙ кадр видео на canvas
            // Это гарантирует, что мы получаем кадр, который сейчас на паузе
            console.log(`Рисуем текущий кадр на паузе, время ${video.currentTime}s`);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Преобразуем canvas в blob для API-запроса с правильной BGR кодировкой
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.95);
            });

            // Отправляем запрос на бэкенд для определения поз с координатами клика
            console.log("Отправляем запрос для определения поз...");
            const result = await requestQueue.current.add(() =>
                processVideoFrame(blob, {
                    overlay: true,
                    resize: settings.resizeEnabled,
                    clickX: Math.round(videoX),
                    clickY: Math.round(videoY)
                })
            );

            console.log("Получен результат от сервера:", result);

            if (result.error) {
                console.error("Сервер вернул ошибку:", result.error);
                throw new Error(result.error);
            }

            // Проверяем, были ли обнаружены позы
            if (result.poses && result.poses.length > 0) {
                console.log(`Обнаружено ${result.poses.length} поз, выбранный индекс: ${result.selected_pose_index}`);
                const poses = result.poses;
                setCurrentPoses(poses);

                // Получаем выбранную позу, если доступна
                if (result.selected_pose_index !== undefined) {
                    const selectedPose = result.selected_pose_index;
                    console.log("Выбранная поза:", selectedPose);
                    setSelectedPerson(selectedPose);

                    if (onPersonSelected) {
                        onPersonSelected(selectedPose);
                    }

                    // Рисуем оверлей позы
                    if (result.image) {
                        console.log("Рисуем оверлей позы из изображения сервера");
                        const img = new Image();
                        img.onload = () => {
                            if (!overlayCanvasRef.current) return;
                            const ctx = overlayCanvasRef.current.getContext('2d');
                            ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                            ctx.drawImage(img, 0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                        };
                        img.onerror = (err) => {
                            console.error("Не удалось загрузить изображение оверлея позы:", err);
                        };
                        img.src = result.image;
                    } else {
                        console.warn("Нет данных изображения в результате");
                    }

                    setShowMessage(false);
                } else {
                    // Ни одна поза не была близка к точке клика
                    console.warn("Возле точки клика не выбрана ни одна поза");
                    setShowMessage(true);
                    setTimeout(() => setShowMessage(false), 3000);
                }
            } else {
                // Позы не обнаружены
                console.warn("В кадре не обнаружены позы");
                setCurrentPoses([]);
                setSelectedPerson(null);
                setShowMessage(true);
                setTimeout(() => setShowMessage(false), 3000);
            }
        } catch (error) {
            console.error("Ошибка при обработке клика:", error);
            setShowMessage(true);
            setTimeout(() => setShowMessage(false), 3000);
        } finally {
            setIsProcessing(false);
        }
    }, [isDancerSelectionMode, onPersonSelected, settings.resizeEnabled, setupCanvases]);

    // Инициализируем элемент видео с правильной обработкой ошибок
    useEffect(() => {
        if (!videoRef.current || !videoUrl) return;

        const video = videoRef.current;
        console.log('Setting up video with URL:', videoUrl);

        // Сбрасываем состояние ошибки
        setVideoError(null);
        videoLoadAttempts.current = 0;

        // Настраиваем элемент видео
        video.crossOrigin = "anonymous"; // Включаем CORS
        video.preload = "auto";
        video.playsInline = true;
        video.muted = true; // Отключаем звук для разрешения автовоспроизведения

        // Настраиваем обработку ошибок
        const handleError = (error) => {
            console.error('Video error:', error);
            setVideoError(error);

            // Пытаемся восстановиться
            if (videoLoadAttempts.current < 3) {
                videoLoadAttempts.current++;
                console.log(`Повтор загрузки видео (попытка ${videoLoadAttempts.current})`);
                setTimeout(() => {
                    video.load();
                }, 1000 * videoLoadAttempts.current);
            }
        };

        // Настраиваем обработку загрузки
        const handleLoad = () => {
            console.log('VideoAnalyzer: Видео успешно загружено');
            setIsVideoReady(true);
            if (onVideoLoaded) {
                onVideoLoaded(video);
            }
        };

        // Добавляем слушатели событий
        video.addEventListener('error', handleError);
        video.addEventListener('loadeddata', handleLoad);
        video.addEventListener('canplay', handleLoad);

        // Загружаем видео
        video.src = videoUrl;
        video.load();

        // Очистка
        return () => {
            video.removeEventListener('error', handleError);
            video.removeEventListener('loadeddata', handleLoad);
            video.removeEventListener('canplay', handleLoad);
            video.src = '';
            video.load();
        };
    }, [videoUrl, onVideoLoaded]);

    // Реагируем на внешние элементы управления воспроизведением
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isVideoReady) return;

        // Синхронизируем состояние воспроизведения при необходимости
        if (typeof isPlaying === 'boolean') {
            if (isPlaying && video.paused) {
                console.log('VideoAnalyzer: Получена внешняя команда воспроизведения');
                manualPlayRequest.current = true;
                video.play().catch(e => {
                    console.error('Не удалось воспроизвести видео:', e);
                    manualPlayRequest.current = false;
                });
            } else if (!isPlaying && !video.paused) {
                console.log('VideoAnalyzer: Получена внешняя команда паузы');
                video.pause();

                // Если в режиме выбора танцора, make sure canvas is ready for frame capture
                if (isDancerSelectionMode) {
                    console.log('Видео поставлено на паузу извне в режиме выбора танцора, подготавливаем canvas');
                    setTimeout(() => {
                        setupCanvases();
                    }, 50); // Small delay to ensure the video is fully paused
                }
            }
        }

        // Синхронизируем позицию времени при необходимости
        if (typeof currentTime === 'number' && Math.abs(video.currentTime - currentTime) > 0.5) {
            console.log(`VideoAnalyzer: Получена внешняя команда перемотки на ${currentTime}с`);
            seekRequested.current = true;

            // Если видео уже достаточно загружено, перематываем немедленно
            if (video.readyState >= 3) {
                try {
                    video.currentTime = currentTime;

                    // Если в режиме выбора танцора и видео на паузе, ensure canvas is ready after seek
                    if (isDancerSelectionMode && video.paused) {
                        console.log('Видео перемотано извне в режиме выбора танцора, подготавливаем canvas');
                        setTimeout(() => {
                            setupCanvases();
                        }, 100); // Longer delay after seek to ensure video frame is loaded
                    }

                    seekRequested.current = false;
                } catch (err) {
                    console.error('Ошибка при немедленной перемотке:', err);
                }
            }
            // Otherwise the timeupdate handler will handle it
        }
    }, [isPlaying, currentTime, isVideoReady, isDancerSelectionMode, setupCanvases]);

    // Обновляем выбранного человека из внешних props
    useEffect(() => {
        if (externalSelectedPerson !== undefined) {
            setSelectedPerson(externalSelectedPerson);
        }
    }, [externalSelectedPerson]);

    // Проверяем, есть ли у компонента метод для правильного уведомления, когда видео загружено
    useEffect(() => {
        if (videoRef.current) {
            // Добавляем слушатель события 'loadeddata', чтобы знать, когда видео полностью загружено
            const videoElement = videoRef.current;

            const handleVideoLoaded = () => {
                console.log('VideoAnalyzer: Видео успешно загружено');
                if (onVideoLoaded) {
                    onVideoLoaded(videoRef.current);
                }
            };

            videoElement.addEventListener('loadeddata', handleVideoLoaded);

            // Также добавляем событие canplay в качестве резервного варианта
            videoElement.addEventListener('canplay', handleVideoLoaded);

            return () => {
                videoElement.removeEventListener('loadeddata', handleVideoLoaded);
                videoElement.removeEventListener('canplay', handleVideoLoaded);
            };
        }
    }, [videoRef, onVideoLoaded]);

    // Обрабатываем изменения качества видео
    useEffect(() => {
        if (videoRef.current) {
            const videoElement = videoRef.current;

            // Устанавливаем качество видео на основе prop
            if (videoQuality === 'high') {
                videoElement.setAttribute('controls', '');
                videoElement.style.objectFit = 'contain';

                // Для высококачественного воспроизведения длинных видео
                if (videoElement.duration > 180) { // длиннее 3 минут
                    // Понижаем настройки буфера для высокого качества, чтобы избежать проблем с памятью
                    videoElement.preload = 'auto';
                } else {
                    // Обычные настройки для коротких видео
                    videoElement.preload = 'auto';
                }
            } else {
                // Для низкого качества уменьшаем разрешение и убираем элементы управления
                videoElement.removeAttribute('controls');
                videoElement.style.objectFit = 'cover';

                // Устанавливаем более низкое разрешение для производительности
                if (videoElement.videoWidth > 640) {
                    videoElement.style.width = '640px';
                }

                // Используем другую стратегию буферизации для длинных видео в режиме низкого качества
                if (videoElement.duration > 180) {
                    videoElement.preload = 'auto';
                }
            }

            console.log('VideoAnalyzer: Качество видео установлено на', videoQuality);
        }
    }, [videoQuality, videoRef]);

    return (
        <div className="video-analyzer" style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
            {/* Элемент видео с оптимизированными настройками для длинных видео */}
            <video
                ref={videoRef}
                src={videoUrl}
                controls={!isDancerSelectionMode}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    pointerEvents: isDancerSelectionMode ? 'none' : 'auto',
                    display: videoError ? 'none' : 'block'
                }}
                // Атрибуты оптимизации производительности для длинных видео
                playsInline
                preload="auto"
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                // Добавляем важные атрибуты для оптимизированного воспроизведения видео
                disablePictureInPicture
                disableRemotePlayback
                muted
            />

            {/* Показываем сообщение об ошибке, если видео не удалось загрузить */}
            {videoError && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    maxWidth: '80%',
                    zIndex: 10
                }}>
                    <p>{videoError}</p>
                    <button
                        style={{
                            padding: '8px 15px',
                            backgroundColor: '#33D2FF',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginTop: '10px'
                        }}
                        onClick={() => {
                            setVideoError(null);
                            videoLoadAttempts.current = 0;
                            playbackErrorCount.current = 0;
                            if (videoRef.current) {
                                videoRef.current.load();
                            }
                        }}
                    >
                        Повторить
                    </button>
                </div>
            )}

            {/* Скрытый canvas для обработки кадров */}
            <canvas
                ref={canvasRef}
                style={{ display: 'none' }}
            />

            {/* Оверлейный canvas для отображения обнаружения поз */}
            <canvas
                ref={overlayCanvasRef}
                onClick={handleCanvasClick}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    pointerEvents: isDancerSelectionMode ? 'auto' : 'none',
                    cursor: isDancerSelectionMode ? 'crosshair' : 'default'
                }}
            />

            {/* Оверлей с инструкциями в режиме выбора танцора */}
            {isDancerSelectionMode && (
                <div
                    style={{
                        position: 'absolute',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '5px',
                        textAlign: 'center',
                        maxWidth: '80%',
                        zIndex: 10
                    }}
                >
                    Нажмите на танцора, чтобы выбрать его
                </div>
            )}

            {/* Сообщение о обработке или ошибке */}
            {showMessage && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: isProcessing ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '5px',
                        textAlign: 'center',
                        zIndex: 10
                    }}
                >
                    {isProcessing ?
                        'Обработка...' :
                        currentPoses.length ? 'Танцор не найден в месте клика' : 'Танцоры не обнаружены'}
                </div>
            )}
        </div>
    );
};

export default VideoAnalyzer; 