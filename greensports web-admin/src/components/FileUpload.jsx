import React, { useState, useRef } from 'react';

/**
 * A production-ready file upload component with drag-and-drop support.
 * Optimized for bulk CSV uploads and media assets.
 */
const FileUpload = ({ 
  onUpload, 
  accept = ".csv, .xlsx, .xls", 
  title = "Drop files here or click to upload",
  subtitle = "Supported formats: CSV, Excel",
  maxSize = 10, // MB
  loading = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files[0]);
    }
  };

  const handleFiles = (file) => {
    setError(null);
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > maxSize) {
      setError(`File size exceeds ${maxSize}MB limit.`);
      return;
    }

    if (onUpload) {
      onUpload(file);
    }
  };

  return (
    <div className="file-upload-wrapper">
      <div 
        className={`image-upload-zone ${dragActive ? 'active' : ''} ${error ? 'error' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        style={{ cursor: 'pointer', padding: '40px' }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden-input"
          accept={accept}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        
        <div className="upload-placeholder">
          <div className="sm-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)', marginBottom: '16px', width: '64px', height: '64px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{title}</h4>
          <p className="text-muted text-sm">{subtitle}</p>
          {loading && <div className="mt-md"><span className="badge badge-info">Processing...</span></div>}
          {error && <div className="mt-md"><span className="badge badge-danger">{error}</span></div>}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
