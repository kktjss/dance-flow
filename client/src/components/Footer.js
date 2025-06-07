import React from 'react';
import { Box, Container } from '@mui/material';
import { styled } from '@mui/material/styles';
import { COLORS } from '../constants/colors';

// Логотип как в Navbar
const LogoDanceFlow = ({ variant = "h6", component = "span", color = "primary", ...props }) => (
    <Box
        sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
        }}
    >
        <Box
            component={component}
            sx={{
                fontWeight: 800,
                fontFamily: '"Inter", "Golos Text", sans-serif',
                letterSpacing: '-0.02em',
                fontSize: variant === 'h6' ? '2rem' : undefined,
                color: COLORS.white,
                position: 'relative',
                display: 'inline-block',
            }}
        >
            Dance
            <Box component="span" sx={{
                background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: `0 0 10px rgba(${parseInt(COLORS.tertiary.slice(1, 3), 16)}, ${parseInt(COLORS.tertiary.slice(3, 5), 16)}, ${parseInt(COLORS.tertiary.slice(5, 7), 16)}, 0.4)`,
                position: 'relative',
                ml: 0.5,
                display: 'inline-block',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '2px',
                    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.tertiary})`,
                    opacity: 0.5,
                    borderRadius: '2px',
                    transform: 'translateY(3px)',
                }
            }}>Flow</Box>
        </Box>
    </Box>
);

const StyledFooter = styled(Box)(({ theme }) => ({
    backgroundColor: `rgba(26, 32, 46, 0.95)`,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.2)',
    borderTop: `1px solid rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0.2)`,
    position: 'relative',
    marginTop: 'auto',
    padding: theme.spacing(3, 0),
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '1px',
        background: `linear-gradient(90deg, rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0) 0%, rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 1) 50%, rgba(${parseInt(COLORS.secondary.slice(1, 3), 16)}, ${parseInt(COLORS.secondary.slice(3, 5), 16)}, ${parseInt(COLORS.secondary.slice(5, 7), 16)}, 0) 100%)`,
    },
}));

function Footer() {
    return (
        <StyledFooter>
            <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 64 }}>
                <LogoDanceFlow variant="h6" component="div" color="primary" />
            </Container>
        </StyledFooter>
    );
}

export default Footer; 