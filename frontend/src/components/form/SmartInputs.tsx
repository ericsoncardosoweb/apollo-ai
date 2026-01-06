/**
 * Smart Form Components - Inputs inteligentes com máscaras e validação
 * Componentes globais reutilizáveis em toda a aplicação
 */

import { forwardRef, useState } from 'react'
import { TextInput, TextInputProps, Select, Group, Text, Box } from '@mantine/core'
import { IMaskInput } from 'react-imask'
import { IconPhone, IconMail, IconMapPin, IconBuilding, IconCalendar, IconUser } from '@tabler/icons-react'

// =============================================================================
// COUNTRY DATA (DDI + FLAGS)
// =============================================================================

const COUNTRIES = [
    { code: 'BR', ddi: '+55', flag: '🇧🇷', name: 'Brasil' },
    { code: 'US', ddi: '+1', flag: '🇺🇸', name: 'Estados Unidos' },
    { code: 'PT', ddi: '+351', flag: '🇵🇹', name: 'Portugal' },
    { code: 'AR', ddi: '+54', flag: '🇦🇷', name: 'Argentina' },
    { code: 'MX', ddi: '+52', flag: '🇲🇽', name: 'México' },
    { code: 'ES', ddi: '+34', flag: '🇪🇸', name: 'Espanha' },
    { code: 'FR', ddi: '+33', flag: '🇫🇷', name: 'França' },
    { code: 'DE', ddi: '+49', flag: '🇩🇪', name: 'Alemanha' },
    { code: 'IT', ddi: '+39', flag: '🇮🇹', name: 'Itália' },
    { code: 'UK', ddi: '+44', flag: '🇬🇧', name: 'Reino Unido' },
]

// =============================================================================
// PHONE INPUT WITH DDI SELECTOR
// =============================================================================

interface PhoneInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
    value?: string
    onChange?: (value: string) => void
    defaultCountry?: string
}

export function PhoneInput({
    value = '',
    onChange,
    defaultCountry = 'BR',
    ...props
}: PhoneInputProps) {
    const [country, setCountry] = useState(defaultCountry)
    const selectedCountry = COUNTRIES.find(c => c.code === country) || COUNTRIES[0]

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const phone = e.target.value.replace(/\D/g, '')
        onChange?.(`${selectedCountry.ddi} ${phone}`)
    }

    // Extract phone number without DDI for display
    const phoneNumber = value.replace(selectedCountry.ddi, '').trim()

    return (
        <Group gap={0} align="flex-end">
            <Select
                data={COUNTRIES.map(c => ({
                    value: c.code,
                    label: `${c.flag} ${c.ddi}`,
                }))}
                value={country}
                onChange={(val) => setCountry(val || 'BR')}
                w={100}
                size={props.size}
                styles={{
                    input: {
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                    },
                }}
                comboboxProps={{ withinPortal: true }}
            />
            <TextInput
                {...props}
                value={phoneNumber}
                onChange={handlePhoneChange}
                leftSection={<IconPhone size={16} />}
                placeholder="(99) 99999-9999"
                style={{ flex: 1, ...props.style }}
                styles={{
                    input: {
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderLeft: 0,
                    },
                }}
            />
        </Group>
    )
}

// =============================================================================
// EMAIL INPUT WITH VALIDATION
// =============================================================================

interface EmailInputProps extends Omit<TextInputProps, 'type'> {
    validateOnBlur?: boolean
}

export function EmailInput({ validateOnBlur = true, ...props }: EmailInputProps) {
    const [error, setError] = useState<string | null>(null)

    const validateEmail = (email: string) => {
        if (!email) {
            setError(null)
            return
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Email inválido')
        } else {
            setError(null)
        }
    }

    return (
        <TextInput
            {...props}
            type="email"
            leftSection={<IconMail size={16} />}
            placeholder={props.placeholder || 'email@exemplo.com'}
            error={error || props.error}
            onBlur={(e) => {
                if (validateOnBlur) validateEmail(e.target.value)
                props.onBlur?.(e)
            }}
        />
    )
}

// =============================================================================
// CEP INPUT WITH MASK
// =============================================================================

interface CEPInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
    value?: string
    onChange?: (value: string) => void
    onCEPComplete?: (cep: string) => void
}

export const CEPInput = forwardRef<HTMLInputElement, CEPInputProps>(
    ({ value = '', onChange, onCEPComplete, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const cep = e.target.value
            onChange?.(cep)

            // Check if CEP is complete (8 digits)
            const cleanCep = cep.replace(/\D/g, '')
            if (cleanCep.length === 8) {
                onCEPComplete?.(cleanCep)
            }
        }

        return (
            <TextInput
                {...props}
                ref={ref}
                value={value}
                onChange={handleChange}
                leftSection={<IconMapPin size={16} />}
                placeholder="00000-000"
            />
        )
    }
)
CEPInput.displayName = 'CEPInput'

// =============================================================================
// CNPJ INPUT WITH MASK
// =============================================================================

interface CNPJInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
    value?: string
    onChange?: (value: string) => void
}

export const CNPJInput = forwardRef<HTMLInputElement, CNPJInputProps>(
    ({ value = '', onChange, ...props }, ref) => {
        return (
            <TextInput
                {...props}
                ref={ref}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                leftSection={<IconBuilding size={16} />}
                placeholder="00.000.000/0000-00"
            />
        )
    }
)
CNPJInput.displayName = 'CNPJInput'

// =============================================================================
// CPF INPUT WITH MASK
// =============================================================================

interface CPFInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
    value?: string
    onChange?: (value: string) => void
}

export const CPFInput = forwardRef<HTMLInputElement, CPFInputProps>(
    ({ value = '', onChange, ...props }, ref) => {
        return (
            <TextInput
                {...props}
                ref={ref}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                leftSection={<IconUser size={16} />}
                placeholder="000.000.000-00"
            />
        )
    }
)
CPFInput.displayName = 'CPFInput'

// =============================================================================
// DATE INPUT (MANUAL - NO DATEPICKER)
// =============================================================================

interface DateInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
    value?: string
    onChange?: (value: string) => void
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
    ({ value = '', onChange, ...props }, ref) => {
        const [error, setError] = useState<string | null>(null)

        const validateDate = (dateStr: string) => {
            if (!dateStr || dateStr.length < 10) {
                setError(null)
                return
            }

            const parts = dateStr.split('/')
            if (parts.length !== 3) {
                setError('Formato: DD/MM/AAAA')
                return
            }

            const day = parseInt(parts[0], 10)
            const month = parseInt(parts[1], 10)
            const year = parseInt(parts[2], 10)

            if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
                setError('Data inválida')
            } else {
                setError(null)
            }
        }

        return (
            <TextInput
                {...props}
                ref={ref}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onBlur={(e) => {
                    validateDate(e.target.value)
                    props.onBlur?.(e)
                }}
                leftSection={<IconCalendar size={16} />}
                placeholder="DD/MM/AAAA"
                error={error || props.error}
            />
        )
    }
)
DateInput.displayName = 'DateInput'

// =============================================================================
// CURRENCY INPUT (BRL)
// =============================================================================

interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
    value?: number | null
    onChange?: (value: number | null) => void
}

export function CurrencyInput({ value, onChange, ...props }: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState(
        value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''
    )

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '')
        const number = parseInt(raw, 10) / 100

        if (isNaN(number)) {
            setDisplayValue('')
            onChange?.(null)
        } else {
            setDisplayValue(number.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
            onChange?.(number)
        }
    }

    return (
        <TextInput
            {...props}
            value={displayValue}
            onChange={handleChange}
            leftSection={<Text size="sm" c="dimmed">R$</Text>}
            placeholder="0,00"
        />
    )
}
