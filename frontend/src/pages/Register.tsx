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
    Anchor,
    Box,
    Progress,
    Checkbox,
} from '@mantine/core'
import { IconAlertCircle, IconRocket, IconCheck } from '@tabler/icons-react'

// Password strength calculation
function getPasswordStrength(password: string): number {
    let strength = 0
    if (password.length >= 8) strength += 25
    if (/[a-z]/.test(password)) strength += 25
    if (/[A-Z]/.test(password)) strength += 25
    if (/[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password)) strength += 25
    return strength
}

function getStrengthColor(strength: number): string {
    if (strength < 50) return 'red'
    if (strength < 75) return 'yellow'
    return 'green'
}

export default function Register() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [acceptTerms, setAcceptTerms] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const { signUp } = useAuth()
    const navigate = useNavigate()

    const passwordStrength = getPasswordStrength(password)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validations
        if (password !== confirmPassword) {
            setError('As senhas não coincidem')
            return
        }

        if (passwordStrength < 50) {
            setError('A senha é muito fraca. Use letras maiúsculas, minúsculas e números.')
            return
        }

        if (!acceptTerms) {
            setError('Você precisa aceitar os termos de uso')
            return
        }

        setLoading(true)

        try {
            await signUp(email, password, name)
            setSuccess(true)
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao criar conta'
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
                            <Title order={2} ta="center">Conta Criada!</Title>
                            <Text c="dimmed" ta="center" maw={300}>
                                Enviamos um email de confirmação para <strong>{email}</strong>.
                                Verifique sua caixa de entrada para ativar sua conta.
                            </Text>
                            <Button
                                variant="light"
                                onClick={() => navigate('/login')}
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
            <Container size={420} py={60}>
                <Center mb={20}>
                    <Stack align="center" gap="xs">
                        <ThemeIcon
                            size={60}
                            radius="xl"
                            variant="gradient"
                            gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
                        >
                            <IconRocket size={30} stroke={1.5} />
                        </ThemeIcon>
                        <Title order={2} ta="center" mt="md">
                            Criar Conta
                        </Title>
                        <Text c="dimmed" size="sm" ta="center">
                            Comece a usar o Apollo A.I. gratuitamente
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
                                label="Nome completo"
                                placeholder="Seu nome"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <TextInput
                                label="E-mail"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <div>
                                <PasswordInput
                                    label="Senha"
                                    placeholder="Mínimo 8 caracteres"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                                {password && (
                                    <Progress
                                        value={passwordStrength}
                                        color={getStrengthColor(passwordStrength)}
                                        size="xs"
                                        mt={4}
                                    />
                                )}
                            </div>

                            <PasswordInput
                                label="Confirmar senha"
                                placeholder="Repita a senha"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={loading}
                                error={confirmPassword && password !== confirmPassword ? 'Senhas não coincidem' : undefined}
                            />

                            <Checkbox
                                label={
                                    <Text size="sm">
                                        Aceito os{' '}
                                        <Anchor href="/terms" target="_blank" size="sm">
                                            termos de uso
                                        </Anchor>
                                        {' '}e{' '}
                                        <Anchor href="/privacy" target="_blank" size="sm">
                                            política de privacidade
                                        </Anchor>
                                    </Text>
                                }
                                checked={acceptTerms}
                                onChange={(e) => setAcceptTerms(e.currentTarget.checked)}
                                disabled={loading}
                            />

                            <Button
                                type="submit"
                                fullWidth
                                loading={loading}
                                variant="gradient"
                                gradient={{ from: 'indigo', to: 'violet' }}
                            >
                                Criar Conta
                            </Button>
                        </Stack>
                    </form>
                </Paper>

                <Text ta="center" mt="md" size="sm" c="dimmed">
                    Já tem uma conta?{' '}
                    <Anchor component={Link} to="/login" size="sm">
                        Faça login
                    </Anchor>
                </Text>
            </Container>
        </Box>
    )
}
