const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Получить список пользователей (для добавления в команду)
router.get('/', auth, async (req, res) => {
    try {
        const users = await User.find({}, 'username email');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Ошибка при получении списка пользователей', error: error.message });
    }
});

// Получить информацию о текущем пользователе
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ message: 'Ошибка при получении данных пользователя', error: error.message });
    }
});

module.exports = router; 