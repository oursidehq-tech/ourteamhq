import { useState, useRef, useEffect } from 'react';
import { useClub } from '../context/ClubContext';
import { Building2, ChevronDown, Check, Shield, Plus, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ClubSelector() {
  const { clubs, selectedClubId, setSelectedClubId } = useClub();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const currentClub = clubs.find(c => c.id === selectedClubId) || clubs[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!clubs || clubs.length === 0) {
    return (
      <div className="club-selector-custom empty">
        <Building2 size={16} className="text-muted" />
        <span className="text-muted text-sm">No Clubs</span>
      </div>
    );
  }

  return (
    <div className="club-selector-wrapper" ref={dropdownRef}>
      {/* Trigger Button */}
      <button 
        type="button"
        className={`club-selector-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="club-trigger-badge">
          {currentClub?.logo ? (
            <img src={currentClub.logo} alt="" className="club-logo-img" />
          ) : (
            <Building2 size={15} />
          )}
        </div>
        <span className="club-trigger-name" title={currentClub?.name || 'Select Club'}>
          {currentClub?.name || 'Select Club'}
        </span>
        <ChevronDown size={14} className={`club-trigger-chevron ${isOpen ? 'rotate' : ''}`} />
      </button>

      {/* Custom Dropdown Menu */}
      {isOpen && (
        <div className="club-dropdown-menu shadow-lg">
          <div className="club-dropdown-header">
            <span className="dropdown-title">Active Organizations</span>
            <span className="dropdown-count">{clubs.length} Club{clubs.length > 1 ? 's' : ''}</span>
          </div>

          <div className="club-dropdown-list" role="listbox">
            {clubs.map((club) => {
              const isSelected = club.id === selectedClubId;
              return (
                <button
                  key={club.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`club-dropdown-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedClubId(club.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="club-item-icon">
                    {club.logo ? (
                      <img src={club.logo} alt="" />
                    ) : (
                      <span>{(club.name || 'C').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="club-item-info">
                    <span className="club-item-name">{club.name}</span>
                    <span className="club-item-sport">{club.sport || 'Sports Club'}</span>
                  </div>
                  {isSelected && (
                    <div className="club-item-check">
                      <Check size={15} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="club-dropdown-footer">
            <button 
              type="button"
              className="club-manage-btn"
              onClick={() => {
                setIsOpen(false);
                navigate('/clubs');
              }}
            >
              <Plus size={14} />
              <span>Manage or Add Clubs</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
