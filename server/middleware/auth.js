const jwt = require('jsonwebtoken');

const ensureAuth = (req, res, next) => {
    try {
        console.log('Auth middleware triggered for:', req.method, req.originalUrl);
        console.log('Request headers:', req.headers);

        // Get token from header
        const authHeader = req.header('Authorization');
        console.log('Authorization header:', authHeader ? 'Present' : 'Missing');

        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ message: 'No authentication token, access denied' });
        }

        console.log('Token received:', token.substring(0, 10) + '...');

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        console.log('Token decoded:', decoded);

        if (!decoded.userId) {
            console.log('Token does not contain userId');
            return res.status(401).json({ message: 'Invalid token format' });
        }

        // Add user info to request
        req.user = {
            id: decoded.userId,
            username: decoded.username
        };

        console.log('Authenticated user:', {
            id: req.user.id,
            username: req.user.username
        });

        next();
    } catch (error) {
        console.error('Authentication error:', error.message);
        console.error('Full error:', error);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = ensureAuth; 