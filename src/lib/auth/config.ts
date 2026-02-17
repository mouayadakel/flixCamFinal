/**
 * @file config.ts
 * @description NextAuth.js configuration
 * @module lib/auth
 */

import type { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // #region agent log
        const log = (loc: string, msg: string, data: Record<string, unknown>) =>
          fetch('http://127.0.0.1:7247/ingest/d745db1b-a338-48e7-a9b9-281bdcdffd3a', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: loc,
              message: msg,
              data,
              timestamp: Date.now(),
              hypothesisId: 'H4',
            }),
          }).catch(() => {})
        // #endregion
        if (!credentials?.email || !credentials?.password) {
          log('auth/config.ts:authorize', 'missing credentials', {
            hasEmail: !!credentials?.email,
            hasPassword: !!credentials?.password,
          })
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string
        log('auth/config.ts:authorize:entry', 'authorize called', { email })

        const { prisma } = await import('@/lib/db/prisma')
        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || user.deletedAt) {
          log('auth/config.ts:authorize', 'user not found or deleted', { userFound: !!user })
          return null
        }

        if (user.status !== 'active') {
          log('auth/config.ts:authorize', 'user not active', { status: user.status })
          return null
        }

        const bcrypt = await import('bcryptjs')
        const isValid = await bcrypt.compare(password, user.passwordHash)
        log('auth/config.ts:authorize', 'password check', { passwordValid: isValid })

        if (!isValid) {
          return null
        }

        log('auth/config.ts:authorize', 'authorized', { userId: user.id, role: user.role })
        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: user.role,
        }
      },
    }),
    /** Phase 3.2: one-time login after OTP verify (deferred registration). */
    CredentialsProvider({
      id: 'phone-otp',
      name: 'Phone OTP',
      credentials: {
        oneTimeToken: { label: 'One-time token', type: 'text' },
      },
      async authorize(credentials) {
        const token = credentials?.oneTimeToken as string | undefined
        if (!token) return null

        const { cacheGet, cacheDelete } = await import('@/lib/cache')
        const userId = await cacheGet<string>('authToken', token)
        if (!userId) return null

        const { prisma } = await import('@/lib/db/prisma')
        const user = await prisma.user.findUnique({
          where: { id: userId },
        })
        if (!user || user.deletedAt || user.status !== 'active') return null

        await cacheDelete('authToken', token)
        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours (Phase 0.3: session security)
    updateAge: 30 * 60, // 30 min inactivity refresh window
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60, // 24 hours
      },
    },
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
}
