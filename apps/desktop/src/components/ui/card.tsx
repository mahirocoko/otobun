import type { HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface ICardProps extends HTMLAttributes<HTMLDivElement> {}

const Card = ({ className, ...props }: ICardProps) => <div className={cn('ui-card', className)} {...props} />
const CardHeader = ({ className, ...props }: ICardProps) => (
  <div className={cn('ui-card-header', className)} {...props} />
)
const CardTitle = ({ className, ...props }: ICardProps) => <h2 className={cn('ui-card-title', className)} {...props} />
const CardDescription = ({ className, ...props }: ICardProps) => (
  <p className={cn('ui-card-description', className)} {...props} />
)
const CardContent = ({ className, ...props }: ICardProps) => (
  <div className={cn('ui-card-content', className)} {...props} />
)
const CardFooter = ({ className, ...props }: ICardProps) => (
  <div className={cn('ui-card-footer', className)} {...props} />
)

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
