/**
 * Company Spotlight - Command Palette style company selector
 * Features: Search, recent companies, create new, keyboard navigation
 */

import { useState, useEffect, useMemo } from 'react'
import {
    Modal,
    TextInput,
    Stack,
    Group,
    Text,
    Box,
    Badge,
    ThemeIcon,
    ActionIcon,
    ScrollArea,
    Paper,
    Kbd,
    Divider,
    Button,
    Loader,
    Center,
} from '@mantine/core'
import {
    IconSearch,
    IconBuilding,
    IconPlus,
    IconClock,
    IconChevronRight,
    IconStar,
    IconStarFilled,
} from '@tabler/icons-react'
import { Company } from '@/types'

interface CompanySpotlightProps {
    opened: boolean
    onClose: () => void
    companies: Company[]
    loading: boolean
    onSelectCompany: (company: Company) => void
    onCreateCompany: () => void
}

export default function CompanySpotlight({
    opened,
    onClose,
    companies,
    loading,
    onSelectCompany,
    onCreateCompany,
}: CompanySpotlightProps) {
    const [search, setSearch] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [favorites, setFavorites] = useState<string[]>([])

    // Load favorites from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('apollo_favorite_companies')
        if (saved) {
            setFavorites(JSON.parse(saved))
        }
    }, [])

    // Reset search when modal opens
    useEffect(() => {
        if (opened) {
            setSearch('')
            setSelectedIndex(0)
        }
    }, [opened])

    // Filter and sort companies
    const filteredCompanies = useMemo(() => {
        let result = companies.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.slug.toLowerCase().includes(search.toLowerCase())
        )

        // Sort: favorites first, then alphabetically
        result.sort((a, b) => {
            const aIsFav = favorites.includes(a.id)
            const bIsFav = favorites.includes(b.id)
            if (aIsFav && !bIsFav) return -1
            if (!aIsFav && bIsFav) return 1
            return a.name.localeCompare(b.name)
        })

        return result
    }, [companies, search, favorites])

    // Keyboard navigation
    useEffect(() => {
        if (!opened) return

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault()
                    setSelectedIndex(i => Math.min(i + 1, filteredCompanies.length - 1))
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    setSelectedIndex(i => Math.max(i - 1, 0))
                    break
                case 'Enter':
                    e.preventDefault()
                    if (filteredCompanies[selectedIndex]) {
                        onSelectCompany(filteredCompanies[selectedIndex])
                        onClose()
                    }
                    break
                case 'Escape':
                    onClose()
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [opened, selectedIndex, filteredCompanies, onSelectCompany, onClose])

    // Toggle favorite
    const toggleFavorite = (companyId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const newFavorites = favorites.includes(companyId)
            ? favorites.filter(id => id !== companyId)
            : [...favorites, companyId]
        setFavorites(newFavorites)
        localStorage.setItem('apollo_favorite_companies', JSON.stringify(newFavorites))
    }

    // Plan badge color
    const getPlanColor = (plan: string) => {
        switch (plan) {
            case 'enterprise': return 'violet'
            case 'pro': return 'teal'
            default: return 'gray'
        }
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="lg"
            padding={0}
            withCloseButton={false}
            centered
            overlayProps={{ blur: 3 }}
            radius="lg"
        >
            <Box p="md" pb={0}>
                <TextInput
                    placeholder="Buscar empresa por nome..."
                    leftSection={<IconSearch size={18} />}
                    rightSection={
                        <Group gap={4}>
                            <Kbd size="xs">↑↓</Kbd>
                            <Kbd size="xs">Enter</Kbd>
                        </Group>
                    }
                    rightSectionWidth={90}
                    size="lg"
                    variant="filled"
                    autoFocus
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        setSelectedIndex(0)
                    }}
                />
            </Box>

            <Divider my="sm" />

            <ScrollArea.Autosize mah={400}>
                <Box p="md" pt={0}>
                    {loading ? (
                        <Center py="xl">
                            <Loader size="sm" />
                        </Center>
                    ) : filteredCompanies.length === 0 ? (
                        <Stack align="center" py="xl">
                            <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                                <IconBuilding size={30} />
                            </ThemeIcon>
                            <Text c="dimmed">
                                {search ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
                            </Text>
                            <Button
                                variant="light"
                                leftSection={<IconPlus size={16} />}
                                onClick={() => {
                                    onCreateCompany()
                                    onClose()
                                }}
                            >
                                Cadastrar nova empresa
                            </Button>
                        </Stack>
                    ) : (
                        <Stack gap={4}>
                            {/* Recent/Favorites section */}
                            {favorites.length > 0 && !search && (
                                <>
                                    <Group gap="xs" px="xs" mb={4}>
                                        <IconClock size={12} />
                                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                                            Favoritos
                                        </Text>
                                    </Group>
                                </>
                            )}

                            {filteredCompanies.map((company, index) => (
                                <Paper
                                    key={company.id}
                                    p="sm"
                                    radius="md"
                                    bg={selectedIndex === index ? 'dark.5' : 'transparent'}
                                    style={{
                                        cursor: 'pointer',
                                        transition: 'background 0.1s',
                                    }}
                                    onClick={() => {
                                        onSelectCompany(company)
                                        onClose()
                                    }}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <Group justify="space-between">
                                        <Group gap="sm">
                                            <ThemeIcon
                                                size="lg"
                                                radius="md"
                                                variant="light"
                                                color="teal"
                                            >
                                                <IconBuilding size={18} />
                                            </ThemeIcon>
                                            <div>
                                                <Group gap="xs">
                                                    <Text fw={500}>{company.name}</Text>
                                                    {favorites.includes(company.id) && (
                                                        <IconStarFilled size={14} color="var(--mantine-color-yellow-5)" />
                                                    )}
                                                </Group>
                                                <Text size="xs" c="dimmed">{company.slug}</Text>
                                            </div>
                                        </Group>
                                        <Group gap="xs">
                                            <Badge size="sm" variant="light" color={getPlanColor(company.plan)}>
                                                {company.plan}
                                            </Badge>
                                            <ActionIcon
                                                variant="subtle"
                                                size="sm"
                                                onClick={(e) => toggleFavorite(company.id, e)}
                                            >
                                                {favorites.includes(company.id)
                                                    ? <IconStarFilled size={14} color="var(--mantine-color-yellow-5)" />
                                                    : <IconStar size={14} />
                                                }
                                            </ActionIcon>
                                            <IconChevronRight size={16} />
                                        </Group>
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    )}
                </Box>
            </ScrollArea.Autosize>

            <Divider />

            <Box p="md">
                <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                        {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'} cadastradas
                    </Text>
                    <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={() => {
                            onCreateCompany()
                            onClose()
                        }}
                    >
                        Nova Empresa
                    </Button>
                </Group>
            </Box>
        </Modal>
    )
}
