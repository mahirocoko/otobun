import type { InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface IInputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = ({ className, ...props }: IInputProps) => {
  return <input className={cn('ui-input', className)} {...props} />
}

export { Input }
