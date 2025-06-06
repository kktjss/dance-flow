import { Alert, Snackbar } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { COLORS } from '../constants/colors';

// Анимации для уведомлений
export const slideInFromLeft = keyframes`
  0% { transform: translateX(-100%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
`;

export const slideInFromRight = keyframes`
  0% { transform: translateX(100%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
`;

export const slideInFromTop = keyframes`
  0% { transform: translateY(-100%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
`;

// Базовый стилизованный Alert
const BaseStyledAlert = styled(Alert)(({ theme, severity, animation = slideInFromLeft }) => {
    let backgroundGradient = `linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.05))`;
    let borderColor = 'rgba(76, 175, 80, 0.3)';
    let iconColor = '#4caf50';
    let topGradient = 'linear-gradient(90deg, #4caf50, #66bb6a)';

    if (severity === 'error') {
        backgroundGradient = `linear-gradient(135deg, rgba(244, 67, 54, 0.15), rgba(244, 67, 54, 0.05))`;
        borderColor = 'rgba(244, 67, 54, 0.3)';
        iconColor = '#f44336';
        topGradient = 'linear-gradient(90deg, #f44336, #ff5722)';
    } else if (severity === 'warning') {
        backgroundGradient = `linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(255, 152, 0, 0.05))`;
        borderColor = 'rgba(255, 152, 0, 0.3)';
        iconColor = '#ff9800';
        topGradient = 'linear-gradient(90deg, #ff9800, #ffb74d)';
    } else if (severity === 'info') {
        backgroundGradient = `linear-gradient(135deg, ${COLORS.secondary}15, ${COLORS.secondary}05)`;
        borderColor = `${COLORS.secondary}30`;
        iconColor = COLORS.secondary;
        topGradient = `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.tertiary})`;
    }

    return {
        borderRadius: '12px',
        backgroundColor: 'rgba(17, 21, 54, 0.95)',
        color: '#FFFFFF',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4)',
        animation: `${animation} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)`,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '3px',
            background: topGradient,
            borderRadius: '12px 12px 0 0',
        },
        '& .MuiAlert-icon': {
            color: iconColor,
            fontSize: '22px'
        },
        '& .MuiAlert-message': {
            color: 'rgba(255, 255, 255, 0.9)',
            fontWeight: 500
        },
        '& .MuiAlert-action': {
            '& .MuiIconButton-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    transform: 'scale(1.1)'
                }
            }
        }
    };
});

// Стилизованный Alert для списков проектов (анимация слева)
export const StyledProjectAlert = styled(BaseStyledAlert)`
    animation: ${slideInFromLeft} 0.3s ease-out;
`;

// Стилизованный Alert для конструктора (анимация справа)
export const StyledConstructorAlert = styled(BaseStyledAlert)`
    animation: ${slideInFromRight} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    &::before {
        height: 4px;
        background: linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary});
        border-radius: 15px 15px 0 0;
    }
    & .MuiAlert-icon {
        font-size: 24px;
        margin-top: 2px;
    }
    & .MuiAlert-message {
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.95);
    }
`;

// Стилизованный Alert для статических страниц
export const StyledPageAlert = styled(BaseStyledAlert)`
    animation: ${slideInFromTop} 0.3s ease-out;
`;

// Стилизованный Snackbar для уведомлений в списках
export const StyledProjectSnackbar = styled(Snackbar)`
    & .MuiSnackbar-root {
        transform: none !important;
    }
`;

// Стилизованный Snackbar для уведомлений в конструкторе
export const StyledConstructorSnackbar = styled(Snackbar)`
    z-index: 10000;
    & .MuiSnackbar-root {
        transform: none !important;
    }
`;

// Функция для определения типа уведомления на основе сообщения
export const getNotificationSeverity = (message) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('ошибка') || lowerMessage.includes('error') || lowerMessage.includes('не удалось')) {
        return 'error';
    } else if (lowerMessage.includes('загрузка') || lowerMessage.includes('loading') || lowerMessage.includes('загружается')) {
        return 'info';
    } else if (lowerMessage.includes('внимание') || lowerMessage.includes('warning') || lowerMessage.includes('предупреждение')) {
        return 'warning';
    }
    return 'success';
};

export default {
    StyledProjectAlert,
    StyledConstructorAlert,
    StyledPageAlert,
    StyledProjectSnackbar,
    StyledConstructorSnackbar,
    getNotificationSeverity
}; 