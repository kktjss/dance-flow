const Team = require('../src/models/Team');
const Project = require('../models/Project');

// Middleware для проверки прав доступа к проекту
const checkProjectAccess = (accessType) => {
    return async (req, res, next) => {
        try {
            const projectId = req.params.projectId;
            const userId = req.user.id;

            // Находим проект
            const project = await Project.findById(projectId);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Проект не найден'
                });
            }

            // Находим команду, которой принадлежит проект
            const team = await Team.findOne({ projects: projectId });
            if (!team) {
                return res.status(404).json({
                    success: false,
                    message: 'Команда не найдена'
                });
            }

            // Владелец команды имеет все права
            if (team.owner.toString() === userId) {
                return next();
            }

            // Проверяем роль участника
            const member = team.members.find(m => m.userId.toString() === userId);
            if (!member) {
                return res.status(403).json({
                    success: false,
                    message: 'Вы не являетесь участником команды'
                });
            }

            // Проверяем права в зависимости от типа доступа
            if (accessType === 'viewer') {
                // Для просмотра достаточно роли viewer
                if (['viewer', 'editor', 'admin'].includes(member.role)) {
                    return next();
                }
            } else if (accessType === 'constructor') {
                // Для конструктора нужна роль admin
                if (member.role === 'admin') {
                    return next();
                }
            }

            return res.status(403).json({
                success: false,
                message: 'У вас недостаточно прав для доступа к проекту'
            });
        } catch (error) {
            console.error('Error checking project permissions:', error);
            res.status(500).json({
                success: false,
                message: 'Ошибка при проверке прав доступа',
                error: error.message
            });
        }
    };
};

module.exports = {
    checkProjectAccess
}; 