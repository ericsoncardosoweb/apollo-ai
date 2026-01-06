import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
    TextInput,
    Button,
    Paper,
    Title,
    Text,
    Container,
    Stack,
    Center,
    ThemeIcon,
    Alert,
    Anchor,
    Box,
} from '@mantine/core'
import { IconAlertCircle, IconMail, IconCheck } from '@tabler/icons-react'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const { resetPassword } = useAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await resetPassword(email)
            setSuccess(true)
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao enviar email'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <Box
                style={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, var(--mantine-color-dark-8) 0%, var(--mantine-color-dark-9) 100%)',
                }}
            >
                <Container size={420} py={80}>
                    <Center>
                        <Stack align="center" gap="md">
                            <ThemeIcon size={80} radius="xl" color="green">
                                <IconCheck size={40} />
                            </ThemeIcon>
                            <Title order={2} ta="center">Email Enviado!</Title>
                            <Text c="dimmed" ta="center" maw={300}>
                                Se existe uma conta com o email <strong>{email}</strong>,
                                você receberá instruções para redefinir sua senha.
                            </Text>
                            <Button
                                variant="light"
                                component={Link}
                                to="/login"
                                mt="md"
                            >
                                Voltar para Login
                            </Button>
                        </Stack>
                    </Center>
                </Container>
            </Box>
        )
    }

    return (
        <Box
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, var(--mantine-color-dark-8) 0%, var(--mantine-color-dark-9) 100%)',
            }}
        >
            <Container size={420} py={80}>
                <Center mb={30}>
                    <Stack align="center" gap="xs">
                        <ThemeIcon
                            size={60}
                            radius="xl"
                            variant="light"
                            color="indigo"
                        >
                            <IconMail size={30} stroke={1.5} />
                        </ThemeIcon>
                        <Title order={2} ta="center" mt="md">
                            Esqueceu a senha?
                        </Title>
                        <Text c="dimmed" size="sm" ta="center" maw={300}>
                            Digite seu email e enviaremos instruções para redefinir sua senha
                        </Text>
                    </Stack>
                </Center>

                <Paper withBorder shadow="xl" p={30} radius="md">
                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            {error && (
                                <Alert
                                    icon={<IconAlertCircle size={16} />}
                                    color="red"
                                    variant="light"
                                    radius="md"
                                >
                                    {error}
                                </Alert>
                            )}

                            <TextInput
                                label="E-mail"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <Button
                                type="submit"
                                fullWidth
                                loading={loading}
                                variant="gradient"
                                gradient={{ from: 'indigo', to: 'violet' }}
                            >
                                Enviar Instruções
                            </Button>
                        </Stack>
                    </form>
                </Paper>

                <Text ta="center" mt="md" size="sm" c="dimmed">
                    Lembrou a senha?{' '}
                    <Anchor component={Link} to="/login" size="sm">
                        Voltar para login
                    </Anchor>
                </Text>
            </Container>
        </Box>
    )
}
