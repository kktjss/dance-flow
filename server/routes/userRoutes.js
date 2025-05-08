const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ensureAuth = require('../middleware/auth');

// Получить список пользователей (для добавления в команду)
router.get('/', ensureAuth, async (req, res) => {
    try {
        const { search, teamId } = req.query;
        console.log('Search params:', { search, teamId });
        let query = {};

        // Если есть поисковый запрос, ищем по username или email
        if (search) {
            // Сначала попробуем найти точное совпадение
            const exactUser = await User.findOne({
                $or: [
                    { username: search },
                    { email: search }
                ]
            });
            console.log('Exact match search result:', exactUser);

            // Если точное совпадение не найдено, используем регулярное выражение
            query = {
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
            console.log('Regex search query:', query);

            // Добавим поиск по частичному совпадению username
            const partialMatch = await User.findOne({ username: { $regex: `^${search}`, $options: 'i' } });
            console.log('Partial match search result:', partialMatch);
        }

        // Если указан teamId, исключаем пользователей, которые уже в команде
        if (teamId) {
            const Team = require('../models/Team');
            const team = await Team.findById(teamId);
            if (team) {
                const existingMemberIds = [
                    team.owner,
                    ...team.members.map(member => member.userId)
                ];
                query._id = { $nin: existingMemberIds };
                console.log('Team filter:', { teamId, existingMemberIds });
            }
        }

        console.log('Final query:', query);
        const users = await User.find(query, 'username email');
        console.log('Found users:', users);

        // Добавим проверку на существование пользователя test2
        const test2User = await User.findOne({ username: 'test2' });
        console.log('test2 user exists:', test2User);

        // Проверим все пользователей в базе
        const allUsers = await User.find({}, 'username email');
        console.log('All users in database:', allUsers);

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Ошибка при получении списка пользователей', error: error.message });
    }
});

// Получить информацию о текущем пользователе
router.get('/me', ensureAuth, async (req, res) => {
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

// Удалить аккаунт текущего пользователя
router.delete('/me', ensureAuth, async (req, res) => {
    try {
        console.log('Delete account request received');
        console.log('User ID from request:', req.user.id);

        // Удаляем пользователя напрямую по ID
        const result = await User.findByIdAndDelete(req.user.id);
        console.log('Delete result:', result ? 'Success' : 'Failed');

        if (!result) {
            console.log('Failed to delete user');
            return res.status(500).json({ message: 'Не удалось удалить пользователя' });
        }

        console.log('User successfully deleted');
        res.json({ message: 'Аккаунт успешно удален' });
    } catch (error) {
        console.error('Error deleting user account:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({
            message: 'Ошибка при удалении аккаунта',
            error: error.message
        });
    }
});

module.exports = router; 