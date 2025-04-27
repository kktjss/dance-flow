import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import { Box, Button, CircularProgress, Typography, Alert } from '@mui/material';
import * as THREE from 'three';

// Компонент для отображения ошибки внутри Canvas
function ErrorFallback({ error }) {
    return (
        <Html center>
            <div style={{
                background: 'rgba(255, 0, 0, 0.1)',
                padding: '20px',
                borderRadius: '8px',
                maxWidth: '300px',
                textAlign: 'center'
            }}>
                <h3 style={{ color: 'red' }}>Ошибка загрузки модели</h3>
                <p>{error.message}</p>
            </div>
        </Html>
    );
}

// Компонент загрузки для Suspense
function ModelLoadingIndicator() {
    return (
        <Html center>
            <CircularProgress />
            <p style={{ marginTop: '10px' }}>Загрузка модели...</p>
        </Html>
    );
}

// Компонент 3D-модели Hatsune Miku
function MikuModel({ onError }) {
    const modelRef = useRef();
    const [error, setError] = useState(null);
    const [loadAttempted, setLoadAttempted] = useState(false);

    console.log('Рендер компонента MikuModel, попытка:', loadAttempted);

    // Обработка случая, когда onError не передан
    const handleError = (e) => {
        console.error('Ошибка в MikuModel:', e);
        setError(e);
        if (onError && typeof onError === 'function') {
            onError(e);
        }
    };

    // Вызов хука useGLTF безусловно
    const { scene, animations } = useGLTF('/models/hatsune_miku.glb', {
        onProgress: (xhr) => {
            console.log(`Загрузка модели: ${Math.floor((xhr.loaded / xhr.total) * 100)}%`);
        },
        onError: (e) => {
            console.error('Ошибка загрузки модели:', e);
            handleError(e);
        }
    });

    console.log('После useGLTF:', {
        сцена_существует: !!scene,
        анимаций: animations?.length,
        тип_сцены: scene ? typeof scene : 'undefined',
        свойства_сцены: scene ? Object.keys(scene) : []
    });

    useEffect(() => {
        setLoadAttempted(true);
    }, []);

    // Хук useEffect тоже вызываем безусловно
    useEffect(() => {
        console.log('useEffect запущен, scene:', !!scene, 'animations:', !!animations);
        try {
            if (!scene) {
                console.error('Сцена не загружена');
                return;
            }

            console.log('Модель успешно загружена:', {
                тип: typeof scene,
                isObject3D: scene instanceof THREE.Object3D,
                children: scene.children?.length
            });
            console.log('Анимации:', animations && animations.length);

            // Создаем миксер анимаций
            const mixer = new THREE.AnimationMixer(scene);

            // Если есть анимации - проигрываем первую
            if (animations && animations.length > 0) {
                const action = mixer.clipAction(animations[0]);
                action.play();
                console.log('Воспроизводится анимация:', animations[0].name);
            }

            // Анимационный цикл
            const clock = new THREE.Clock();
            const animate = () => {
                const delta = clock.getDelta();
                mixer.update(delta);
                return requestAnimationFrame(animate);
            };

            const animationId = animate();

            return () => {
                cancelAnimationFrame(animationId);
                mixer.stopAllAction();
            };
        } catch (e) {
            console.error('Ошибка в анимации:', e);
            handleError(e);
        }
    }, [scene, animations]);

    // Если ошибка - показываем сообщение об ошибке
    if (error) return <ErrorFallback error={error} />;

    return scene ? (
        <primitive
            ref={modelRef}
            object={scene}
            scale={[0.02, 0.02, 0.02]}
            position={[0, -1, 0]}
            rotation={[0, Math.PI, 0]}
        />
    ) : null;
}

// Запасная 3D-модель (простой человечек)
function FallbackModel() {
    return (
        <group>
            {/* Тело танцора */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.5, 1, 0.3]} />
                <meshStandardMaterial color="#f5a742" />
            </mesh>
            {/* Голова */}
            <mesh position={[0, 0.65, 0]}>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshStandardMaterial color="#f8c471" />
            </mesh>
            {/* Руки */}
            <mesh position={[0.4, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.8]} />
                <meshStandardMaterial color="#f5a742" />
            </mesh>
            <mesh position={[-0.4, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.8]} />
                <meshStandardMaterial color="#f5a742" />
            </mesh>
            {/* Ноги */}
            <mesh position={[0.2, -0.7, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.7]} />
                <meshStandardMaterial color="#5d4037" />
            </mesh>
            <mesh position={[-0.2, -0.7, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.7]} />
                <meshStandardMaterial color="#5d4037" />
            </mesh>
        </group>
    );
}

// Компонент 3D-сцены с обработкой ошибок
function Scene({ dancerName }) {
    const [modelError, setModelError] = useState(null);
    console.log('Рендер компонента Scene, текущая ошибка модели:', modelError);

    // Обработчик ошибок для модели
    const handleModelError = (error) => {
        console.error('Получена ошибка модели:', error);
        setModelError(error);
    };

    return (
        <>
            {modelError && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, m: 2 }}>
                    <Alert severity="error">
                        Ошибка загрузки модели: {modelError.message}
                    </Alert>
                </Box>
            )}

            <Canvas
                camera={{ position: [0, 0, 5], fov: 50 }}
                style={{ background: '#f5f5f5' }}
                onError={(e) => {
                    console.error('Ошибка Canvas:', e);
                    setModelError(e);
                }}
            >
                <Suspense fallback={<ModelLoadingIndicator />}>
                    <ambientLight intensity={0.8} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <spotLight position={[-5, 5, 5]} intensity={0.8} />

                    {/* Пробуем загрузить Miku, если ошибка - показываем запасную модель */}
                    {modelError ? <FallbackModel /> : <MikuModel onError={handleModelError} />}

                    <gridHelper args={[10, 10]} />
                    <OrbitControls />
                </Suspense>
            </Canvas>
        </>
    );
}

// Компонент загрузки 
function Loading() {
    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
                gap: 2
            }}
        >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
                Загрузка 3D-визуализации...
            </Typography>
        </Box>
    );
}

// Основной компонент просмотрщика хореографии
function ChoreographyViewer({ dancerId, dancerName, videoUrl }) {
    const [viewMode, setViewMode] = useState('3d'); // '3d' или 'video'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Эффект для симуляции загрузки
    useEffect(() => {
        if (viewMode === '3d') {
            setLoading(true);
            setError(null);

            const timer = setTimeout(() => {
                setLoading(false);
            }, 1500);

            return () => clearTimeout(timer);
        } else {
            setLoading(false);
        }
    }, [viewMode]);

    // Предварительно загружаем модель
    useEffect(() => {
        console.log('Запуск предварительной загрузки модели...');

        // Проверим доступность файла модели
        fetch('/models/hatsune_miku.glb')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP: ${response.status}`);
                }
                console.log('Файл модели доступен по указанному пути!');
                return response.blob();
            })
            .then(blob => {
                console.log('Размер файла модели:', (blob.size / (1024 * 1024)).toFixed(2), 'MB');
            })
            .catch(error => {
                console.error('Ошибка проверки доступности модели:', error);
                setError(new Error(`Не удалось загрузить модель: ${error.message}`));
            });

        try {
            useGLTF.preload('/models/hatsune_miku.glb', {
                onProgress: (xhr) => {
                    console.log(`Предзагрузка: ${Math.floor((xhr.loaded / xhr.total) * 100)}%`);
                },
                onError: (e) => {
                    console.error('Ошибка предзагрузки:', e);
                    setError(e);
                }
            });
        } catch (e) {
            console.error('Необработанная ошибка предзагрузки:', e);
            setError(e);
        }
    }, []);

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Отображение ошибки, если есть */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Ошибка загрузки 3D-модели: {error.message}
                </Alert>
            )}

            {/* Переключатель режимов просмотра */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Button
                    variant={viewMode === '3d' ? 'contained' : 'outlined'}
                    onClick={() => setViewMode('3d')}
                >
                    3D модель
                </Button>
                <Button
                    variant={viewMode === 'video' ? 'contained' : 'outlined'}
                    onClick={() => setViewMode('video')}
                    disabled={!videoUrl}
                >
                    Видео
                </Button>
            </Box>

            {/* Контейнер для содержимого */}
            <Box sx={{
                flexGrow: 1,
                overflow: 'hidden',
                borderRadius: 1,
                bgcolor: '#f5f5f5',
                position: 'relative'
            }}>
                {loading && <Loading />}

                {viewMode === '3d' && !loading ? (
                    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                        <Scene dancerName={dancerName} />
                    </Box>
                ) : viewMode === 'video' ? (
                    <Box sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        {videoUrl ? (
                            <video
                                controls
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                src={videoUrl}
                            />
                        ) : (
                            <Typography variant="body1" color="text.secondary">
                                Видео не загружено
                            </Typography>
                        )}
                    </Box>
                ) : null}
            </Box>

            {/* Информация о танцоре */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">
                    {dancerName || 'Танцор'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    ID: {dancerId || 'не задан'}
                </Typography>
            </Box>
        </Box>
    );
}

export default ChoreographyViewer; 