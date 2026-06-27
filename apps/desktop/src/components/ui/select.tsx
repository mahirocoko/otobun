import * as SelectPrimitive from '@radix-ui/react-select'
import type { ComponentPropsWithoutRef } from 'react'
import IconCheck from '~icons/lucide/check'
import IconChevronDown from '~icons/lucide/chevron-down'
import { cn } from '../../utils/cn'

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value

const SelectTrigger = ({ children, className, ...props }: ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>) => (
  <SelectPrimitive.Trigger className={cn('ui-select-trigger', className)} {...props}>
    {children}
    <SelectPrimitive.Icon asChild>
      <IconChevronDown className="ui-select-icon" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
)

const SelectContent = ({ className, ...props }: ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content className={cn('ui-select-content', className)} position="popper" {...props}>
      <SelectPrimitive.Viewport className="ui-select-viewport">{props.children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
)

const SelectItem = ({ children, className, ...props }: ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) => (
  <SelectPrimitive.Item className={cn('ui-select-item', className)} {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="ui-select-item-indicator">
      <IconCheck />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
)

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
