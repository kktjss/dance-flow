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
}; 