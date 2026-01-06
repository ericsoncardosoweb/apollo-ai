/**
 * Validation Utilities for Brazilian Documents and Phone Numbers
 */

// =============================================================================
// CPF VALIDATION
// =============================================================================

/**
 * Validate Brazilian CPF
 */
export function validateCPF(cpf: string): boolean {
    const cleaned = cpf.replace(/\D/g, '')

    if (cleaned.length !== 11) return false
    if (/^(\d)\1+$/.test(cleaned)) return false // All same digits

    // Calculate first digit
    let sum = 0
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleaned[i]) * (10 - i)
    }
    let digit = 11 - (sum % 11)
    if (digit >= 10) digit = 0
    if (digit !== parseInt(cleaned[9])) return false

    // Calculate second digit
    sum = 0
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleaned[i]) * (11 - i)
    }
    digit = 11 - (sum % 11)
    if (digit >= 10) digit = 0
    if (digit !== parseInt(cleaned[10])) return false

    return true
}

/**
 * Format CPF as XXX.XXX.XXX-XX
 */
export function formatCPF(cpf: string): string {
    const cleaned = cpf.replace(/\D/g, '')
    if (cleaned.length !== 11) return cpf
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

// =============================================================================
// CNPJ VALIDATION
// =============================================================================

/**
 * Validate Brazilian CNPJ
 */
export function validateCNPJ(cnpj: string): boolean {
    const cleaned = cnpj.replace(/\D/g, '')

    if (cleaned.length !== 14) return false
    if (/^(\d)\1+$/.test(cleaned)) return false

    // Calculate first digit
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleaned[i]) * weights1[i]
    }
    let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    if (digit !== parseInt(cleaned[12])) return false

    // Calculate second digit
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    sum = 0
    for (let i = 0; i < 13; i++) {
        sum += parseInt(cleaned[i]) * weights2[i]
    }
    digit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    if (digit !== parseInt(cleaned[13])) return false

    return true
}

/**
 * Format CNPJ as XX.XXX.XXX/XXXX-XX
 */
export function formatCNPJ(cnpj: string): string {
    const cleaned = cnpj.replace(/\D/g, '')
    if (cleaned.length !== 14) return cnpj
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

// =============================================================================
// PHONE VALIDATION
// =============================================================================

/**
 * Normalize phone number to +55XXXXXXXXXXX format
 * Returns null if invalid
 */
export function normalizePhone(phone: string, defaultDDI: string = '55'): string | null {
    if (!phone) return null

    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '')

    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '')

    // If empty after cleaning
    if (!cleaned) return null

    // Determine format
    if (cleaned.length === 8 || cleaned.length === 9) {
        // Local number without DDD - invalid for WhatsApp
        return null
    } else if (cleaned.length === 10 || cleaned.length === 11) {
        // Brazilian number with DDD
        cleaned = defaultDDI + cleaned
    } else if (cleaned.length === 12 || cleaned.length === 13) {
        // Already has country code (55 + DDD + number)
        if (!cleaned.startsWith('55')) {
            cleaned = defaultDDI + cleaned
        }
    } else if (cleaned.length > 13) {
        // Already has + country code, validate
        // Keep as is if valid length
    } else {
        return null
    }

    // Validate Brazilian mobile (must be 12-13 digits total)
    if (cleaned.startsWith('55')) {
        const withoutCountry = cleaned.substring(2)
        if (withoutCountry.length < 10 || withoutCountry.length > 11) {
            return null
        }
    }

    return '+' + cleaned
}

/**
 * Format phone for display
 */
export function formatPhone(phone: string): string {
    if (!phone) return ''

    const cleaned = phone.replace(/\D/g, '')

    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        // +55 11 99999-9999
        return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`
    } else if (cleaned.length === 12 && cleaned.startsWith('55')) {
        // +55 11 9999-9999
        return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 8)}-${cleaned.substring(8)}`
    }

    return phone
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): boolean {
    const normalized = normalizePhone(phone)
    return normalized !== null
}

// =============================================================================
// EMAIL VALIDATION
// =============================================================================

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
    if (!email) return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
    return email.toLowerCase().trim()
}

// =============================================================================
// DATE PARSING
// =============================================================================

/**
 * Parse date from various formats
 * Supports: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY, etc.
 */
export function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null

    const str = dateStr.trim()

    // Try ISO format first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const date = new Date(str)
        if (!isNaN(date.getTime())) return date
    }

    // Brazilian format DD/MM/YYYY or DD-MM-YYYY
    const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (brMatch) {
        const [, day, month, year] = brMatch
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        if (!isNaN(date.getTime())) return date
    }

    // US format MM/DD/YYYY
    const usMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (usMatch) {
        const [, month, day, year] = usMatch
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        if (!isNaN(date.getTime())) return date
    }

    // Try generic parsing
    const date = new Date(str)
    if (!isNaN(date.getTime())) return date

    return null
}

/**
 * Format date for display (DD/MM/YYYY)
 */
export function formatDate(date: Date | string | null): string {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('pt-BR')
}

// =============================================================================
// DEDUPE DETECTION
// =============================================================================

export interface DuplicateMatch {
    field: 'whatsapp' | 'email' | 'cpf' | 'cnpj'
    value: string
    existingId: string
    existingName: string
}

/**
 * Check if contact is a duplicate based on unique fields
 */
export function findDuplicateFields(
    newContact: { whatsapp?: string; email?: string; cpf?: string; cnpj?: string },
    existingContacts: Array<{ id: string; name: string; whatsapp?: string; email?: string; cpf?: string; cnpj?: string }>
): DuplicateMatch[] {
    const matches: DuplicateMatch[] = []

    for (const existing of existingContacts) {
        if (newContact.whatsapp && existing.whatsapp &&
            normalizePhone(newContact.whatsapp) === normalizePhone(existing.whatsapp)) {
            matches.push({
                field: 'whatsapp',
                value: newContact.whatsapp,
                existingId: existing.id,
                existingName: existing.name
            })
        }

        if (newContact.email && existing.email &&
            normalizeEmail(newContact.email) === normalizeEmail(existing.email)) {
            matches.push({
                field: 'email',
                value: newContact.email,
                existingId: existing.id,
                existingName: existing.name
            })
        }

        if (newContact.cpf && existing.cpf &&
            newContact.cpf.replace(/\D/g, '') === existing.cpf.replace(/\D/g, '')) {
            matches.push({
                field: 'cpf',
                value: newContact.cpf,
                existingId: existing.id,
                existingName: existing.name
            })
        }

        if (newContact.cnpj && existing.cnpj &&
            newContact.cnpj.replace(/\D/g, '') === existing.cnpj.replace(/\D/g, '')) {
            matches.push({
                field: 'cnpj',
                value: newContact.cnpj,
                existingId: existing.id,
                existingName: existing.name
            })
        }
    }

    return matches
}
