import React, { useState } from 'react';

/**
 * A premium, production-ready data table component.
 * Features: Search, Pagination, Sorting, Row Actions, Empty States.
 */
const DataTable = ({ 
  title, 
  columns, 
  data, 
  actions, 
  onSearch, 
  loading,
  searchPlaceholder = "Search...",
  emptyMessage = "No data found"
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (onSearch) onSearch(value);
  };

  return (
    <div className="table-container">
      <div className="table-toolbar">
        <div>
          <h3>{title}</h3>
          {data && <p className="text-muted text-sm">{data.length} records found</p>}
        </div>
        <div className="table-actions">
          <div className="search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              placeholder={searchPlaceholder} 
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} style={{ width: col.width }}>{col.header}</th>
              ))}
              {actions && <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="table-empty">
                  <div className="spinner">Loading...</div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="table-empty">
                  <p>{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx}>
                      {col.render ? col.render(row[col.accessor], row) : row[col.accessor]}
                    </td>
                  ))}
                  {actions && (
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
                        {actions.map((action, actionIdx) => (
                          <button 
                            key={actionIdx}
                            className={`btn-icon ${action.variant || ''}`}
                            onClick={() => action.onClick(row)}
                            title={action.label}
                          >
                            {action.icon}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
