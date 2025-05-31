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

    // Initialize canvas sizes when video is ready - MOVED THIS FUNCTION TO THE TOP
    const setupCanvases = useCallback(() => {
        if (!videoRef.current) return false;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const overlay = overlayCanvasRef.current;

        if (canvas && video.videoWidth && video.videoHeight) {
            console.log(`Setting up canvases for native video resolution: ${video.videoWidth}x${video.videoHeight}`);

            // Set the main canvas size to match video's native resolution
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Set the overlay canvas size to match video's native resolution
            if (overlay) {
                // Always use the original video dimensions for the canvas size
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;

                console.log(`Overlay canvas set to: ${overlay.width}x${overlay.height}`);
            }

            // Log current video status to help with debugging
            console.log(`Video status: currentTime=${video.currentTime}s, paused=${video.paused}, readyState=${video.readyState}`);

            return true; // Return true if setup was successful
        } else {
            // Log error information if setup failed
            console.warn(`Canvas setup failed: video dimensions not available (${video.videoWidth}x${video.videoHeight})`);

            if (video.readyState < 2) {
                console.warn(`Video not ready yet, readyState=${video.readyState}`);
            }

            return false; // Return false if setup failed
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

            // Use the queue to manage the request
            const result = await requestQueue.current.add(makeRequest);

            const processingTime = performance.now() - startTime;
            lastProcessingDuration.current = processingTime;

            // Only process result if we're still in the right mode
            if (isDancerSelectionMode || videoRef.current.paused) {
                // Set smart frame skipping based on processing time
                if (settings.smartSkipping) {
                    const skipFrames = Math.floor(processingTime / computedSettings.frameInterval);
                    framesToSkip.current = Math.min(5, skipFrames); // Cap at 5 frames to skip
                }

                // Handle response
                if (result.image && canvasRef.current && overlayCanvasRef.current) {
                    // Create image from response
                    const img = new Image();
                    img.onload = () => {
                        // Only draw if we're still in dancer selection mode
                        if (!isDancerSelectionMode && !videoRef.current.paused) return;

                        const overlay = overlayCanvasRef.current;
                        if (!overlay) return;

                        const ctx = overlay.getContext('2d');
                        ctx.clearRect(0, 0, overlay.width, overlay.height);
                        ctx.drawImage(img, 0, 0, overlay.width, overlay.height);
                    };

                    // Set image source with error handling
                    img.onerror = (err) => {
                        console.error("Failed to load image:", err);
                    };

                    img.src = result.image;
                }

                // Process landmarks
                if (result.poses && result.poses.length > 0) {
                    setCurrentPoses(result.poses);
                    lastDetectedPoses.current = result.poses;

                    // Handle selected pose if provided
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

    // Optimized pose similarity calculation with caching
    const calculatePoseSimilarity = (pose1, pose2) => {
        if (!pose1 || !pose2) return 0;

        // Create a cache key
        const keypoints1 = JSON.stringify(pose1.keypoints.map(kp => [Math.round(kp.x), Math.round(kp.y), kp.score > 0.5 ? 1 : 0]));
        const keypoints2 = JSON.stringify(pose2.keypoints.map(kp => [Math.round(kp.x), Math.round(kp.y), kp.score > 0.5 ? 1 : 0]));

        const cacheKey = keypoints1 + '|' + keypoints2;
        const reverseCacheKey = keypoints2 + '|' + keypoints1;

        // Check cache
        if (poseSimilarityCache.current.has(cacheKey)) {
            return poseSimilarityCache.current.get(cacheKey);
        }

        if (poseSimilarityCache.current.has(reverseCacheKey)) {
            return poseSimilarityCache.current.get(reverseCacheKey);
        }

        // Calculate similarity if not in cache
        let totalScore = 0;
        let validPoints = 0;
        let importantPointsScore = 0;
        let importantPointsCount = 0;

        // Define important keypoints for tracking (shoulders, hips, head)
        const importantIndices = [0, 11, 12, 23, 24]; // assuming these are the indices for head, shoulders, hips

        pose1.keypoints.forEach((kp1, i) => {
            const kp2 = pose2.keypoints[i];
            const isImportant = importantIndices.includes(i);

            if (kp1.score > 0.5 && kp2.score > 0.5) {
                const dx = kp1.x - kp2.x;
                const dy = kp1.y - kp2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const similarity = Math.max(0, 1 - distance / 120);  // Adjusted normalization

                totalScore += similarity;
                validPoints++;

                if (isImportant) {
                    importantPointsScore += similarity;
                    importantPointsCount++;
                }
            }
        });

        // Calculate overall similarity with emphasis on important points
        let finalScore = 0;
        if (validPoints > 0) {
            const regularScore = totalScore / validPoints;
            const importantScore = importantPointsCount > 0 ? importantPointsScore / importantPointsCount : 0;
            finalScore = regularScore * 0.4 + importantScore * 0.6;  // Weight important points higher
        }

        // Cache the result (limit cache size to prevent memory issues)
        if (poseSimilarityCache.current.size > 1000) {
            // Clear half the cache when it gets too large
            const keys = Array.from(poseSimilarityCache.current.keys());
            keys.slice(0, 500).forEach(key => poseSimilarityCache.current.delete(key));
        }

        poseSimilarityCache.current.set(cacheKey, finalScore);
        return finalScore;
    };

    // Video processing setup - OPTIMIZED to only activate processing in dancer selection mode
    useEffect(() => {
        if (!videoRef.current || !canvasRef.current || !isVideoReady) {
            return;
        }

        const video = videoRef.current;

        const handlePlay = () => {
            console.log('Video started playing');

            // Clean the overlay on playback start
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }

            // Disable automatic frame processing - only process on click
            isProcessingRef.current = false;
            setIsProcessing(false);

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            // If in dancer selection mode, pause the video
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

            // If in dancer selection mode, make sure canvases are set up for capture
            if (isDancerSelectionMode) {
                console.log('Video paused in dancer selection mode, preparing canvas for frame capture');
                setTimeout(() => {
                    setupCanvases();
                }, 50); // Small delay to ensure the video is fully paused
            }
        };

        const handleEnded = () => {
            console.log('Video ended');

            // Clear any overlays
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

        // Add timeupdate listener to handle long videos
        const handleTimeUpdate = () => {
            // This event fires regularly during playback
            // For long videos, this confirms the video is still playing
            if (video.currentTime > 0 && !video.paused) {
                // Video is playing successfully
            }

            // If in dancer selection mode and video is paused, ensure canvas is ready
            // This helps when the video has been seeked to a different position
            if (isDancerSelectionMode && video.paused) {
                // Only update if it's been a while since the last update or if seek was requested
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

    // React to changes in dancer selection mode
    useEffect(() => {
        if (!videoRef.current) return;

        console.log('Dancer selection mode changed:', isDancerSelectionMode);

        const video = videoRef.current;

        if (isDancerSelectionMode) {
            // Entering dancer selection mode

            // If video is playing, pause it
            if (!video.paused) {
                video.pause();
                pausedForSelectionRef.current = true;
            }

            // Make sure canvases are set up with correct dimensions when entering dancer selection mode
            // This ensures we're ready to capture the current frame
            setTimeout(() => {
                const setupSuccess = setupCanvases();
                console.log(`Canvas setup in dancer selection mode: ${setupSuccess ? 'successful' : 'failed'}`);
            }, 100); // Small delay to ensure video is fully paused

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
            // Exiting dancer selection mode

            // Stop processing to save resources
            isProcessingRef.current = false;
            setIsProcessing(false);

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            // Reset pause flag
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
        // Only process clicks in dancer selection mode and when video is paused
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
                throw new Error("Video or canvas elements not available");
            }

            // Make sure canvas is properly set up with correct dimensions
            // This ensures we're working with the current video dimensions
            setupCanvases();

            // Очищаем предыдущие результаты
            const overlayCtx = overlay.getContext('2d');
            overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

            // Get overlay position and dimensions
            const overlayRect = overlay.getBoundingClientRect();

            // Get original video dimensions
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            // Calculate the actual displayed video dimensions within the overlay
            const containerWidth = overlayRect.width;
            const containerHeight = overlayRect.height;
            const videoAspect = videoWidth / videoHeight;
            const containerAspect = containerWidth / containerHeight;

            let displayedWidth, displayedHeight, offsetX = 0, offsetY = 0;

            if (containerAspect > videoAspect) {
                // Video height is constrained to container height
                displayedHeight = containerHeight;
                displayedWidth = displayedHeight * videoAspect;
                // Calculate left offset for centering
                offsetX = (containerWidth - displayedWidth) / 2;
            } else {
                // Video width is constrained to container width
                displayedWidth = containerWidth;
                displayedHeight = displayedWidth / videoAspect;
                // Calculate top offset for centering
                offsetY = (containerHeight - displayedHeight) / 2;
            }

            // Calculate click position relative to the video display area
            const clickX = event.clientX - overlayRect.left - offsetX;
            const clickY = event.clientY - overlayRect.top - offsetY;

            // Convert click position to video coordinates
            const videoX = (clickX / displayedWidth) * videoWidth;
            const videoY = (clickY / displayedHeight) * videoHeight;

            console.log(`Click at client (${event.clientX}, ${event.clientY})`);
            console.log(`Video display: ${displayedWidth}x${displayedHeight} with offset (${offsetX}, ${offsetY})`);
            console.log(`Mapped to video coordinates: (${videoX}, ${videoY})`);

            // Skip if the click is outside the video display area
            if (clickX < 0 || clickX > displayedWidth || clickY < 0 || clickY > displayedHeight) {
                console.log("Click outside of video area");
                setIsProcessing(false);
                setShowMessage(false);
                return;
            }

            // Ensure video frame is captured to canvas with correct dimensions
            canvas.width = videoWidth;
            canvas.height = videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // Очищаем канвас перед рисованием
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw the CURRENT video frame on canvas
            // This ensures we get the frame that's currently paused
            console.log(`Drawing current paused frame at time ${video.currentTime}s`);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas to blob for API request with proper BGR encoding
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.95);
            });

            // Send request to backend for pose detection with click coordinates
            console.log("Sending request for pose detection...");
            const result = await requestQueue.current.add(() =>
                processVideoFrame(blob, {
                    overlay: true,
                    resize: settings.resizeEnabled,
                    clickX: Math.round(videoX),
                    clickY: Math.round(videoY)
                })
            );

            console.log("Got result from server:", result);

            if (result.error) {
                console.error("Server returned error:", result.error);
                throw new Error(result.error);
            }

            // Check if poses were detected
            if (result.poses && result.poses.length > 0) {
                console.log(`Detected ${result.poses.length} poses, selected index: ${result.selected_pose_index}`);
                const poses = result.poses;
                setCurrentPoses(poses);

                // Get the selected pose if available
                if (result.selected_pose_index !== undefined) {
                    const selectedPose = result.selected_pose_index;
                    console.log("Selected pose:", selectedPose);
                    setSelectedPerson(selectedPose);

                    if (onPersonSelected) {
                        onPersonSelected(selectedPose);
                    }

                    // Draw the pose overlay
                    if (result.image) {
                        console.log("Drawing pose overlay from server image");
                        const img = new Image();
                        img.onload = () => {
                            if (!overlayCanvasRef.current) return;
                            const ctx = overlayCanvasRef.current.getContext('2d');
                            ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                            ctx.drawImage(img, 0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                        };
                        img.onerror = (err) => {
                            console.error("Failed to load pose overlay image:", err);
                        };
                        img.src = result.image;
                    } else {
                        console.warn("No image data in result");
                    }

                    setShowMessage(false);
                } else {
                    // No pose was close to the click point
                    console.warn("No pose selected near click point");
                    setShowMessage(true);
                    setTimeout(() => setShowMessage(false), 3000);
                }
            } else {
                // No poses detected
                console.warn("No poses detected in the frame");
                setCurrentPoses([]);
                setSelectedPerson(null);
                setShowMessage(true);
                setTimeout(() => setShowMessage(false), 3000);
            }
        } catch (error) {
            console.error("Error processing click:", error);
            setShowMessage(true);
            setTimeout(() => setShowMessage(false), 3000);
        } finally {
            setIsProcessing(false);
        }
    }, [isDancerSelectionMode, onPersonSelected, settings.resizeEnabled, setupCanvases]);

    // Initialize video element with proper error handling
    useEffect(() => {
        if (!videoRef.current || !videoUrl) return;

        const video = videoRef.current;
        console.log('Setting up video with URL:', videoUrl);

        // Reset error state
        setVideoError(null);
        videoLoadAttempts.current = 0;

        // Configure video element
        video.crossOrigin = "anonymous"; // Enable CORS
        video.preload = "auto";
        video.playsInline = true;
        video.muted = true; // Mute to allow autoplay

        // Set up error handling
        const handleError = (error) => {
            console.error('Video error:', error);
            setVideoError(error);

            // Try to recover
            if (videoLoadAttempts.current < 3) {
                videoLoadAttempts.current++;
                console.log(`Retrying video load (attempt ${videoLoadAttempts.current})`);
                setTimeout(() => {
                    video.load();
                }, 1000 * videoLoadAttempts.current);
            }
        };

        // Set up load handling
        const handleLoad = () => {
            console.log('Video loaded successfully');
            setIsVideoReady(true);
            if (onVideoLoaded) {
                onVideoLoaded(video);
            }
        };

        // Add event listeners
        video.addEventListener('error', handleError);
        video.addEventListener('loadeddata', handleLoad);
        video.addEventListener('canplay', handleLoad);

        // Load video
        video.src = videoUrl;
        video.load();

        // Cleanup
        return () => {
            video.removeEventListener('error', handleError);
            video.removeEventListener('loadeddata', handleLoad);
            video.removeEventListener('canplay', handleLoad);
            video.src = '';
            video.load();
        };
    }, [videoUrl, onVideoLoaded]);

    // Respond to external playback controls
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isVideoReady) return;

        // Synchronize playback state if needed
        if (typeof isPlaying === 'boolean') {
            if (isPlaying && video.paused) {
                console.log('VideoAnalyzer: External play command received');
                manualPlayRequest.current = true;
                video.play().catch(e => {
                    console.error('Failed to play video:', e);
                    manualPlayRequest.current = false;
                });
            } else if (!isPlaying && !video.paused) {
                console.log('VideoAnalyzer: External pause command received');
                video.pause();

                // If in dancer selection mode, make sure canvas is ready for frame capture
                if (isDancerSelectionMode) {
                    console.log('Video externally paused in dancer selection mode, preparing canvas');
                    setTimeout(() => {
                        setupCanvases();
                    }, 50); // Small delay to ensure the video is fully paused
                }
            }
        }

        // Synchronize time position if needed
        if (typeof currentTime === 'number' && Math.abs(video.currentTime - currentTime) > 0.5) {
            console.log(`VideoAnalyzer: External seek command received to ${currentTime}s`);
            seekRequested.current = true;

            // If the video is already loaded enough, seek immediately
            if (video.readyState >= 3) {
                try {
                    video.currentTime = currentTime;

                    // If in dancer selection mode and video is paused, ensure canvas is ready after seek
                    if (isDancerSelectionMode && video.paused) {
                        console.log('Video externally seeked in dancer selection mode, preparing canvas');
                        setTimeout(() => {
                            setupCanvases();
                        }, 100); // Longer delay after seek to ensure video frame is loaded
                    }

                    seekRequested.current = false;
                } catch (err) {
                    console.error('Error during immediate seek:', err);
                }
            }
            // Otherwise the timeupdate handler will handle it
        }
    }, [isPlaying, currentTime, isVideoReady, isDancerSelectionMode, setupCanvases]);

    // Update selected person from external props
    useEffect(() => {
        if (externalSelectedPerson !== undefined) {
            setSelectedPerson(externalSelectedPerson);
        }
    }, [externalSelectedPerson]);

    // Check if the component has a method to properly notify when video is loaded
    useEffect(() => {
        if (videoRef.current) {
            // Add event listener for 'loadeddata' event to know when video is fully loaded
            const videoElement = videoRef.current;

            const handleVideoLoaded = () => {
                console.log('VideoAnalyzer: Video loaded successfully');
                if (onVideoLoaded) {
                    onVideoLoaded(videoRef.current);
                }
            };

            videoElement.addEventListener('loadeddata', handleVideoLoaded);

            // Also add canplay event as a fallback
            videoElement.addEventListener('canplay', handleVideoLoaded);

            return () => {
                videoElement.removeEventListener('loadeddata', handleVideoLoaded);
                videoElement.removeEventListener('canplay', handleVideoLoaded);
            };
        }
    }, [videoRef, onVideoLoaded]);

    // Handle video quality changes
    useEffect(() => {
        if (videoRef.current) {
            const videoElement = videoRef.current;

            // Set video quality based on the prop
            if (videoQuality === 'high') {
                videoElement.setAttribute('controls', '');
                videoElement.style.objectFit = 'contain';

                // For high quality playback of long videos
                if (videoElement.duration > 180) { // longer than 3 minutes
                    // Lower buffer settings for high quality to avoid memory issues
                    videoElement.preload = 'auto';
                } else {
                    // Regular settings for shorter videos
                    videoElement.preload = 'auto';
                }
            } else {
                // For low quality, reduce resolution and remove controls
                videoElement.removeAttribute('controls');
                videoElement.style.objectFit = 'cover';

                // Set lower resolution for performance
                if (videoElement.videoWidth > 640) {
                    videoElement.style.width = '640px';
                }

                // Use different buffer strategy for long videos in low quality mode
                if (videoElement.duration > 180) {
                    videoElement.preload = 'auto';
                }
            }

            console.log('VideoAnalyzer: Video quality set to', videoQuality);
        }
    }, [videoQuality, videoRef]);

    return (
        <div className="video-analyzer" style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
            {/* Video element with optimized settings for long videos */}
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
                // Performance optimization attributes for long videos
                playsInline
                preload="auto"
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                // Add important attributes for optimized video playback
                disablePictureInPicture
                disableRemotePlayback
                muted
            />

            {/* Show error message if video fails to load */}
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

            {/* Hidden canvas for processing frames */}
            <canvas
                ref={canvasRef}
                style={{ display: 'none' }}
            />

            {/* Overlay canvas for displaying pose detection */}
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

            {/* Instruction overlay in dancer selection mode */}
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
                    Click on a dancer to select them
                </div>
            )}

            {/* Processing or error message */}
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
                        'Processing...' :
                        currentPoses.length ? 'No dancer found at click position' : 'No dancers detected'}
                </div>
            )}
        </div>
    );
};

export default VideoAnalyzer; 