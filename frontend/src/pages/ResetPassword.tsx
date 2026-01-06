import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
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
    Box,
    Progress,
} from '@mantine/core'
import { IconAlertCircle, IconLock, IconCheck } from '@tabler/icons-react'

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

export default function ResetPassword() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const { updatePassword, session } = useAuth()
    const navigate = useNavigate()

    const passwordStrength = getPasswordStrength(password)

    // Check if user came from password reset link
    useEffect(() => {
        if (!session) {
            // Will be handled by Supabase redirect
        }
    }, [session])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password !== confirmPassword) {
            setError('As senhas não coincidem')
            return
        }

        if (passwordStrength < 50) {
            setError('A senha é muito fraca')
            return
        }

        setLoading(true)

        try {
            await updatePassword(password)
            setSuccess(true)
            setTimeout(() => navigate('/login'), 3000)
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar senha'
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
                            <Title order={2} ta="center">Senha Atualizada!</Title>
                            <Text c="dimmed" ta="center">
                                Sua senha foi alterada com sucesso. Redirecionando para login...
                            </Text>
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
                            <IconLock size={30} stroke={1.5} />
                        </ThemeIcon>
                        <Title order={2} ta="center" mt="md">
                            Redefinir Senha
                        </Title>
                        <Text c="dimmed" size="sm" ta="center">
                            Digite sua nova senha
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

                            <div>
                                <PasswordInput
                                    label="Nova senha"
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
                                label="Confirmar nova senha"
                                placeholder="Repita a senha"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={loading}
                                error={confirmPassword && password !== confirmPassword ? 'Senhas não coincidem' : undefined}
                            />

                            <Button
                                type="submit"
                                fullWidth
                                loading={loading}
                                variant="gradient"
                                gradient={{ from: 'indigo', to: 'violet' }}
                            >
                                Atualizar Senha
                            </Button>
                        </Stack>
                    </form>
                </Paper>
            </Container>
        </Box>
    )
}
