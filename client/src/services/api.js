import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Создаем экземпляр axios с базовой конфигурацией
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Добавляем перехватчик запросов для добавления токена авторизации
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        console.log('Current token:', token); // Отладочный лог
        if (token) {
            // Убеждаемся, что объект headers существует
            config.headers = config.headers || {};
            // Устанавливаем заголовок Authorization
            config.headers['Authorization'] = `Bearer ${token}`;
            console.log('Request headers:', config.headers); // Отладочный лог
        } else {
            console.warn('No token found in localStorage'); // Отладочный лог
        }
        return config;
    },
    (error) => {
        console.error('Request interceptor error:', error); // Отладочный лог
        return Promise.reject(error);
    }
);

// Добавляем перехватчик ответов для обработки ошибок
api.interceptors.response.use(
    (response) => {
        console.log('Response received:', response.status); // Отладочный лог
        return response;
    },
    (error) => {
        console.error('Response error:', {
            status: error.response?.status,
            data: error.response?.data,
            headers: error.response?.headers
        }); // Отладочный лог

        if (error.response?.status === 401) {
            console.log('Unauthorized access, redirecting to login...'); // Отладочный лог
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const authService = {
    login: async (credentials) => {
        try {
            console.log('Attempting login with credentials:', credentials); // Отладочный лог
            const response = await api.post('/auth/login', credentials);
            console.log('Login response:', response.data); // Отладочный лог

            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                console.log('Token saved to localStorage'); // Отладочный лог
                // Проверяем, что токен был сохранен
                const savedToken = localStorage.getItem('token');
                console.log('Verified saved token:', savedToken); // Отладочный лог
            } else {
                console.warn('No token in login response'); // Отладочный лог
            }
            return response.data;
        } catch (error) {
            console.error('Login error:', error.response?.data || error.message); // Отладочный лог
            throw error;
        }
    },
    register: async (userData) => {
        try {
            const response = await api.post('/auth/register', userData);
            console.log('Register response:', response.data); // Отладочный лог
            return response.data;
        } catch (error) {
            console.error('Register error:', error.response?.data || error.message); // Отладочный лог
            throw error;
        }
    },
    logout: () => {
        console.log('Logging out, removing token...'); // Отладочный лог
        localStorage.removeItem('token');
        // Проверяем, что токен был удален
        const tokenAfterLogout = localStorage.getItem('token');
        console.log('Token after logout:', tokenAfterLogout); // Отладочный лог
    }
};

export const projectService = {
    getProjects: async () => {
        try {
            console.log('Fetching projects...'); // Отладочный лог
            const token = localStorage.getItem('token');
            console.log('Token before fetch:', token); // Отладочный лог

            const response = await api.get('/projects');
            console.log('Projects response:', response.data); // Отладочный лог
            return response.data;
        } catch (error) {
            console.error('Get projects error:', error.response?.data || error.message); // Отладочный лог
            throw error;
        }
    },
    createProject: async (projectData) => {
        try {
            const response = await api.post('/projects', projectData);
            return response.data;
        } catch (error) {
            console.error('Create project error:', error.response?.data || error.message); // Отладочный лог
            throw error;
        }
    },
    updateProject: async (id, projectData) => {
        try {
            const response = await api.put(`/projects/${id}`, projectData);
            return response.data;
        } catch (error) {
            console.error('Update project error:', error.response?.data || error.message); // Отладочный лог
            throw error;
        }
    },
    deleteProject: async (id) => {
        try {
            const response = await api.delete(`/projects/${id}`);
            return response.data;
        } catch (error) {
            console.error('Delete project error:', error.response?.data || error.message); // Отладочный лог
            throw error;
        }
    }
};

export const uploadService = {
    uploadVideo: async (file) => {
        try {
            const formData = new FormData();
            formData.append('video', file);
            const response = await api.post('/upload/video', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Upload video error:', error.response?.data || error.message); // Отладочный лог
            throw error;
        }
    }
};

export const frameService = {
    processFrame: async (frameData) => {
        try {
            console.log('frameService: Starting frame processing', {
                frameDataSize: frameData.size,
                frameDataType: frameData.type
            });

            const formData = new FormData();
            formData.append('file', frameData);

            console.log('frameService: Created FormData');

            // Сначала проверим, что бэкенд доступен
            try {
                const testResponse = await api.get('/test');
                console.log('frameService: Backend test response:', testResponse.data);
            } catch (error) {
                console.error('frameService: Backend test failed:', error);
                throw new Error('Backend is not accessible');
            }

            const response = await api.post('/process-frame', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 10000 // 10 секунд таймаут
            });

            console.log('frameService: Received response', {
                status: response.status,
                data: response.data
            });

            return response.data;
        } catch (error) {
            console.error('frameService: Error processing frame:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw error;
        }
    }
};

/**
 * API Service for Dance Flow Platform
 * Handles communication with backend services
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Process a video frame to detect poses
 * @param {Blob} frameBlob - Video frame as blob
 * @param {Object} options - Processing options
 * @param {boolean} options.overlay - Whether to return skeleton-only PNG (default: true)
 * @param {boolean} options.resize - Whether to resize large frames (default: true)
 * @param {number} options.clickX - X coordinate of click point (optional)
 * @param {number} options.clickY - Y coordinate of click point (optional)
 * @returns {Promise<Object>} - Detection results
 */
export const processVideoFrame = async (frameBlob, options = {}) => {
    const {
        overlay = true,
        resize = true,
        clickX = null,
        clickY = null
    } = options;

    // Create form data with the frame
    const formData = new FormData();
    formData.append('file', frameBlob, 'frame.jpg');

    // Build query string for parameters
    let queryParams = `?overlay=${overlay ? 1 : 0}&resize=${resize ? 1 : 0}`;

    // Add click coordinates if provided
    if (clickX !== null && clickY !== null) {
        queryParams += `&click_x=${Math.round(clickX)}&click_y=${Math.round(clickY)}`;
    }

    console.log(`Sending request to: ${API_BASE_URL}/process-frame${queryParams}`);
    console.log(`Click coordinates: ${clickX}, ${clickY}`);

    try {
        const response = await fetch(`${API_BASE_URL}/process-frame${queryParams}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error processing frame:', error);
        throw error;
    }
};

/**
 * Check the health of the video analyzer backend
 * @returns {Promise<Object>} - Health status
 */
export const checkBackendHealth = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error checking backend health:', error);
        throw error;
    }
};

/**
 * Clear the backend cache
 * @returns {Promise<Object>} - Status response
 */
export const clearBackendCache = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/clear-cache`);

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error clearing cache:', error);
        throw error;
    }
};

export default api; 