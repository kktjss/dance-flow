const mongoose = require('mongoose');

// Schema for elements (БЕЗ KEYFRAMES)
const ElementSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: { type: String, required: true }, // rectangle, circle, image, text, etc.
    position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true }
    },
    size: {
        width: { type: Number, required: true },
        height: { type: Number, required: true }
    },
    style: {
        color: { type: String, default: '#000000' },
        backgroundColor: { type: String, default: 'transparent' },
        borderColor: { type: String, default: '#000000' },
        borderWidth: { type: Number, default: 1 },
        opacity: { type: Number, default: 1 },
        zIndex: { type: Number, default: 0 }
    },
    content: { type: String, default: '' } // For text or image URL
}, {
    versionKey: false,
    strict: false,
    minimize: false,
    _id: false // Отключаем генерацию ID для подсхем
});

const ProjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    duration: { type: Number, default: 60 }, // Duration in seconds
    audioUrl: { type: String, default: null },
    elements: [ElementSchema],
    // Храним keyframes как простую JSON-строку
    // ВАЖНО: это будет просто текст в базе данных!
    keyframesJson: {
        type: String,
        default: '{}',
        get: function (val) {
            // При получении значения проверяем, что это валидный JSON
            try {
                // Если пустая строка, возвращаем пустой объект
                if (!val || val.trim() === '') {
                    return '{}';
                }
                // Проверяем, что это валидный JSON
                JSON.parse(val);
                return val;
            } catch (e) {
                console.error('Invalid keyframesJson in database:', e);
                return '{}';
            }
        },
        set: function (val) {
            // При установке значения проверяем, что это валидный JSON или строка JSON
            try {
                if (!val) {
                    return '{}';
                }

                // Если это объект, преобразуем его в строку
                if (typeof val === 'object') {
                    return JSON.stringify(val);
                }

                // Если это строка, проверяем, что это валидный JSON
                if (typeof val === 'string') {
                    // Если пустая строка, возвращаем пустой объект
                    if (val.trim() === '') {
                        return '{}';
                    }
                    // Проверяем, что это валидный JSON
                    JSON.parse(val);
                    return val;
                }

                return '{}';
            } catch (e) {
                console.error('Error setting keyframesJson:', e);
                return '{}';
            }
        }
    }
}, {
    versionKey: false
});

// Обновление времени и базовое логирование при сохранении
ProjectSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    console.log(`Saving project "${this.name}" with ${this.elements?.length || 0} elements`);

    // Валидация keyframesJson (убедимся, что это валидный JSON)
    try {
        if (this.keyframesJson && this.keyframesJson !== '{}') {
            const parsed = JSON.parse(this.keyframesJson);
            const elementCount = Object.keys(parsed).length;
            const keyframeCount = Object.values(parsed).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
            console.log(`keyframesJson parsed OK, contains ${elementCount} element entries with ${keyframeCount} total keyframes`);

            // Проверяем соответствие ID элементов 
            const elementIds = Object.keys(parsed);
            const projectElementIds = this.elements.map(el => el.id);

            // Проверяем, все ли ID в keyframesJson соответствуют ID элементов в проекте
            const invalidIds = elementIds.filter(id => !projectElementIds.includes(id));
            if (invalidIds.length > 0) {
                console.warn(`WARNING: keyframesJson contains ${invalidIds.length} element IDs that don't exist in project elements`);
            }

            // Если ID не совпадают, логируем для отладки
            if (elementIds.length !== projectElementIds.length) {
                console.warn(`Element ID mismatch: keyframesJson has ${elementIds.length} elements, project has ${projectElementIds.length} elements`);
            }
        } else {
            this.keyframesJson = '{}';
        }
    } catch (err) {
        console.error('Invalid keyframesJson, resetting to empty object', err);
        this.keyframesJson = '{}';
    }

    next();
});

const Project = mongoose.model('Project', ProjectSchema);

module.exports = Project; 