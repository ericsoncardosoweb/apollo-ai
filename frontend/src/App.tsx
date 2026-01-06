/**
 * Apollo A.I. Advanced - Main Application Router
 * Role-based routing with protected routes
 */

import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { TenantProvider } from '@/contexts/TenantContext'
import { Center, Loader, Stack, Text } from '@mantine/core'

// Layouts
import AdminLayout from '@/components/layout/AdminLayout'
import ClientLayout from '@/components/layout/ClientLayout'

// Public Pages
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'

// Admin Pages
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminCompanies from '@/pages/admin/Companies'
import AdminAgents from '@/pages/admin/Agents'
import AdminUsers from '@/pages/admin/Users'
import AdminWebhooks from '@/pages/admin/Webhooks'
import AdminAnalytics from '@/pages/admin/Analytics'
import AdminSettings from '@/pages/admin/Settings'

// Client/App Pages
import AppDashboard from '@/pages/app/Dashboard'
import AppInbox from '@/pages/app/Inbox'
import AppCRM from '@/pages/app/CRM'
import AppContacts from '@/pages/app/Contacts'
import AppAgents from '@/pages/app/Agents'
import AppAnalytics from '@/pages/app/Analytics'
import AppSettings from '@/pages/app/Settings'

// Loading Screen
function LoadingScreen() {
    return (
        <Center h="100vh" bg="dark.9">
            <Stack align="center" gap="md">
                <Loader size="lg" color="indigo" type="bars" />
                <Text size="sm" c="dimmed">Carregando Apollo A.I...</Text>
            </Stack>
        </Center>
    )
}

// Protected Route - Requires authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return <LoadingScreen />
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}

// Admin Route - Requires admin role
function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user, role, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return <LoadingScreen />
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Only admins can access admin routes
    if (role !== 'admin') {
        return <Navigate to="/app" replace />
    }

    return <>{children}</>
}

// Public Route - Redirects authenticated users
function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, role, loading } = useAuth()

    if (loading) {
        return <LoadingScreen />
    }

    if (user) {
        // Redirect to appropriate dashboard based on role
        if (role === 'admin') {
            return <Navigate to="/admin" replace />
        }
        return <Navigate to="/app" replace />
    }

    return <>{children}</>
}

// Smart Home Redirect - Goes to correct dashboard based on role
function HomeRedirect() {
    const { user, role, loading } = useAuth()

    if (loading) {
        return <LoadingScreen />
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (role === 'admin') {
        return <Navigate to="/admin" replace />
    }

    return <Navigate to="/app" replace />
}

function AppRoutes() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
                <PublicRoute>
                    <Login />
                </PublicRoute>
            } />
            <Route path="/register" element={
                <PublicRoute>
                    <Register />
                </PublicRoute>
            } />
            <Route path="/forgot-password" element={
                <PublicRoute>
                    <ForgotPassword />
                </PublicRoute>
            } />
            <Route path="/reset-password" element={
                <ResetPassword />
            } />

            {/* Admin Routes - Platform Administrators */}
            <Route path="/admin" element={
                <AdminRoute>
                    <AdminLayout />
                </AdminRoute>
            }>
                <Route index element={<AdminDashboard />} />
                <Route path="companies" element={<AdminCompanies />} />
                <Route path="agents" element={<AdminAgents />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="webhooks" element={<AdminWebhooks />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Client Routes - Company Users (Operators/Managers) */}
            <Route path="/app" element={
                <ProtectedRoute>
                    <TenantProvider>
                        <ClientLayout />
                    </TenantProvider>
                </ProtectedRoute>
            }>
                <Route index element={<AppDashboard />} />
                <Route path="inbox" element={<AppInbox />} />
                <Route path="crm" element={<AppCRM />} />
                <Route path="contacts" element={<AppContacts />} />
                <Route path="agents" element={<AppAgents />} />
                <Route path="analytics" element={<AppAnalytics />} />
                <Route path="settings" element={<AppSettings />} />
            </Route>

            {/* Home Redirect */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    )
}

export default App
