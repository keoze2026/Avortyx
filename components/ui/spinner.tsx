'use client'

import { Loader2Icon } from 'lucide-react'

import { useTranslation } from '@/hooks/use-translation'

import { cn } from '@/lib/utils'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  const { t } = useTranslation()
  return (
    <Loader2Icon
      role="status"
      aria-label={t('x318.ui.loading')}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
