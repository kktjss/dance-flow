import React, { useRef, useEffect, useState } from 'react';

const VideoAnalyzer = ({ videoUrl, onPersonSelected, selectedPerson: externalSelectedPerson, isDancerSelectionMode }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentPoses, setCurrentPoses] = useState([]);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const lastProcessTime = useRef(0);
    const FRAME_INTERVAL = 1000 / 30; // 30 FPS
    const animationFrameRef = useRef(null);
    const isProcessingRef = useRef(false);

    // Логируем изменение режима выбора танцора
    useEffect(() => {
        console.log('Dancer selection mode changed:', isDancerSelectionMode);
    }, [isDancerSelectionMode]);

    // Обновляем внутреннее состояние при изменении внешнего
    useEffect(() => {
        console.log('External selected person changed:', externalSelectedPerson);
        setSelectedPerson(externalSelectedPerson);
    }, [externalSelectedPerson]);

    // Обработка готовности видео
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleVideoReady = () => {
            console.log('Video is ready to play');
            setIsVideoReady(true);
        };

        const handleVideoError = (error) => {
            console.error('Error loading video:', error);
        };

        if (video.readyState >= 3) {
            handleVideoReady();
        }

        video.addEventListener('loadeddata', handleVideoReady);
        video.addEventListener('canplay', handleVideoReady);
        video.addEventListener('error', handleVideoError);

        return () => {
            video.removeEventListener('loadeddata', handleVideoReady);
            video.removeEventListener('canplay', handleVideoReady);
            video.removeEventListener('error', handleVideoError);
        };
    }, [videoUrl]);

    // Обработка видео
    useEffect(() => {
        console.log('Video processing effect triggered:', {
            hasVideo: !!videoRef.current,
            hasCanvas: !!canvasRef.current,
            isVideoReady,
            videoState: videoRef.current?.readyState
        });

        if (!videoRef.current || !canvasRef.current || !isVideoReady) {
            console.log('Missing dependencies:', {
                video: !!videoRef.current,
                canvas: !!canvasRef.current,
                isVideoReady,
                videoState: videoRef.current?.readyState
            });
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get canvas context');
            return;
        }

        const processFrame = async (timestamp) => {
            console.log('Frame processing attempt:', {
                isProcessing: isProcessingRef.current,
                isVideoReady,
                videoState: video.readyState,
                currentTime: video.currentTime
            });

            if (!isProcessingRef.current || !isVideoReady) {
                console.log('Skipping frame processing:', {
                    isProcessing: isProcessingRef.current,
                    isVideoReady,
                    videoState: video.readyState
                });
                return;
            }

            if (timestamp - lastProcessTime.current < FRAME_INTERVAL) {
                animationFrameRef.current = requestAnimationFrame(processFrame);
                return;
            }
            lastProcessTime.current = timestamp;

            try {
                console.log('Starting frame processing...');

                // Устанавливаем размеры canvas равными размерам видео
                const videoWidth = video.videoWidth;
                const videoHeight = video.videoHeight;
                console.log('Frame dimensions:', { width: videoWidth, height: videoHeight });

                // Обновляем размеры canvas
                canvas.width = videoWidth;
                canvas.height = videoHeight;

                // Очищаем и рисуем видео
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Получаем кадр как blob
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                if (!blob) {
                    console.error('Failed to create blob from canvas');
                    return;
                }
                console.log('Frame blob created:', blob.size, 'bytes');

                // Создаем FormData для отправки
                const formData = new FormData();
                formData.append('file', blob, 'frame.jpg');

                // Отправляем кадр на сервер
                console.log('Sending frame to server...');
                const response = await fetch('http://127.0.0.1:8000/process-frame', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json',
                    },
                    mode: 'cors',
                    credentials: 'omit'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                console.log('Server response:', {
                    success: result.success,
                    message: result.message,
                    hasImage: !!result.image,
                    landmarksCount: result.landmarks?.length
                });

                if (result.success) {
                    // Отображаем обработанное изображение
                    const img = new Image();
                    img.onload = () => {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    };
                    img.src = `data:image/jpeg;base64,${result.image}`;

                    // Обновляем состояние с позами
                    const pose = {
                        keypoints: result.landmarks.map((landmark, index) => ({
                            name: `keypoint_${index}`,
                            x: landmark.x * canvas.width,
                            y: landmark.y * canvas.height,
                            score: landmark.visibility
                        }))
                    };

                    console.log('Setting poses:', {
                        keypointsCount: pose.keypoints.length,
                        firstKeypoint: pose.keypoints[0]
                    });
                    setCurrentPoses([pose]);
                } else {
                    console.log('No pose detected in frame:', result.message);
                    setCurrentPoses([]);
                }
            } catch (error) {
                console.error('Error processing frame:', error);
                setCurrentPoses([]);
            }

            animationFrameRef.current = requestAnimationFrame(processFrame);
        };

        const handlePlay = () => {
            console.log('Video started playing, starting pose detection');
            isProcessingRef.current = true;
            setIsProcessing(true);
            if (!animationFrameRef.current) {
                console.log('Starting animation frame');
                animationFrameRef.current = requestAnimationFrame(processFrame);
            }
        };

        const handlePause = () => {
            console.log('Video paused, stopping pose detection');
            isProcessingRef.current = false;
            setIsProcessing(false);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };

        const handleEnded = () => {
            console.log('Video ended, stopping pose detection');
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

        return () => {
            console.log('Cleaning up video processing effect');
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isVideoReady]);

    // Функция для проверки, находится ли точка клика внутри позы
    const isPointInPose = (x, y, pose) => {
        if (!pose || !pose.keypoints) return false;

        // Находим границы позы
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pose.keypoints.forEach(keypoint => {
            if (keypoint.score > 0.5) {
                minX = Math.min(minX, keypoint.x);
                minY = Math.min(minY, keypoint.y);
                maxX = Math.max(maxX, keypoint.x);
                maxY = Math.max(maxY, keypoint.y);
            }
        });

        // Добавляем отступ для более удобного выбора
        const padding = 20;
        return x >= minX - padding && x <= maxX + padding &&
            y >= minY - padding && y <= maxY + padding;
    };

    // Обработчик клика по canvas
    const handleCanvasClick = (event) => {
        if (!isDancerSelectionMode || !currentPoses.length) {
            console.log('Cannot select dancer:', {
                isDancerSelectionMode,
                hasPoses: currentPoses.length > 0
            });
            return;
        }

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        console.log('Canvas click:', { x, y, poses: currentPoses.length });

        // Ищем позу, в которой находится точка клика
        const clickedPoseIndex = currentPoses.findIndex(pose => isPointInPose(x, y, pose));

        if (clickedPoseIndex !== -1) {
            console.log('Dancer selected:', clickedPoseIndex);
            setSelectedPerson(clickedPoseIndex);
            if (onPersonSelected) {
                onPersonSelected(clickedPoseIndex);
            }
        } else {
            console.log('No dancer clicked');
            setSelectedPerson(null);
            if (onPersonSelected) {
                onPersonSelected(null);
            }
        }
    };

    return (
        <div
            className="relative"
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden'
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                <video
                    ref={videoRef}
                    src={videoUrl}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        pointerEvents: isDancerSelectionMode ? 'none' : 'auto'
                    }}
                    controls
                    playsInline
                    preload="auto"
                />
                <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: isDancerSelectionMode ? 'auto' : 'none',
                        cursor: isDancerSelectionMode ? 'pointer' : 'default',
                        objectFit: 'contain'
                    }}
                />
                {isDancerSelectionMode && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            pointerEvents: 'none',
                            border: '2px solid #4caf50',
                            boxSizing: 'border-box'
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default VideoAnalyzer; 