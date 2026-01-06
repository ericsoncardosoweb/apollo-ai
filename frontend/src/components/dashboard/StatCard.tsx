/**
 * StatCard - Componente reutilizável para KPI cards no Dashboard
 * Usado em: Dashboard Admin, Dashboard Master, Dashboard Cliente
 */

import { Paper, Group, Stack, Text, ThemeIcon, Skeleton } from '@mantine/core'
import { ReactNode } from 'react'

export interface StatCardProps {
    /** Título/Label da métrica */
    label: string
    /** Valor principal (número ou string formatada) */
    value: string | number
    /** Ícone para exibir */
    icon: ReactNode
    /** Cor do tema para o ícone */
    color?: string
    /** Variação percentual (ex: +12.5% ou -3.2%) */
    trend?: string
    /** Cor do trend: verde para positivo, vermelho para negativo */
    trendColor?: 'green' | 'red' | 'gray'
    /** Se está carregando dados */
    loading?: boolean
    /** Descrição adicional pequena */
    description?: string
}

export function StatCard({
    label,
    value,
    icon,
    color = 'blue',
    trend,
    trendColor = 'green',
    loading = false,
    description,
}: StatCardProps) {
    if (loading) {
        return (
            <Paper p="md" withBorder radius="md">
                <Group gap="xs">
                    <Skeleton width={40} height={40} radius="md" />
                    <Stack gap={4}>
                        <Skeleton width={60} height={24} />
                        <Skeleton width={80} height={12} />
                    </Stack>
                </Group>
            </Paper>
        )
    }

    return (
        <Paper p="md" withBorder radius="md">
            <Group gap="xs">
                <ThemeIcon size="lg" variant="light" color={color}>
                    {icon}
                </ThemeIcon>
                <div>
                    <Group gap={6} align="baseline">
                        <Text size="xl" fw={700}>{value}</Text>
                        {trend && (
                            <Text size="xs" c={trendColor} fw={500}>
                                {trend}
                            </Text>
                        )}
                    </Group>
                    <Text size="xs" c="dimmed">{label}</Text>
                    {description && (
                        <Text size="xs" c="dimmed" mt={2}>{description}</Text>
                    )}
                </div>
            </Group>
        </Paper>
    )
}

export default StatCard
