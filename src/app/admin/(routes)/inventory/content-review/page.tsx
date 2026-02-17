/**
 * Content Review Panel: review AI-generated content, regenerate, bulk actions.
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'

interface ProductRow {
  id: string
  name: string
  score: number
  gap: string
}

export default function ContentReviewPage() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState<string | null>(null)

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ai/quality/products?sort=score&order=asc&limit=50')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setProducts(json.data?.products ?? [])
    } catch (e) {
      toast({ title: 'Failed to load products', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleRegenerate = async (productId: string) => {
    setRegenerating(productId)
    try {
      const res = await fetch('/api/admin/ai/backfill/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: [productId],
          types: ['text', 'spec'],
          trigger: 'manual',
        }),
      })
      if (!res.ok) throw new Error('Trigger failed')
      toast({ title: 'Backfill queued for product' })
    } catch (e) {
      toast({ title: 'Failed to queue', variant: 'destructive' })
    } finally {
      setRegenerating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Review</h1>
        <p className="text-muted-foreground">Review and regenerate AI-generated content for products with gaps.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Products with content gaps</CardTitle>
          <Button variant="outline" size="sm" onClick={loadProducts} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Quality Score</TableHead>
                  <TableHead>Gaps</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/admin/inventory/products/${p.id}/review`} className="text-primary hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.score >= 60 ? 'secondary' : p.score >= 40 ? 'outline' : 'destructive'}>
                        {p.score}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.gap || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerate(p.id)}
                        disabled={regenerating === p.id}
                      >
                        {regenerating === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="mr-1 h-4 w-4" />
                            Regenerate
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && products.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">No products with gaps.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
