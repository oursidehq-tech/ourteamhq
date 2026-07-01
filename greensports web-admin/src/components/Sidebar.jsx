import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import {
  LayoutDashboard, Building2, Users, UsersRound, FileText,
  Calendar, ShoppingBag, ClipboardList, PackageCheck, Wrench,
  Bell, Settings, LogOut, ListChecks, Shield, Crown, BarChart3,
  Trophy, BookOpen, DollarSign, Award, ShieldCheck, ChevronLeft, ChevronRight
} from 'lucide-react';

// Navigation sections for Administrators
const adminSections = [
  {
    title: 'Platform',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/reports', icon: BarChart3, label: 'Reports' },
      { to: '/finance', icon: DollarSign, label: 'Finance', roles: ['Owner', 'Admin', 'Registrar'] },
      { to: '/clubs', icon: Building2, label: 'Clubs' },
      { to: '/users', icon: Shield, label: 'Users', superOnly: true },
    ]
  },
  {
    title: 'League & Performance',
    items: [
      { to: '/league-platform', icon: Trophy, label: 'League Platform', roles: ['Owner', 'Admin', 'Manager', 'Coach'] },
      { to: '/compliance', icon: ShieldCheck, label: 'Compliance', roles: ['Owner', 'Admin', 'Registrar', 'Manager'] },
      { to: '/training-center', icon: BookOpen, label: 'Training Center', roles: ['Owner', 'Admin', 'Coach', 'Manager'] },
      { to: '/bookings', icon: Calendar, label: 'Bookings', roles: ['Owner', 'Admin', 'Manager', 'Coach'] },
    ]
  },
  {
    title: 'Management',
    items: [
      { to: '/members', icon: Users, label: 'Members', roles: ['Owner', 'Admin', 'Registrar'] },
      { to: '/teams', icon: UsersRound, label: 'Teams', roles: ['Owner', 'Admin', 'Manager', 'Coach'] },
      { to: '/groups', icon: UsersRound, label: 'Groups' },
      { to: '/posts', icon: FileText, label: 'Posts' },
      { to: '/events', icon: Calendar, label: 'Events' },
      { to: '/notifications', icon: Bell, label: 'Notifications' },
    ]
  },
  {
    title: 'Commerce & Ops',
    items: [
      { to: '/products', icon: ShoppingBag, label: 'Shop', roles: ['Owner', 'Admin', 'Shop Manager'] },
      { to: '/orders', icon: PackageCheck, label: 'Orders', roles: ['Owner', 'Admin', 'Shop Manager'] },
      { to: '/tasks', icon: ListChecks, label: 'Tasks' },
      { to: '/rosters', icon: ClipboardList, label: 'Rosters' },
      { to: '/trades', icon: Wrench, label: 'Trades' },
      { to: '/sponsors', icon: Award, label: 'Sponsors', roles: ['Owner', 'Admin'] },
    ]
  },
  {
    title: 'System',
    items: [
      { to: '/audit-logs', icon: FileText, label: 'Audit Logs', roles: ['Owner', 'Admin'] },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ]
  }
];

// Navigation sections for Members / Normal Users (User Space)
const userSections = [
  {
    title: 'Club Portal',
    items: [
      { to: '/', icon: FileText, label: 'Feed & Updates' },
      { to: '/user-teams', icon: UsersRound, label: 'My Teams' },
      { to: '/user-groups', icon: Users, label: 'My Groups' },
      { to: '/user-calendar', icon: Calendar, label: 'Calendar & Duties' },
    ]
  },
  {
    title: 'Club Merchandise',
    items: [
      { to: '/user-shop', icon: ShoppingBag, label: 'Club Store' },
      { to: '/my-orders', icon: PackageCheck, label: 'My Orders' },
    ]
  },
  {
    title: 'My Operations',
    items: [
      { to: '/user-tasks', icon: ListChecks, label: 'Duties & Shifts' },
      { to: '/user-training', icon: BookOpen, label: 'Drills & Plans' },
    ]
  },
  {
    title: 'My Account',
    items: [
      { to: '/user-profile', icon: Settings, label: 'Profile & Settings' },
      { to: '/club-info', icon: Building2, label: 'Club Information' },
    ]
  }
];

export default function Sidebar({ isCollapsed, onToggle }) {
  const { logout, isOwnerOf, hasRole, profile, isSuperAdmin, portalMode, setPortalMode, adminClubIds } = useAuth();
  const { selectedClubId } = useClub();
  const navigate = useNavigate();
  const isOwner = selectedClubId ? isOwnerOf(selectedClubId) : false;

  const activeMembership = profile?.clubMemberships?.find(m => m.clubId === selectedClubId);
  const activeRole = isSuperAdmin 
    ? 'Super Admin' 
    : (activeMembership ? (activeMembership.roles ? activeMembership.roles.join(', ') : activeMembership.role) : 'Club Member');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeSections = portalMode === 'admin' ? adminSections : userSections;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="sidebar-toggle" onClick={onToggle}>
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="sidebar-brand">
        <img src="/icon.png" alt="OurSideHQ logo" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
        <span>OurSideHQ</span>
      </div>

      {/* Mode Toggle Button for Admins & Super Admins */}
      {(adminClubIds.length > 0 || isSuperAdmin) && (
        <div style={{ padding: isCollapsed ? '0 8px 12px 8px' : '0 16px 12px 16px' }}>
          <button
            onClick={() => {
              const target = portalMode === 'admin' ? 'user' : 'admin';
              setPortalMode(target);
              navigate('/');
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              background: 'rgba(16, 185, 129, 0.08)',
              color: 'var(--primary)',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxSizing: 'border-box'
            }}
          >
            <Crown size={14} style={{ flexShrink: 0 }} />
            {!isCollapsed && (portalMode === 'admin' ? 'Switch to User Space' : 'Switch to Admin Panel')}
          </button>
        </div>
      )}

      {!isCollapsed && profile && (
        <div className="sidebar-user">
          <div className="sidebar-user-name">{profile.displayName || 'Platform Admin'}</div>
          <div className="sidebar-user-role">
            <Crown size={12} className="text-primary" fill="var(--primary)" fillOpacity={0.2} style={{ marginRight: 4 }} />
            <span>{activeRole}</span>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {activeSections.map(section => {
          const visibleItems = section.items.filter(item => {
            if (item.superOnly && !isSuperAdmin) return false;
            if (item.roles && !hasRole(selectedClubId, item.roles)) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;
          
          return (
            <div key={section.title} className="sidebar-section">
              <div className="sidebar-section-title">{section.title}</div>
              {visibleItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  title={isCollapsed ? label : ''}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <Icon size={18} />
                  {!isCollapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <button className="sidebar-logout" onClick={handleLogout} title={isCollapsed ? "Sign Out" : ""}>
        <LogOut size={18} />
        {!isCollapsed && <span>Sign Out</span>}
      </button>
    </aside>
  );
}
