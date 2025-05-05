import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProjectsList.css';

const ProjectsList = ({ onSelectProject, setShowProjects }) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_URL = 'http://localhost:5000/api';

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${API_URL}/projects`);
                setProjects(response.data);
            } catch (err) {
                console.error('Error fetching projects:', err);
                setError('Failed to load projects');
            } finally {
                setLoading(false);
            }
        };

        fetchProjects();
    }, [API_URL]);

    const handleProjectSelect = (projectId) => {
        console.log('Selected project ID:', projectId);
        onSelectProject(projectId);
        setShowProjects(false);
    };

    return (
        <div className="projects-list-container">
            <div className="projects-list-header">
                <h2>Мои проекты</h2>
                <button className="close-button" onClick={() => setShowProjects(false)}>×</button>
            </div>

            {loading ? (
                <div className="loading">Загрузка проектов...</div>
            ) : error ? (
                <div className="error">{error}</div>
            ) : projects.length === 0 ? (
                <div className="no-projects">Нет доступных проектов</div>
            ) : (
                <div className="projects-grid">
                    {projects.map(project => (
                        <div
                            key={project._id}
                            className="project-card"
                            onClick={() => handleProjectSelect(project._id)}
                        >
                            <div className="project-title">{project.name || 'Без названия'}</div>
                            <div className="project-info">
                                {project.elements ? `${project.elements.length} элементов` : 'Элементы не загружены'}
                            </div>
                            <div className="project-date">
                                {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectsList; 