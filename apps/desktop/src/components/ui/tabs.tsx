import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../utils/cn'

const Tabs = TabsPrimitive.Root

const TabsList = ({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn('ui-tabs-list', className)} {...props} />
)

const TabsTrigger = ({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger className={cn('ui-tabs-trigger', className)} {...props} />
)

const TabsContent = ({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content className={cn('ui-tabs-content', className)} {...props} />
)

export { Tabs, TabsContent, TabsList, TabsTrigger }
