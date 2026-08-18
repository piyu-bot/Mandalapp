import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import {
  LayoutDashboard, FilePlus2, Clock, Wallet, Users, BarChart3, ShieldCheck,
  LogOut, Menu, X, GaneshaIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Main Dashboard', icon: LayoutDashboard, end: true },
  { to: '/new-receipt', label: 'New Add Receipt', icon: FilePlus2, highlight: true },
  { to: '/unpaid', label: 'Unpaid Receipts', icon: Clock },
  { to: '/expenses', label: 'Expense Manager', icon: Wallet },
  { to: '/members', label: 'Member & Performance', icon: Users },
  { to: '/reports', label: 'Financial Reports & CSV', icon: BarChart3 },
  { to: '/audit', label: 'Audit Log & Verification', icon: ShieldCheck },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const location = useLocation();

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of the admin session?',
      confirmText: 'Sign Out',
    });
    if (ok) {
      await signOut();
      toast('Signed out successfully', 'info');
    }
  };

  const currentLabel = navItems.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to) && n.to !== '/'))?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 bg-zinc-900/50 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20">
            <GaneshaIcon className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">अष्टविनायक</p>
            <p className="truncate text-xs text-zinc-400">गणेशोत्सव मंडळ</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  item.highlight
                    ? isActive
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-500/20'
                      : 'bg-gradient-to-r from-orange-600/90 to-amber-600/90 text-white shadow-md shadow-orange-500/10 hover:shadow-orange-500/20'
                    : isActive
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/5 p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-zinc-900/80 backdrop-blur-xl px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600">
            <GaneshaIcon className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">अष्टविनायक मंडळ</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-zinc-300 hover:text-white">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-zinc-900 border-r border-white/10 animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <span className="font-semibold text-white">Navigation</span>
              <button onClick={() => setMobileOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 p-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all',
                      item.highlight
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                        : isActive
                          ? 'bg-white/10 text-white'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:pl-64">
        <div className="hidden lg:block border-b border-white/5 bg-zinc-900/30 px-8 py-4">
          <h2 className="text-lg font-semibold text-white">{currentLabel}</h2>
        </div>
        <main className="p-4 lg:p-8 animate-fade-in">{children}</main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-white/5 bg-zinc-900/90 backdrop-blur-xl px-2 py-2 lg:hidden">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors',
                item.highlight && !isActive && 'text-orange-400',
                isActive ? 'text-orange-400' : 'text-zinc-500'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate max-w-[60px]">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
      <div className="h-16 lg:hidden" />
    </div>
  );
}
