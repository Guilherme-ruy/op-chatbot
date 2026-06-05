import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  message: string
  confirmLabel?: string
  color?: 'error' | 'success'
  loading?: boolean
  onConfirm: () => void
}

export default function ConfirmDialog({
  open, onOpenChange, title, message, confirmLabel = 'Confirmar',
  color = 'error', loading = false, onConfirm,
}: ConfirmDialogProps) {
  const [input, setInput] = useState('')
  const confirmed = input.trim().toLowerCase() === 'sim'

  // Limpa o campo sempre que o dialog fechar, independente do estado de loading
  useEffect(() => {
    if (!open) setInput('')
  }, [open])

  function handleOpenChange(v: boolean) {
    if (!loading) onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className={`flex items-center gap-3 ${color === 'error' ? 'text-destructive' : 'text-green-600'}`}>
            <AlertTriangle size={20} />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1">{message}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-sm">
            Digite <strong>SIM</strong> para confirmar:
          </Label>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="SIM"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && confirmed && !loading && onConfirm()}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={loading} onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!confirmed || loading}
            className={color === 'error' ? 'bg-destructive hover:bg-destructive/90 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
          >
            {loading ? 'Aguarde...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
