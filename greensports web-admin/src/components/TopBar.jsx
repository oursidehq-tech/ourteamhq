import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, User, Settings, Command, Loader2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { searchService } from '../services/searchService';
import ClubSelector from './ClubSelector';

const TopBar = () => {
  const { profile, isSuperAdmin } = useAuth();
  const { selectedClubId, selectedClub } = useClub();
  const navigate = useNavigate();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2 && selectedClubId) {
        setIsSearching(true);
        try {
          const results = await searchService.globalSearch(selectedClubId, searchTerm);
          setSearchResults(results);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedClubId]);

  const activeMembership = profile?.clubMemberships?.find(m => m.clubId === selectedClubId);
  const activeRole = isSuperAdmin 
    ? 'Super Admin' 
    : (activeMembership ? (activeMembership.roles ? activeMembership.roles.join(', ') : activeMembership.role) : 'Club Member');

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div 
          ref={searchRef}
          className={`global-search ${searchFocused ? 'focused' : ''}`}
        >
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search members, teams, fixtures..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
          />
          {isSearching ? (
            <Loader2 size={14} className="search-loader animate-spin" />
          ) : searchTerm ? (
            <button className="search-clear" onClick={() => setSearchTerm('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={14} />
            </button>
          ) : (
            <div className="search-shortcut">
              <Command size={10} />
              <span>K</span>
            </div>
          )}

          {searchFocused && (searchTerm.length >= 2 || searchResults.length > 0) && (
            <div className="search-dropdown shadow-lg">
              {searchResults.length > 0 ? (
                <div className="search-results">
                  {searchResults.map((result) => (
                    <div 
                      key={`${result.type}-${result.id}`}
                      className="search-result-item"
                      onClick={() => {
                        navigate(result.link);
                        setSearchFocused(false);
                        setSearchTerm('');
                      }}
                    >
                      <div className={`result-icon ${result.type}`}>
                        {result.type === 'member' ? <User size={14} /> : <Command size={14} />}
                      </div>
                      <div className="result-info">
                        <div className="result-title">{result.title}</div>
                        <div className="result-subtitle">{result.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchTerm.length >= 2 && !isSearching ? (
                <div className="search-no-results">
                  No matches found for "{searchTerm}"
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <div className="club-context-info">
          <span className="club-context-label">Active Context</span>
          <ClubSelector />
        </div>

        <div className="topbar-actions">
          <button className="topbar-btn">
            <Bell size={18} />
            <span className="notification-dot"></span>
          </button>
          <button className="topbar-btn" onClick={() => navigate('/settings')}>
            <Settings size={18} />
          </button>

          <div className="user-profile-trigger" onClick={() => navigate('/settings')}>
            <div className="user-avatar">
              {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <User size={18} />}
            </div>
            <div className="user-info">
              <span className="user-name">{profile?.displayName || 'Admin'}</span>
              <span className="user-role">{activeRole}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
