const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const User = require('../models/User');
const Project = require('../models/Project');
const auth = require('../middleware/auth');

// Добавим маршрут для проверки доступности API
router.get('/test', (req, res) => {
    console.log('Test route in teamRoutes was called');
    res.json({ message: 'Team API is working' });
});

// Create a new team
router.post('/', auth, async (req, res) => {
    try {
        const { name, description } = req.body;

        const newTeam = new Team({
            name,
            description,
            owner: req.user.id,
            members: [{
                userId: req.user.id,
                role: 'admin',
                joinedAt: Date.now()
            }]
        });

        await newTeam.save();

        // Update the user's teams array
        await User.findByIdAndUpdate(
            req.user.id,
            { $push: { teams: newTeam._id } }
        );

        res.status(201).json(newTeam);
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ message: 'Ошибка при создании команды', error: error.message });
    }
});

// Get all teams for current user
router.get('/', auth, async (req, res) => {
    try {
        // Find teams where the user is either the owner or a member
        const teams = await Team.find({
            $or: [
                { owner: req.user.id },
                { 'members.userId': req.user.id }
            ]
        }).populate('owner', 'username email');

        res.json(teams);
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ message: 'Ошибка при получении команд', error: error.message });
    }
});

// Get a specific team by ID
router.get('/:teamId', auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId)
            .populate('owner', 'username email')
            .populate('members.userId', 'username email')
            .populate('projects', 'name description');

        if (!team) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }

        // Check if user is owner or member
        const isOwner = team.owner._id.toString() === req.user.id;
        const isMember = team.members.some(member =>
            member.userId._id.toString() === req.user.id
        );

        if (!isOwner && !isMember) {
            return res.status(403).json({ message: 'Нет доступа к этой команде' });
        }

        res.json(team);
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ message: 'Ошибка при получении информации о команде', error: error.message });
    }
});

// Update team information
router.put('/:teamId', auth, async (req, res) => {
    try {
        const { name, description } = req.body;
        const team = await Team.findById(req.params.teamId);

        if (!team) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }

        // Check if user is owner or admin
        if (team.owner.toString() !== req.user.id &&
            !team.members.some(member =>
                member.userId.toString() === req.user.id && member.role === 'admin'
            )) {
            return res.status(403).json({ message: 'Нет прав для обновления команды' });
        }

        team.name = name || team.name;
        team.description = description || team.description;
        await team.save();

        res.json(team);
    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({ message: 'Ошибка при обновлении команды', error: error.message });
    }
});

// Add member to team
router.post('/:teamId/members', auth, async (req, res) => {
    try {
        const { userId, role } = req.body;
        const team = await Team.findById(req.params.teamId);

        if (!team) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }

        // Check if user is owner or admin
        if (team.owner.toString() !== req.user.id &&
            !team.members.some(member =>
                member.userId.toString() === req.user.id && member.role === 'admin'
            )) {
            return res.status(403).json({ message: 'Нет прав для добавления участников' });
        }

        // Check if user exists
        const userToAdd = await User.findById(userId);
        if (!userToAdd) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Check if user is already in team
        if (team.members.some(member => member.userId.toString() === userId)) {
            return res.status(400).json({ message: 'Пользователь уже в команде' });
        }

        // Add user to team
        team.members.push({
            userId,
            role: role || 'viewer',
            joinedAt: Date.now()
        });

        await team.save();

        // Add team to user's teams array
        await User.findByIdAndUpdate(
            userId,
            { $push: { teams: team._id } }
        );

        res.json(team);
    } catch (error) {
        console.error('Error adding team member:', error);
        res.status(500).json({ message: 'Ошибка при добавлении участника', error: error.message });
    }
});

// Remove member from team
router.delete('/:teamId/members/:userId', auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);

        if (!team) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }

        // Check if user is owner or admin (or user is removing themselves)
        if (team.owner.toString() !== req.user.id &&
            req.params.userId !== req.user.id &&
            !team.members.some(member =>
                member.userId.toString() === req.user.id && member.role === 'admin'
            )) {
            return res.status(403).json({ message: 'Нет прав для удаления участников' });
        }

        // Owner cannot be removed
        if (team.owner.toString() === req.params.userId) {
            return res.status(400).json({ message: 'Владелец команды не может быть удален' });
        }

        // Remove user from team
        team.members = team.members.filter(
            member => member.userId.toString() !== req.params.userId
        );

        await team.save();

        // Remove team from user's teams array
        await User.findByIdAndUpdate(
            req.params.userId,
            { $pull: { teams: team._id } }
        );

        res.json({ message: 'Участник удален из команды' });
    } catch (error) {
        console.error('Error removing team member:', error);
        res.status(500).json({ message: 'Ошибка при удалении участника', error: error.message });
    }
});

// Update member's role
router.put('/:teamId/members/:userId', auth, async (req, res) => {
    try {
        const { role } = req.body;
        const team = await Team.findById(req.params.teamId);

        if (!team) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }

        // Check if user is owner or admin
        if (team.owner.toString() !== req.user.id &&
            !team.members.some(member =>
                member.userId.toString() === req.user.id && member.role === 'admin'
            )) {
            return res.status(403).json({ message: 'Нет прав для изменения роли участников' });
        }

        // Find member
        const memberIndex = team.members.findIndex(
            member => member.userId.toString() === req.params.userId
        );

        if (memberIndex === -1) {
            return res.status(404).json({ message: 'Участник не найден' });
        }

        // Update role
        team.members[memberIndex].role = role;
        await team.save();

        res.json(team);
    } catch (error) {
        console.error('Error updating member role:', error);
        res.status(500).json({ message: 'Ошибка при обновлении роли участника', error: error.message });
    }
});

// Add project to team
router.post('/:teamId/projects', auth, async (req, res) => {
    try {
        const { projectId } = req.body;
        const team = await Team.findById(req.params.teamId);

        if (!team) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }

        // Check if user is owner or admin
        if (team.owner.toString() !== req.user.id &&
            !team.members.some(member =>
                member.userId.toString() === req.user.id && member.role === 'admin'
            )) {
            return res.status(403).json({ message: 'Нет прав для добавления проектов' });
        }

        // Check if project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Проект не найден' });
        }

        // Check if project is already in team
        if (team.projects.includes(projectId)) {
            return res.status(400).json({ message: 'Проект уже добавлен в команду' });
        }

        // Add project to team
        team.projects.push(projectId);
        await team.save();

        res.json(team);
    } catch (error) {
        console.error('Error adding project to team:', error);
        res.status(500).json({ message: 'Ошибка при добавлении проекта', error: error.message });
    }
});

// Remove project from team
router.delete('/:teamId/projects/:projectId', auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);

        if (!team) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }

        // Check if user is owner or admin
        if (team.owner.toString() !== req.user.id &&
            !team.members.some(member =>
                member.userId.toString() === req.user.id && member.role === 'admin'
            )) {
            return res.status(403).json({ message: 'Нет прав для удаления проектов' });
        }

        // Remove project from team
        team.projects = team.projects.filter(
            project => project.toString() !== req.params.projectId
        );

        await team.save();

        res.json({ message: 'Проект удален из команды' });
    } catch (error) {
        console.error('Error removing project from team:', error);
        res.status(500).json({ message: 'Ошибка при удалении проекта', error: error.message });
    }
});

// Delete a team
router.delete('/:teamId', auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);

        if (!team) {
            return res.status(404).json({ message: 'Команда не найдена' });
        }

        // Only owner can delete a team
        if (team.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Только владелец может удалить команду' });
        }

        // Remove team from all users' teams arrays
        const memberIds = team.members.map(member => member.userId);
        memberIds.push(team.owner);

        await User.updateMany(
            { _id: { $in: memberIds } },
            { $pull: { teams: team._id } }
        );

        // Delete the team
        await Team.findByIdAndDelete(req.params.teamId);

        res.json({ message: 'Команда успешно удалена' });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ message: 'Ошибка при удалении команды', error: error.message });
    }
});

module.exports = router; 