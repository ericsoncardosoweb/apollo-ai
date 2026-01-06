/**
 * ConversionFunnel - Componente reutilizável para Funil de Conversão
 * Usado em: Dashboard Admin, Dashboard Cliente, Analytics
 */

import { Paper, Stack, Group, Text, Badge, Progress, Skeleton } from '@mantine/core'
import { IconFilter } from '@tabler/icons-react'

export interface FunnelStage {
    name: string
    value: number
    color?: string
    conversionRate?: number // Taxa de conversão para próximo estágio
}

export interface ConversionFunnelProps {
    /** Título do card */
    title?: string
    /** Badge com comparação período */
    badgeText?: string
    /** Cor do badge */
    badgeColor?: string
    /** Estágios do funil */
    stages: FunnelStage[]
    /** Se está carregando */
    loading?: boolean
    /** Mostrar taxa de conversão */
    showConversionRates?: boolean
}

export function ConversionFunnel({
    title = 'Funil de Conversão',
    badgeText,
    badgeColor = 'teal',
    stages,
    loading = false,
    showConversionRates = true,
}: ConversionFunnelProps) {
    // Calcula taxas de conversão se não fornecidas
    const stagesWithRates = stages.map((stage, index) => {
        if (stage.conversionRate !== undefined) return stage

        if (index === 0) return { ...stage, conversionRate: undefined }

        const prevValue = stages[index - 1].value
        const rate = prevValue > 0 ? (stage.value / prevValue) * 100 : 0
        return { ...stage, conversionRate: rate }
    })

    const maxValue = Math.max(...stages.map(s => s.value))

    if (loading) {
        return (
            <Paper p="lg" withBorder radius="md">
                <Group justify="space-between" mb="md">
                    <Group gap="xs">
                        <Skeleton width={18} height={18} />
                        <Skeleton width={140} height={20} />
                    </Group>
                    <Skeleton width={120} height={22} radius="xl" />
                </Group>
                <Stack gap="lg">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i}>
                            <Skeleton height={20} mb={4} />
                            <Skeleton height={12} />
                        </div>
                    ))}
                </Stack>
            </Paper>
        )
    }

    return (
        <Paper p="lg" withBorder radius="md">
            <Group justify="space-between" mb="md">
                <Group gap="xs">
                    <IconFilter size={18} />
                    <Text fw={600}>{title}</Text>
                </Group>
                {badgeText && (
                    <Badge color={badgeColor} variant="light">{badgeText}</Badge>
                )}
            </Group>

            <Stack gap="lg">
                {stagesWithRates.map((stage, index) => {
                    const widthPercent = maxValue > 0
                        ? (stage.value / maxValue) * 100
                        : 0

                    return (
                        <div key={stage.name}>
                            <Group justify="space-between" mb={4}>
                                <Text size="sm">{stage.name}</Text>
                                <Group gap="xs">
                                    <Text size="sm" fw={500}>
                                        {stage.value.toLocaleString('pt-BR')}
                                    </Text>
                                    {showConversionRates && stage.conversionRate !== undefined && (
                                        <Badge size="xs" variant="outline" color="blue">
                                            {stage.conversionRate.toFixed(0)}% CONV
                                        </Badge>
                                    )}
                                </Group>
                            </Group>
                            <Progress
                                value={widthPercent}
                                color={stage.color || (index === stagesWithRates.length - 1 ? 'green' : 'blue')}
                                size="lg"
                                radius="md"
                            />
                            {showConversionRates && stage.conversionRate !== undefined && (
                                <Text size="xs" c="dimmed" mt={2}>
                                    ↑ {stage.conversionRate.toFixed(1)}% de conversão
                                </Text>
                            )}
                        </div>
                    )
                })}
            </Stack>
        </Paper>
    )
}

export default ConversionFunnel
