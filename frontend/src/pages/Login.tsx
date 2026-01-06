import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
    TextInput,
    PasswordInput,
    Button,
    Paper,
    Title,
    Text,
    Container,
    Stack,
    Center,
    ThemeIcon,
    Alert,
    Group,
    Anchor,
    Box,
    Divider,
} from '@mantine/core'
import { IconAlertCircle, IconRocket } from '@tabler/icons-react'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { signIn } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await signIn(email, password)
            // Redirect based on role will happen in App.tsx route guards
            // For now, redirect to role-appropriate dashboard
            navigate('/app')
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Credenciais inválidas'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
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
                            size={80}
                            radius="xl"
                            variant="gradient"
                            gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
                        >
                            <IconRocket size={40} stroke={1.5} />
                        </ThemeIcon>
                        <Title order={1} ta="center" mt="md">
                            Apollo A.I.
                        </Title>
                        <Text c="dimmed" size="sm" ta="center">
                            Plataforma de Agentes Inteligentes
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
                                size="md"
                            />

                            <PasswordInput
                                label="Senha"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                                size="md"
                            />

                            <Group justify="flex-end">
                                <Anchor component={Link} to="/forgot-password" size="sm" c="dimmed">
                                    Esqueceu a senha?
                                </Anchor>
                            </Group>

                            <Button
                                type="submit"
                                fullWidth
                                loading={loading}
                                size="md"
                                variant="gradient"
                                gradient={{ from: 'indigo', to: 'violet' }}
                            >
                                Entrar
                            </Button>
                        </Stack>
                    </form>

                    <Divider label="ou" labelPosition="center" my="lg" />

                    <Button
                        component={Link}
                        to="/register"
                        fullWidth
                        variant="outline"
                        size="md"
                    >
                        Criar nova conta
                    </Button>
                </Paper>

                <Text c="dimmed" size="xs" ta="center" mt={30}>
                    © 2026 Apollo A.I. Advanced. Todos os direitos reservados.
                </Text>
            </Container>
        </Box>
    )
}
