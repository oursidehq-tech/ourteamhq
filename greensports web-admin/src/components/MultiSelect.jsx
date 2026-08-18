import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export default function MultiSelect({
  options = [],
  selectedValues = [],
  onChange,
  placeholder = 'Select options...',
  labelKey = 'name',
  valueKey = 'id'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleSelect = (val) => {
    const isSelected = selectedValues.includes(val);
    const newSelection = isSelected
      ? selectedValues.filter(v => v !== val)
      : [...selectedValues, val];
    onChange(newSelection);
  };

  const handleSelectAll = () => {
    const filteredOptions = options.filter(opt =>
      !opt.isHeader && String(opt[labelKey] || '').toLowerCase().includes(search.toLowerCase())
    );
    const filteredVals = filteredOptions.map(opt => opt[valueKey]);
    
    // Add all filtered values that aren't already selected
    const uniqueNew = Array.from(new Set([...selectedValues, ...filteredVals]));
    onChange(uniqueNew);
  };

  const handleDeselectAll = () => {
    const filteredOptions = options.filter(opt =>
      !opt.isHeader && String(opt[labelKey] || '').toLowerCase().includes(search.toLowerCase())
    );
    const filteredVals = filteredOptions.map(opt => opt[valueKey]);
    
    // Remove all filtered values
    const newSelection = selectedValues.filter(v => !filteredVals.includes(v));
    onChange(newSelection);
  };

  const filteredOptions = options.filter(opt => {
    if (opt.isHeader) return true; // Always keep headers, or we could filter them out if no children match. For simplicity, keep them if searching is empty or let user scroll. Actually, better:
    return String(opt[labelKey] || '').toLowerCase().includes(search.toLowerCase());
  });

  // Remove empty headers (optional optimization)
  const displayOptions = filteredOptions.filter((opt, index, arr) => {
    if (!opt.isHeader) return true;
    // Check if next item is also a header or it's the last item
    const nextOpt = arr[index + 1];
    if (!nextOpt || nextOpt.isHeader) return false;
    return true;
  });

  // Render trigger button text
  const selectedObjects = options.filter(opt => selectedValues.includes(opt[valueKey]));
  const getButtonText = () => {
    if (selectedObjects.length === 0) return placeholder;
    if (selectedObjects.length <= 3) {
      return selectedObjects.map(o => o[labelKey]).join(', ');
    }
    return `${selectedObjects.length} selected`;
  };

  return (
    <div className="multiselect-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #E5E5EA)',
          borderRadius: 'var(--radius-sm, 12px)',
          cursor: 'pointer',
          minHeight: '42px',
          userSelect: 'none',
          fontSize: '14px',
          color: selectedObjects.length === 0 ? 'var(--text-secondary, #8E8E93)' : 'var(--text, #1C1C1E)'
        }}
      >
        <span style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginRight: '8px',
          maxWidth: 'calc(100% - 24px)'
        }}>
          {getButtonText()}
        </span>
        <ChevronDown size={16} style={{
          color: 'var(--text-secondary, #8E8E93)',
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
          flexShrink: 0
        }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #E5E5EA)',
          borderRadius: 'var(--radius-sm, 12px)',
          boxShadow: 'var(--shadow-lg, 0 12px 24px rgba(0,0,0,0.08))',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '300px'
        }}>
          {/* Search Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 10px',
            background: 'var(--bg, #F9F9F9)',
            border: '1px solid var(--border, #E5E5EA)',
            borderRadius: '8px',
            gap: '8px'
          }}>
            <Search size={14} style={{ color: 'var(--text-secondary, #8E8E93)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '13px',
                color: 'var(--text)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {search && (
              <X
                size={14}
                style={{ color: 'var(--text-secondary, #8E8E93)', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch('');
                }}
              />
            )}
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--primary)',
            padding: '0 4px',
            fontWeight: 600
          }}>
            <span style={{ cursor: 'pointer' }} onClick={handleSelectAll}>Select All</span>
            <span style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={handleDeselectAll}>Clear Filtered</span>
          </div>

          {/* Options list */}
          <div style={{
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            {displayOptions.length === 0 ? (
              <div style={{
                padding: '12px 10px',
                textAlign: 'center',
                color: 'var(--text-lighter, #AEAEB2)',
                fontSize: '13px'
              }}>
                No options found
              </div>
            ) : (
              displayOptions.map((opt, i) => {
                if (opt.isHeader) {
                  return (
                    <div key={`header-${i}`} style={{
                      padding: '10px 8px 4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-secondary)',
                      marginTop: i > 0 ? '8px' : '0'
                    }}>
                      {opt[labelKey]}
                    </div>
                  );
                }

                const isSel = selectedValues.includes(opt[valueKey]);
                return (
                  <div
                    key={opt[valueKey]}
                    onClick={() => handleSelect(opt[valueKey])}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      background: isSel ? 'var(--primary-light, #E6F4ED)' : 'transparent',
                      color: isSel ? 'var(--primary, #108B51)' : 'var(--text, #1C1C1E)',
                      fontWeight: isSel ? 600 : 400,
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isSel ? 'var(--primary, #108B51)' : 'var(--surface, #fff)',
                      borderColor: isSel ? 'var(--primary, #108B51)' : 'var(--border, #E5E5EA)',
                      flexShrink: 0
                    }}>
                      {isSel && <Check size={12} color="#fff" />}
                    </div>
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {opt[labelKey]}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
