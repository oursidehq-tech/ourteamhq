import React, { useState, useRef } from 'react';
import { Upload, X, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { storageService } from '../services/storageService';
import ImageModal from './ImageModal';

/**
 * Enhanced production-ready FileUpload component:
 * - Live percentage upload tracking (0% -> 100%)
 * - In-flight cancel upload button
 * - Instant full-screen image preview lightbox
 * - Drag-and-drop & file picker support
 * - Cloudinary & Firebase resilience
 */
const FileUpload = ({ 
  onUpload, 
  onUploadComplete,
  onFileUploaded,
  storagePath = 'uploads/',
  accept = "image/*, .csv, .xlsx, .pdf, application/pdf", 
  title = "Drop files here or click to upload",
  subtitle = "Supported formats: Images, CSV, Excel, PDF (up to 10MB)",
  maxSize = 10, // MB
  maxSizeMB,
  value = null, // Existing file URL if any
  autoUpload = true // Default to true so files are uploaded and URL is emitted
}) => {
  const effectiveMaxSize = maxSizeMB || maxSize || 10;
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(value || null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const cancelTokenRef = useRef(null);

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

  const handleCancelUpload = (e) => {
    e?.stopPropagation();
    if (cancelTokenRef.current) {
      cancelTokenRef.current();
      cancelTokenRef.current = null;
    }
    setIsUploading(false);
    setUploadPercent(0);
    setError('Upload cancelled by user.');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFiles = async (file) => {
    setError(null);
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > effectiveMaxSize) {
      setError(`File size (${fileSizeMB.toFixed(1)}MB) exceeds ${effectiveMaxSize}MB limit.`);
      return;
    }

    // Generate local preview if image
    if (file.type.startsWith('image/')) {
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);
    }

    if (autoUpload) {
      setIsUploading(true);
      setUploadPercent(0);
      try {
        const res = await storageService.uploadFileWithProgress(file, storagePath, {
          onProgress: (pct) => setUploadPercent(pct),
          setCancelHandler: (abortFn) => { cancelTokenRef.current = abortFn; }
        });
        setPreviewUrl(res.url);
        setIsUploading(false);
        setUploadPercent(100);
        if (onUploadComplete) onUploadComplete(res.url, res);
        if (onFileUploaded) onFileUploaded(res.url, res);
      } catch (err) {
        if (err.name === 'AbortError') {
          setError('Upload cancelled.');
        } else {
          setError(err.message || 'Upload failed');
        }
        setIsUploading(false);
        setUploadPercent(0);
      }
    } else if (onUpload) {
      onUpload(file, {
        setUploadPercent,
        setIsUploading,
        setCancelHandler: (abortFn) => { cancelTokenRef.current = abortFn; },
        setPreviewUrl
      });
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setUploadPercent(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (onUploadComplete) onUploadComplete('');
    if (onFileUploaded) onFileUploaded('');
  };

  return (
    <div className="file-upload-wrapper" style={{ width: '100%' }}>
      <div 
        className={`image-upload-zone ${dragActive ? 'active' : ''} ${error ? 'error' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        style={{ 
          cursor: isUploading ? 'default' : 'pointer', 
          padding: '24px 16px',
          border: '2px dashed var(--border)',
          borderRadius: '12px',
          background: dragActive ? 'rgba(16, 185, 129, 0.05)' : '#F8FAFC',
          textAlign: 'center',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden-input"
          accept={accept}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          className="hidden-input"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        
        {/* Upload in progress state */}
        {isUploading ? (
          <div className="upload-progress-box" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Uploading... {uploadPercent}%
              </span>
              <button 
                type="button" 
                onClick={handleCancelUpload}
                style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ✕ Cancel
              </button>
            </div>
            
            {/* Progress Bar Container */}
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${uploadPercent}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                  transition: 'width 0.2s ease-out'
                }} 
              />
            </div>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '6px' }}>Direct secure cloud delivery</p>
          </div>
        ) : previewUrl ? (
          /* Preview state with View and Remove buttons */
          <div className="file-preview-card" onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewUrl.includes('.pdf') || previewUrl.startsWith('data:application/pdf') ? (
                <div style={{ textAlign: 'center', color: '#DC2626' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, background: '#FEE2E2', padding: '2px 5px', borderRadius: '4px', display: 'block', marginBottom: '2px' }}>PDF</span>
                  <span style={{ fontSize: '10px', color: '#64748B' }}>Document</span>
                </div>
              ) : (
                <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                <CheckCircle2 size={14} /> File ready to submit
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a 
                  href={previewUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <Eye size={12} /> View File
                </a>
                <button 
                  type="button" 
                  onClick={handleRemove}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <X size={12} /> Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Default drop placeholder */
          <div className="upload-placeholder">
            <div 
              style={{ 
                background: 'rgba(16, 185, 129, 0.1)', 
                color: 'var(--primary)', 
                margin: '0 auto 10px auto', 
                width: '44px', 
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Upload size={22} />
            </div>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 4px 0' }}>{title}</h4>
            <p className="text-muted" style={{ fontSize: '12px', margin: '0 0 10px 0' }}>{subtitle}</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}
                onClick={() => inputRef.current?.click()}
              >
                Browse File
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}
                onClick={() => cameraInputRef.current?.click()}
              >
                Take Photo / Camera
              </button>
            </div>
            {error && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#ef4444', fontSize: '11px' }}>
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-size Image Preview Modal */}
      <ImageModal 
        isOpen={previewModalOpen}
        imageUrl={previewUrl}
        title={title || 'Uploaded Asset'}
        onClose={() => setPreviewModalOpen(false)}
      />
    </div>
  );
};

export default FileUpload;
