import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

const buttonVariants = cva('ui-button', {
  variants: {
    variant: {
      default: 'ui-button-default',
      secondary: 'ui-button-secondary',
      ghost: 'ui-button-ghost',
      danger: 'ui-button-danger',
    },
    size: {
      default: 'ui-button-size-default',
      sm: 'ui-button-size-sm',
      lg: 'ui-button-size-lg',
      icon: 'ui-button-size-icon',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = ({ asChild = false, className, size, variant, ...props }: IButtonProps) => {
  const Comp = asChild ? Slot : 'button'

  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
