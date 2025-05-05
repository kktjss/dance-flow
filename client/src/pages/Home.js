import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Button,
    Grid,
    Card,
    CardContent,
    CardActions,
    Box,
    Paper,
    Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const StyledCard = styled(Card)(({ theme }) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s',
    '&:hover': {
        transform: 'scale(1.02)',
    },
}));

const HeroSection = styled(Paper)(({ theme }) => ({
    position: 'relative',
    backgroundColor: theme.palette.grey[800],
    color: theme.palette.common.white,
    marginBottom: theme.spacing(4),
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundImage: 'url(https://source.unsplash.com/random?dance)',
    height: '80vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
}));

const HeroContent = styled(Box)(({ theme }) => ({
    position: 'relative',
    padding: theme.spacing(3),
    textAlign: 'center',
}));

const FeatureSection = styled(Box)(({ theme }) => ({
    padding: theme.spacing(8, 0),
    backgroundColor: theme.palette.grey[50],
}));

const TestimonialSection = styled(Box)(({ theme }) => ({
    padding: theme.spacing(8, 0),
    backgroundColor: theme.palette.common.white,
}));

function Home() {
    const navigate = useNavigate();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1 }}>
                <HeroSection>
                    <HeroContent>
                        <Typography variant="h1" component="h1" gutterBottom sx={{ fontSize: { xs: '2.5rem', md: '4rem' } }}>
                            DanceFlow
                        </Typography>
                        <Typography variant="h4" paragraph sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
                            Создавайте, делитесь и совершенствуйте свои танцевальные постановки
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={() => navigate('/constructor')}
                            sx={{ mt: 2, fontSize: '1.2rem', py: 1.5, px: 4 }}
                        >
                            Начать создавать
                        </Button>
                    </HeroContent>
                </HeroSection>

                <FeatureSection>
                    <Container maxWidth="lg">
                        <Box sx={{ textAlign: 'center', mb: 6 }}>
                            <Typography variant="h3" component="h2" gutterBottom>
                                Возможности платформы
                            </Typography>
                            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '800px', mx: 'auto' }}>
                                Все инструменты, необходимые для создания и управления хореографией в одном месте
                            </Typography>
                        </Box>

                        <Grid container spacing={4}>
                            <Grid item xs={12} md={4}>
                                <StyledCard>
                                    <CardContent>
                                        <Typography variant="h5" component="h3" gutterBottom>
                                            Конструктор хореографии
                                        </Typography>
                                        <Typography variant="body1" color="text.secondary">
                                            Создавайте и визуализируйте танцевальные постановки с помощью наших продвинутых инструментов 3D-анимации.
                                            Загружайте видео и преобразуйте их в анимированные последовательности.
                                        </Typography>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            size="large"
                                            color="primary"
                                            onClick={() => navigate('/constructor')}
                                        >
                                            Подробнее
                                        </Button>
                                    </CardActions>
                                </StyledCard>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <StyledCard>
                                    <CardContent>
                                        <Typography variant="h5" component="h3" gutterBottom>
                                            Управление командами
                                        </Typography>
                                        <Typography variant="body1" color="text.secondary">
                                            Создавайте команды, делитесь хореографией и сотрудничайте с танцорами.
                                            Управляйте правами доступа и отслеживайте прогресс.
                                        </Typography>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            size="large"
                                            color="primary"
                                            onClick={() => navigate('/teams')}
                                        >
                                            Подробнее
                                        </Button>
                                    </CardActions>
                                </StyledCard>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <StyledCard>
                                    <CardContent>
                                        <Typography variant="h5" component="h3" gutterBottom>
                                            3D Визуализация
                                        </Typography>
                                        <Typography variant="body1" color="text.secondary">
                                            Преобразуйте ваши танцевальные движения в 3D-анимации.
                                            Применяйте движения к разным моделям и смотрите, как они будут выглядеть.
                                        </Typography>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            size="large"
                                            color="primary"
                                            onClick={() => navigate('/constructor')}
                                        >
                                            Подробнее
                                        </Button>
                                    </CardActions>
                                </StyledCard>
                            </Grid>
                        </Grid>
                    </Container>
                </FeatureSection>

                <TestimonialSection>
                    <Container maxWidth="lg">
                        <Box sx={{ textAlign: 'center', mb: 6 }}>
                            <Typography variant="h3" component="h2" gutterBottom>
                                Отзывы пользователей
                            </Typography>
                        </Box>
                        <Grid container spacing={4}>
                            <Grid item xs={12} md={4}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="body1" paragraph>
                                            "DanceFlow полностью изменил мой подход к созданию хореографии. Теперь я могу легко визуализировать движения и делиться ими с командой."
                                        </Typography>
                                        <Typography variant="subtitle1" color="primary">
                                            Анна Петрова
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Хореограф
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="body1" paragraph>
                                            "Отличная платформа для совместной работы. Теперь мы можем легко отслеживать прогресс и вносить изменения в постановку."
                                        </Typography>
                                        <Typography variant="subtitle1" color="primary">
                                            Михаил Иванов
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Танцор
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="body1" paragraph>
                                            "3D-визуализация помогает лучше понять движения и их последовательность. Это незаменимый инструмент для современного хореографа."
                                        </Typography>
                                        <Typography variant="subtitle1" color="primary">
                                            Елена Смирнова
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Хореограф
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Container>
                </TestimonialSection>

                <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 8 }}>
                    <Container maxWidth="lg">
                        <Grid container spacing={4} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <Typography variant="h4" gutterBottom>
                                    Готовы начать?
                                </Typography>
                                <Typography variant="h6" paragraph>
                                    Присоединяйтесь к сообществу хореографов и танцоров уже сегодня
                                </Typography>
                                <Button
                                    variant="contained"
                                    size="large"
                                    sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
                                    onClick={() => navigate('/constructor')}
                                >
                                    Начать бесплатно
                                </Button>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="body1">
                                    • Создавайте хореографию с помощью 3D-анимации<br />
                                    • Управляйте командами и доступом<br />
                                    • Делитесь постановками с другими<br />
                                    • Отслеживайте прогресс и вносите изменения
                                </Typography>
                            </Grid>
                        </Grid>
                    </Container>
                </Box>
            </Box>
            <Footer />
        </Box>
    );
}

export default Home; 