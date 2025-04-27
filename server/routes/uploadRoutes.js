const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage for uploaded models
const modelStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create uploads directory in client/public for development environment
        // This ensures 3D models are available via the client dev server
        const clientPublicDir = path.join(__dirname, '..', '..', 'client', 'public', 'models');

        // Create directory if it doesn't exist
        if (!fs.existsSync(clientPublicDir)) {
            fs.mkdirSync(clientPublicDir, { recursive: true });
        }

        cb(null, clientPublicDir);
    },
    filename: function (req, file, cb) {
        // Use original filename to preserve file structure
        // Add a timestamp to prevent overwriting
        const timestamp = Date.now();
        const originalName = file.originalname;
        cb(null, `${timestamp}-${originalName}`);
    }
});

// File filter to only accept .glb and .gltf files
const modelFilter = (req, file, cb) => {
    const validExtensions = ['.glb', '.gltf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (validExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Только файлы .glb и .gltf поддерживаются!'), false);
    }
};

// Configure upload middleware with size limits
// Note: We're setting a high limit (100MB) to support large 3D models
const upload = multer({
    storage: modelStorage,
    fileFilter: modelFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Add utility function to verify GLB file structure
const verifyGlbFile = (filePath) => {
    try {
        // For GLB files, we use a more permissive approach since binary validation is complex
        if (path.extname(filePath).toLowerCase() === '.glb') {
            // We'll just check the file exists and has content
            const stats = fs.statSync(filePath);
            return stats.size > 0;
        }

        // For GLTF (JSON) files
        if (path.extname(filePath).toLowerCase() === '.gltf') {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const json = JSON.parse(content);

                // Basic validation
                if (!json.asset || !json.asset.version) {
                    console.warn('Invalid GLTF file: Missing asset version');
                    return false;
                }

                return true;
            } catch (parseError) {
                console.error('Error parsing GLTF JSON:', parseError);
                return false;
            }
        }

        return false;
    } catch (error) {
        console.error('Error verifying 3D model file:', error);
        return false;
    }
};

// Upload 3D model route - include verification
router.post('/model', upload.single('model'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Нет загруженного файла' });
        }

        const filePath = req.file.path;

        // Verify the file is a valid GLB/GLTF
        const isValid = verifyGlbFile(filePath);

        if (!isValid) {
            // Clean up the invalid file
            fs.unlinkSync(filePath);

            return res.status(400).json({
                success: false,
                message: 'Некорректный формат 3D модели. Убедитесь, что файл имеет правильный формат GLB/GLTF.'
            });
        }

        // Generate URL path for the uploaded file
        const modelUrl = `/models/${req.file.filename}`;

        // Return success response with model URL
        return res.status(200).json({
            success: true,
            modelPath: modelUrl,
            fileName: req.file.filename,
            size: req.file.size,
            isVerified: true
        });
    } catch (error) {
        console.error('Error uploading model:', error);

        // Try to clean up any partially uploaded file
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('Error removing invalid file:', unlinkError);
            }
        }

        return res.status(500).json({
            success: false,
            message: 'Ошибка при загрузке модели',
            error: error.message
        });
    }
});

// Get list of available models route
router.get('/models', (req, res) => {
    const modelsDir = path.join(__dirname, '..', '..', 'client', 'public', 'models');

    try {
        if (!fs.existsSync(modelsDir)) {
            return res.status(200).json({ models: [] });
        }

        const files = fs.readdirSync(modelsDir)
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.glb', '.gltf'].includes(ext);
            })
            .map(file => ({
                fileName: file,
                modelPath: `/models/${file}`,
                size: fs.statSync(path.join(modelsDir, file)).size,
                createdAt: fs.statSync(path.join(modelsDir, file)).birthtime
            }));

        return res.status(200).json({ models: files });
    } catch (error) {
        console.error('Error listing models:', error);
        return res.status(500).json({
            success: false,
            message: 'Ошибка при получении списка моделей',
            error: error.message
        });
    }
});

// Download a 3D model file directly
router.get('/model/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '..', '..', 'client', 'public', 'models', filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Файл не найден'
            });
        }

        // Set appropriate headers for binary file
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading model:', error);
        return res.status(500).json({
            success: false,
            message: 'Ошибка при скачивании модели',
            error: error.message
        });
    }
});

module.exports = router; 