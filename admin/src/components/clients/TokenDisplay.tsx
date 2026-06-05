import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TokenDisplayProps { token: string }

export default function TokenDisplay({ token }: TokenDisplayProps) {
  const [copied, setCopied] = useState(false)
  const masked = token.slice(0, 8) + '••••••••' + token.slice(-4)

  function copy() {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1.5">
      <code className="text-xs text-muted-foreground font-mono">{masked}</code>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copy}>
        {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
      </Button>
    </div>
  )
}
