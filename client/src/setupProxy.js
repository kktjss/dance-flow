const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    // Proxy API requests
    app.use(
        '/api',
        createProxyMiddleware({
            target: 'http://localhost:5000',
            changeOrigin: true,
        })
    );

    // Proxy for model files
    app.use(
        '/uploads',
        createProxyMiddleware({
            target: 'http://localhost:5000',
            changeOrigin: true,
        })
    );

    // Proxy for model files in /models directory
    app.use(
        '/models',
        createProxyMiddleware({
            target: 'http://localhost:5000',
            changeOrigin: true,
        })
    );

    // Proxy for files in /files directly to /uploads/files
    app.use(
        '/files',
        createProxyMiddleware({
            target: 'http://localhost:5000',
            changeOrigin: true,
            pathRewrite: {
                '^/files': '/uploads/files'
            }
        })
    );

    // Proxy for audio files in /audio directly to /uploads/audio
    app.use(
        '/audio',
        createProxyMiddleware({
            target: 'http://localhost:5000',
            changeOrigin: true,
            pathRewrite: {
                '^/audio': '/uploads/audio'
            }
        })
    );
}; 