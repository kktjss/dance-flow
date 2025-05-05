const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const projectRoutes = require('./routes/projectRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const authRoutes = require('./src/routes/authRoutes');
const directKeyframesRoute = require('./direct-keyframes-route');
const path = require('path');
const testRoutes = require('./test-route');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/dance-flow', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Routes
console.log('Setting up API routes...');
app.use('/api/auth', authRoutes);
console.log('Mounted auth routes at /api/auth');

// Direct keyframes route must be defined BEFORE regular project routes
app.use('/api/projects', directKeyframesRoute);
console.log('Mounted direct-keyframes route at /api/projects/:id/direct-keyframes');

// Regular project routes
app.use('/api/projects', projectRoutes);
console.log('Mounted project routes at /api/projects');

app.use('/api/upload', uploadRoutes);
console.log('Mounted upload routes at /api/upload');

app.use('/api/test', testRoutes);
console.log("Test routes mounted at /api/test");

// Static files (for uploaded content)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve client/public/models folder (for development)
app.use('/models', express.static(path.join(__dirname, '..', 'client', 'public', 'models')));

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 