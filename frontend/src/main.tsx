import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

// Mantine styles
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'

// App
import App from './App'
import './index.css'

// Apollo A.I. Theme - Enterprise Dark
const theme = createTheme({
    primaryColor: 'indigo',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    defaultRadius: 'md',
    colors: {
        // Custom Apollo brand colors
        apollo: [
            '#eef2ff',
            '#e0e7ff',
            '#c7d2fe',
            '#a5b4fc',
            '#818cf8',
            '#6366f1',
            '#4f46e5',
            '#4338ca',
            '#3730a3',
            '#312e81',
        ],
    },
    components: {
        Button: {
            defaultProps: {
                variant: 'filled',
            },
        },
        Card: {
            defaultProps: {
                withBorder: true,
                radius: 'md',
            },
        },
        Modal: {
            defaultProps: {
                centered: true,
                radius: 'md',
            },
        },
        TextInput: {
            defaultProps: {
                radius: 'md',
            },
        },
        Select: {
            defaultProps: {
                radius: 'md',
            },
        },
    },
})

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <MantineProvider theme={theme} defaultColorScheme="dark">
            <Notifications position="top-right" />
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </QueryClientProvider>
        </MantineProvider>
    </React.StrictMode>,
)
