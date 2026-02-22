'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Calendar, Receipt, User } from 'lucide-react'

const TABS = [
  { href: '/portal/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/portal/bookings', label: 'حجوزاتي', icon: Calendar },
  { href: '/portal/invoices', label: 'الفواتير', icon: Receipt },
  { href: '/portal/profile', label: 'الملف الشخصي', icon: User },
] as const

export function PortalMobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-white/95 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Portal navigation"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || (pathname?.startsWith(href) && href !== '/portal/dashboard')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              isActive ? 'text-brand-primary' : 'text-text-muted hover:text-text-heading'
            )}
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
