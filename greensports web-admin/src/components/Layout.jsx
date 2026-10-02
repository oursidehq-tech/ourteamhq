import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="admin-layout">
      {mobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setMobileOpen(false)} 
        />
      )}
      <Sidebar 
        isCollapsed={isCollapsed} 
        onToggle={() => setIsCollapsed(!isCollapsed)} 
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div 
        className={`content-wrapper ${isCollapsed ? 'is-collapsed' : ''}`}
      >
        <TopBar onToggleSidebar={() => setMobileOpen(prev => !prev)} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
