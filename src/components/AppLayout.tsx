import { ReactNode, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, FolderOpen, Users, ClipboardList,
  LogOut, Menu, X, Moon, Sun, Plus, Bell,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { RoleBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { ReminderToasts } from "@/components/ReminderToasts";
import logo from "@/assets/samsons-logo.png";

interface NavItem { to: string; label: string; icon: any; adminOnly?: boolean; }

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/deals", label: "Deals", icon: FileText },
  { to: "/documents", label: "Documents", icon: FolderOpen },
];
const ADMIN_NAV: NavItem[] = [
  { to: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/admin/audit", label: "Audit Log", icon: ClipboardList, adminOnly: true },
];

export const AppLayout = ({ children, onNewDeal }: { children: ReactNode; onNewDeal?: () => void }) => {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isAdmin = profile?.role === "admin";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const SidebarContent = () => (
    <>
      <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border">
        <img src={logo} alt="Samsons Farms" className="h-11 w-11 object-contain" />
        <div>
          <div className="font-bold text-sidebar-foreground leading-none">SamsonAgri</div>
          <div className="text-xs text-muted-foreground mt-0.5">Land Deal Manager</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all border-l-2 ${
                isActive
                  ? "bg-sidebar-accent text-primary border-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent border-transparent"
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
        {isAdmin && (
          <>
            <div className="my-3 h-px bg-sidebar-border" />
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all border-l-2 ${
                    isActive
                      ? "bg-sidebar-accent text-primary border-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent border-transparent"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>
      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
            {(profile?.full_name || profile?.email || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{profile?.full_name || profile?.email}</div>
            <div className="mt-0.5"><RoleBadge role={profile?.role} /></div>
          </div>
        </div>
        <Button onClick={handleLogout} variant="ghost" size="sm" className="w-full justify-start mt-1 text-muted-foreground">
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-[220px] bg-sidebar border-r border-sidebar-border z-30">
        <SidebarContent />
      </aside>

      {/* Sidebar — mobile overlay */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 w-[260px] bg-sidebar border-r border-sidebar-border z-50 flex flex-col animate-slide-in-right">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="md:ml-[220px] flex flex-col min-h-screen">
        <header className="topbar sticky top-0 z-20 h-14 bg-background/80 backdrop-blur border-b border-border flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-md hover:bg-accent"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="font-semibold text-sm md:hidden">SamsonAgri</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-md hover:bg-accent relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </button>
            <button onClick={toggle} className="p-2 rounded-md hover:bg-accent" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {onNewDeal && location.pathname.startsWith("/deals") && (
              <Button onClick={onNewDeal} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> New Deal
              </Button>
            )}
            {!onNewDeal && (
              <Button onClick={() => navigate("/deals?new=1")} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> New Deal
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <ReminderToasts />
    </div>
  );
};
