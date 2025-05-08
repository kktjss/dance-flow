const Team = require('../src/models/Team');

// Middleware для проверки прав доступа к проектам в команде
const checkTeamProjectPermissions = (requiredRole) => {
    return async (req, res, next) => {
        try {
            const teamId = req.params.teamId;
            const userId = req.user.id;

            const team = await Team.findById(teamId);
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
                    message: 'Вы не являетесь участником этой команды'
                });
            }

            // Проверяем права в зависимости от требуемой роли
            const roleHierarchy = {
                'viewer': ['viewer', 'editor', 'admin'],
                'editor': ['editor', 'admin'],
                'admin': ['admin']
            };

            if (!roleHierarchy[requiredRole].includes(member.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'У вас недостаточно прав для выполнения этого действия'
                });
            }

            next();
        } catch (error) {
            console.error('Error checking team permissions:', error);
            res.status(500).json({
                success: false,
                message: 'Ошибка при проверке прав доступа',
                error: error.message
            });
        }
    };
};

module.exports = {
    checkTeamProjectPermissions
}; 