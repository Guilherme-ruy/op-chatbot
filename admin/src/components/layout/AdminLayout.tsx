import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { Building2, Users, MessageSquare, BarChart3, Bot, LogOut, Menu, Settings, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { title: 'Sites',          icon: Building2,     to: '/clients'   },
  { title: 'Leads',          icon: Users,         to: '/leads'     },
  { title: 'Sessões',        icon: MessageSquare, to: '/sessions'  },
  { title: 'Dashboard',      icon: BarChart3,     to: '/dashboard' },
  { title: 'Configurações',  icon: Settings,      to: '/config'    },
  { title: 'E-mail',         icon: Mail,          to: '/smtp'      },
]

export default function AdminLayout() {
  const [open, setOpen] = useState(true)
  const { email, logout } = useAuthStore()
  const navigate = useNavigate()

  const initial = email ? email[0].toUpperCase() : 'A'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col bg-slate-900 text-slate-100 flex-shrink-0 transition-all duration-300',
        open ? 'w-56' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-800">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500 flex-shrink-0">
            <Bot size={16} className="text-white" />
          </div>
          {open && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white leading-tight truncate">Admin Panel</p>
              <p className="text-xs text-slate-400 truncate">Painel de controle</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <item.icon size={17} className="flex-shrink-0" />
              {open && <span className="truncate">{item.title}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 p-3 space-y-1">
          {open && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white font-medium truncate">{email}</p>
                <p className="text-xs text-slate-500">Administrador</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut size={16} className="flex-shrink-0" />
            {open && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b bg-white flex items-center px-5 gap-4 flex-shrink-0 shadow-sm">
          <button
            onClick={() => setOpen(!open)}
            className="text-slate-500 hover:text-slate-900 transition-colors p-1 rounded-md hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
