const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');

// Настройка хранилища для загружаемых файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../go/uploads/models');

        // Создать директорию, если она не существует
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Генерация уникального имени файла
        const uniqueId = uuidv4();
        const fileExt = path.extname(file.originalname);
        cb(null, `${uniqueId}${fileExt}`);
    }
});

// Создание экземпляра multer с ограничениями размера файла
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // ограничение 50МБ
    },
    fileFilter: (req, file, cb) => {
        // Принимать только .glb файлы
        if (file.mimetype === 'model/gltf-binary' || path.extname(file.originalname).toLowerCase() === '.glb') {
            return cb(null, true);
        }
        cb(new Error('Only .glb files are allowed'));
    }
});

// База данных моделей (в памяти для простоты, заменить на реальную БД в продакшене)
let models = [];

// Получить все модели
router.get('/', auth, (req, res) => {
    try {
        // В реальном приложении здесь был бы запрос к базе данных
        res.json(models.map(model => ({
            ...model,
            url: `/models/${model.filename}` // Добавить URL для использования на клиентской стороне
        })));
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Загрузить новую модель
router.post('/upload', auth, upload.single('model'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const modelName = req.body.name || path.parse(req.file.originalname).name;

        // Создать запись о модели
        const newModel = {
            id: uuidv4(),
            name: modelName,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            userId: req.user.id,
            createdAt: new Date().toISOString(),
            url: `/models/${req.file.filename}`
        };

        // Сохранить в базу данных (пока в памяти)
        models.push(newModel);

        res.status(201).json(newModel);
    } catch (error) {
        console.error('Error uploading model:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Получить конкретную модель
router.get('/:id', auth, (req, res) => {
    try {
        const model = models.find(m => m.id === req.params.id);

        if (!model) {
            return res.status(404).json({ message: 'Model not found' });
        }

        res.json({
            ...model,
            url: `/models/${model.filename}`
        });
    } catch (error) {
        console.error('Error fetching model:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Удалить модель
router.delete('/:id', auth, (req, res) => {
    try {
        const modelIndex = models.findIndex(m => m.id === req.params.id);

        if (modelIndex === -1) {
            return res.status(404).json({ message: 'Model not found' });
        }

        const model = models[modelIndex];

        // Проверить, является ли пользователь владельцем этой модели
        if (model.userId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this model' });
        }

        // Удалить файл с диска
        const filePath = path.join(__dirname, '../go/uploads/models', model.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Удалить из базы данных
        models.splice(modelIndex, 1);

        res.json({ message: 'Model deleted successfully' });
    } catch (error) {
        console.error('Error deleting model:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 