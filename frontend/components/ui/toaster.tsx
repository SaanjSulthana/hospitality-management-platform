import { useToast } from "@/components/ui/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle, AlertCircle, Info, XCircle } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variant = (props as any)?.variant as 'success' | 'destructive' | 'default' | undefined
        const Icon =
          variant === 'success' ? CheckCircle :
          variant === 'destructive' ? AlertCircle :
          Info
        const iconClasses =
          variant === 'success' ? 'text-green-600' :
          variant === 'destructive' ? 'text-red-600' :
          'text-blue-600'

        return (
          <Toast key={id} {...props}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <Icon className={`h-5 w-5 ${iconClasses}`} />
              </div>
              <div className="grid gap-1">
                {title && <ToastTitle className="text-base font-semibold">{title}</ToastTitle>}
                {description && (
                  <ToastDescription className="text-sm opacity-90">{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
