/**
 * Verify email – handle token from link and show success or error.
 */

'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

function VerifyContent() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (res.ok) setStatus('success')
        else setStatus('error')
      })
      .catch(() => setStatus('error'))
  }, [token])

  if (status === 'loading') {
    return <p className="text-muted-foreground">Verifying your email…</p>
  }
  if (status === 'success') {
    return (
      <>
        <h1 className="mb-4 text-2xl font-bold">Email verified</h1>
        <p className="mb-6 text-muted-foreground">
          Your email has been verified. You can now sign in.
        </p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </>
    )
  }
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Verification failed</h1>
      <p className="mb-6 text-muted-foreground">
        The link may be invalid or expired. Request a new one from your account settings or contact
        support.
      </p>
      <Button asChild variant="outline">
        <Link href="/login">Back to login</Link>
      </Button>
    </>
  )
}

export default function VerifyEmailPage() {
  return (
    <main className="container mx-auto max-w-md px-4 py-12">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <VerifyContent />
      </Suspense>
    </main>
  )
}
