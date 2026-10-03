import { useEffect, useState, useRef } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { storageService } from '../services/storageService';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import ImageModal from '../components/ImageModal';
import { Search, Plus, Edit2, Trash2, Image as ImageIcon, Upload, Globe, Lock, Info, Ruler, Eye, X } from 'lucide-react';

export default function ProductsPage() {
  const { selectedClubId } = useClub();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [imageModal, setImageModal] = useState({ open: false, url: '', title: '' });
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Uploading state & live progress
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingSizeGuide, setUploadingSizeGuide] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ product: 0, sizeguide: 0 });
  const cancelTokens = useRef({ product: null, sizeguide: null });

  const col = () => collection(db, 'clubs', selectedClubId, 'products');

  const fetchProducts = async () => {
    if (!selectedClubId) return;
    try {
      const q = query(col(), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const snap = await getDocs(col());
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    }
  };

  useEffect(() => { fetchProducts(); }, [selectedClubId]);

  const filtered = products.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const parseVariants = (rawInput, fallbackStock = -1) => {
    const tokens = (rawInput || '')
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return [{ label: "One Size", stock: fallbackStock }];
    }

    return tokens
      .map((token) => {
        const [labelPart, stockPart] = token.split(":");
        const label = (labelPart || "").trim();
        const parsedStock = parseInt((stockPart || "").trim(), 10);
        const variantStock = Number.isFinite(parsedStock) ? parsedStock : fallbackStock;
        return {
          label,
          stock: variantStock,
        };
      })
      .filter((variant) => !!variant.label);
  };

  const stringifyVariants = (variantsArray) => {
    if (!Array.isArray(variantsArray) || variantsArray.length === 0) return '';
    return variantsArray
      .map(v => `${v.label}${v.stock !== -1 ? `:${v.stock}` : ''}`)
      .join(', ');
  };

  const openAdd = () => { 
    setForm({ 
      name: '', 
      description: '', 
      price: '', 
      category: 'Apparel', 
      inStock: true,
      active: true,
      visibility: 'public',
      imageUrl: '',
      sizeGuideUrl: '',
      rawVariants: ''
    }); 
    setModal('add'); 
  };

  const openEdit = (p) => { 
    setForm({ 
      name: p.name || '', 
      description: p.description || '', 
      price: String(p.price || ''), 
      category: p.category || 'Apparel', 
      inStock: p.inStock !== false,
      active: p.active !== false,
      visibility: p.visibility || 'public',
      imageUrl: p.imageUrl || '',
      sizeGuideUrl: p.sizeGuideUrl || '',
      rawVariants: stringifyVariants(p.variants)
    }); 
    setModal(p); 
  };

  const handleCancelUpload = (type) => {
    if (cancelTokens.current[type]) {
      cancelTokens.current[type]();
      cancelTokens.current[type] = null;
    }
    if (type === 'product') {
      setUploadingImage(false);
      setUploadProgress(prev => ({ ...prev, product: 0 }));
    } else {
      setUploadingSizeGuide(false);
      setUploadProgress(prev => ({ ...prev, sizeguide: 0 }));
    }
  };

  const handleImageUpload = async (e, type = 'product') => {
    const file = e.target.files[0];
    if (!file || !selectedClubId) return;

    if (type === 'product') {
      setUploadingImage(true);
      setUploadProgress(prev => ({ ...prev, product: 5 }));
    } else {
      setUploadingSizeGuide(true);
      setUploadProgress(prev => ({ ...prev, sizeguide: 5 }));
    }

    try {
      const folder = type === 'product' ? 'products' : 'sizeguides';
      const prefix = type === 'product' ? 'prod_' : 'guide_';
      
      const res = await storageService.uploadFileWithProgress(
        file,
        `clubs/${selectedClubId}/${folder}/${prefix}`,
        {
          onProgress: (pct) => {
            setUploadProgress(prev => ({ ...prev, [type]: pct }));
          },
          setCancelHandler: (abortFn) => {
            cancelTokens.current[type] = abortFn;
          }
        }
      );
      
      const url = res.url;
      if (type === 'product') {
        setForm(prev => ({ ...prev, imageUrl: url }));
      } else {
        setForm(prev => ({ ...prev, sizeGuideUrl: url }));
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert('Upload failed: ' + err.message);
      }
    } finally {
      if (type === 'product') setUploadingImage(false);
      else setUploadingSizeGuide(false);
      cancelTokens.current[type] = null;
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return alert('Product name is required');
    setSaving(true);
    
    // Parse variants to save matching App logic
    const parsedVariants = parseVariants(form.rawVariants, form.inStock ? -1 : 0);

    const data = { 
      name: form.name.trim(),
      description: form.description || '',
      category: form.category || 'Apparel',
      price: parseFloat(form.price) || 0,
      inStock: !!form.inStock,
      active: !!form.active,
      visibility: form.visibility || 'public',
      imageUrl: form.imageUrl || '',
      sizeGuideUrl: form.sizeGuideUrl || '',
      variants: parsedVariants,
      updatedAt: serverTimestamp() 
    };

    try {
      if (modal === 'add') {
        const ref = doc(col());
        await setDoc(ref, { 
          ...data, 
          createdBy: 'admin', 
          createdAt: serverTimestamp() 
        });
      } else {
        await updateDoc(doc(db, 'clubs', selectedClubId, 'products', modal.id), data);
      }
      await fetchProducts();
      setModal(null);
    } catch (err) { 
      alert(err.message); 
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'clubs', selectedClubId, 'products', p.id));
      await fetchProducts();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Shop Inventory</h2>
          <p className="text-muted">Manage club products, inventory levels, sizing charts, and merchandise</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Product</button>
      </div>

      <div className="table-controls">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search products by title, category, description..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <span className="text-muted text-sm">{filtered.length} Product{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>Image</th>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Sizing / Variants</th>
              <th>Visibility</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No products found</td></tr>
            ) : filtered.map(p => (
              <tr 
                key={p.id} 
                className="clickable-row"
                onClick={(e) => {
                  if (!e.target.closest('button') && !e.target.closest('.product-thumb-clickable')) {
                    setViewingProduct(p);
                  }
                }}
              >
                <td>
                  <div 
                    className="product-thumb product-thumb-clickable" 
                    title={p.imageUrl ? "Click to view full image" : "No image"}
                    onClick={(e) => {
                      if (p.imageUrl) {
                        e.stopPropagation();
                        setImageModal({ open: true, url: p.imageUrl, title: p.name });
                      }
                    }}
                    style={{ cursor: p.imageUrl ? 'pointer' : 'default', position: 'relative' }}
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} />
                    ) : (
                      <ImageIcon size={20} className="text-muted" />
                    )}
                  </div>
                </td>
                <td>
                  <strong>{p.name}</strong>
                  {!p.active && <span className="badge badge-danger ml-sm" style={{ fontSize: 10 }}>Hidden</span>}
                  {p.sizeGuideUrl && (
                    <span 
                      className="ml-sm cursor-pointer" 
                      style={{ color: 'var(--primary)' }} 
                      title="Click to view Size Guide"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageModal({ open: true, url: p.sizeGuideUrl, title: `${p.name} - Size Guide` });
                      }}
                    >
                      <Ruler size={12} style={{ display: 'inline' }} />
                    </span>
                  )}
                </td>
                <td>{p.category || '—'}</td>
                <td>${(p.price || 0).toFixed(2)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: '220px' }}>
                    {Array.isArray(p.variants) && p.variants.length > 0 ? (
                      p.variants.map((v, i) => (
                        <span key={i} className="badge badge-default" style={{ fontSize: '11px', padding: '2px 6px' }}>
                          {v.label} {v.stock !== -1 ? `(${v.stock})` : ''}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`badge ${p.visibility === 'public' ? 'badge-info' : 'badge-default'}`}>
                    {p.visibility === 'public' ? <Globe size={10} className="mr-xs" /> : <Lock size={10} className="mr-xs" />}
                    {p.visibility || 'public'}
                  </span>
                </td>
                <td><span className={`badge ${p.inStock !== false ? 'badge-success' : 'badge-danger'}`}>{p.inStock !== false ? 'In Stock' : 'Out of Stock'}</span></td>
                <td>
                  <div className="flex gap-sm">
                    {p.imageUrl && (
                      <button 
                        className="btn-icon" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setImageModal({ open: true, url: p.imageUrl, title: p.name }); 
                        }} 
                        title="View Full Image"
                      >
                        <ImageIcon size={15} />
                      </button>
                    )}
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setViewingProduct(p); }} title="View Product Details"><Eye size={15} /></button>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); openEdit(p); }} title="Edit Product"><Edit2 size={15} /></button>
                    <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); handleDelete(p); }} title="Delete Product"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit / Add Modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Add New Product' : 'Edit Product'} wide={true}>
        <div className="product-modal-grid">
          
          {/* Left Column: Product Details & Images */}
          <div>
            <div className="product-images-grid">
              
              {/* Product Image Uploader */}
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Product Image</label>
                <div className="image-upload-zone" style={{ minHeight: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {uploadingImage ? (
                    <div style={{ width: '100%', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
                          Uploading {uploadProgress.product}%
                        </span>
                        <button 
                          type="button" 
                          onClick={() => handleCancelUpload('product')}
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ✕ Cancel
                        </button>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${uploadProgress.product}%`, 
                            height: '100%', 
                            background: 'linear-gradient(90deg, #10b981, #059669)',
                            transition: 'width 0.15s ease-out'
                          }} 
                        />
                      </div>
                    </div>
                  ) : form.imageUrl ? (
                    <div className="image-preview" style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={form.imageUrl} alt="Preview" style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain' }} />
                      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                        <button 
                          type="button"
                          className="btn-icon"
                          style={{ background: 'rgba(15,23,42,0.75)', color: '#fff', padding: 5, borderRadius: 6, border: 'none', cursor: 'pointer' }}
                          title="View Full Size"
                          onClick={() => setImageModal({ open: true, url: form.imageUrl, title: form.name || 'Product Image' })}
                        >
                          <Eye size={13} />
                        </button>
                        <button 
                          type="button"
                          className="btn-remove" 
                          title="Remove"
                          onClick={() => setForm({ ...form, imageUrl: '' })}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="upload-placeholder" style={{ cursor: 'pointer', padding: '16px' }}>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'product')} hidden />
                      <div className="flex-column align-center">
                        <Upload size={20} className="mb-xs" style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Upload Image</span>
                        <span className="text-muted" style={{ fontSize: '10px' }}>PNG, JPG, WEBP</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Size Guide Image Uploader */}
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Size Guide Image</label>
                <div className="image-upload-zone" style={{ minHeight: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {uploadingSizeGuide ? (
                    <div style={{ width: '100%', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
                          Uploading {uploadProgress.sizeguide}%
                        </span>
                        <button 
                          type="button" 
                          onClick={() => handleCancelUpload('sizeguide')}
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ✕ Cancel
                        </button>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${uploadProgress.sizeguide}%`, 
                            height: '100%', 
                            background: 'linear-gradient(90deg, #10b981, #059669)',
                            transition: 'width 0.15s ease-out'
                          }} 
                        />
                      </div>
                    </div>
                  ) : form.sizeGuideUrl ? (
                    <div className="image-preview" style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={form.sizeGuideUrl} alt="Size Guide Preview" style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain' }} />
                      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                        <button 
                          type="button"
                          className="btn-icon"
                          style={{ background: 'rgba(15,23,42,0.75)', color: '#fff', padding: 5, borderRadius: 6, border: 'none', cursor: 'pointer' }}
                          title="View Full Size"
                          onClick={() => setImageModal({ open: true, url: form.sizeGuideUrl, title: `${form.name || 'Product'} - Size Guide` })}
                        >
                          <Eye size={13} />
                        </button>
                        <button 
                          type="button"
                          className="btn-remove" 
                          title="Remove"
                          onClick={() => setForm({ ...form, sizeGuideUrl: '' })}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="upload-placeholder" style={{ cursor: 'pointer', padding: '16px' }}>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'sizeguide')} hidden />
                      <div className="flex-column align-center">
                        <Upload size={20} className="mb-xs" style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Upload Size Guide</span>
                        <span className="text-muted" style={{ fontSize: '10px' }}>Optional chart</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Product Name</label>
              <input className="form-control" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Official Match Jersey" required />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Price ($)</label>
                <input className="form-control" type="number" step="0.01" value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option>Apparel</option>
                  <option>Equipment</option>
                  <option>Accessories</option>
                  <option>Merchandise</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="High quality breathable fabric..." />
            </div>
          </div>

          {/* Right Column: Sizing Variants & Visibility Settings */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: 12 }}>Sizing &amp; Variants Configuration</h4>
            
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Sizing Variants
                <span title="Enter variants separated by commas or newlines. Example: S:10, M:20, L:15, XL. Stating stock count is optional." style={{ cursor: 'pointer', color: 'var(--primary)' }}>
                  <Info size={14} />
                </span>
              </label>
              <textarea 
                className="form-control" 
                rows={4} 
                value={form.rawVariants || ''} 
                onChange={e => setForm({ ...form, rawVariants: e.target.value })}
                placeholder="e.g. S:10, M:20, L:15, XL:5 or&#10;One Size:50"
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
              <p className="text-muted text-sm" style={{ marginTop: 4 }}>
                Format: <code>VariantLabel:StockCount</code>. Separate multiple variants with commas or newlines.
              </p>
            </div>

            <div className="form-row" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>Visibility</label>
                <select className="form-control" value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}>
                  <option value="public">Public (Everyone)</option>
                  <option value="private">Club Only</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={form.active !== false} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={form.inStock !== false} onChange={e => setForm({ ...form, inStock: e.target.checked })} /> In Stock
                </label>
              </div>
            </div>

            <div style={{ marginTop: 48, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || uploadingImage || uploadingSizeGuide}>
                {saving ? 'Saving…' : modal === 'add' ? 'Add Product' : 'Save Changes'}
              </button>
            </div>
          </div>

        </div>
      </Modal>

      {/* View Product Modal */}
      <Modal open={!!viewingProduct} onClose={() => setViewingProduct(null)} title="Product Details">
        {viewingProduct && (
          <div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div 
                style={{ 
                  width: 140, 
                  height: 140, 
                  borderRadius: 12, 
                  border: '1px solid var(--border)', 
                  background: '#F8FAFC', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  overflow: 'hidden',
                  cursor: viewingProduct.imageUrl ? 'pointer' : 'default',
                  position: 'relative'
                }}
                onClick={() => {
                  if (viewingProduct.imageUrl) {
                    setImageModal({ open: true, url: viewingProduct.imageUrl, title: viewingProduct.name });
                  }
                }}
                title={viewingProduct.imageUrl ? "Click to view full image" : ""}
              >
                {viewingProduct.imageUrl ? (
                  <>
                    <img src={viewingProduct.imageUrl} alt={viewingProduct.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(15,23,42,0.7)', color: '#fff', padding: 4, borderRadius: 4, display: 'flex' }}>
                      <Eye size={12} />
                    </div>
                  </>
                ) : (
                  <ImageIcon size={48} className="text-muted" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px 0' }}>{viewingProduct.name}</h3>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>
                  ${(viewingProduct.price || 0).toFixed(2)}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span className="badge badge-info">{viewingProduct.category || 'Apparel'}</span>
                  <span className={`badge ${viewingProduct.inStock !== false ? 'badge-success' : 'badge-danger'}`}>
                    {viewingProduct.inStock !== false ? 'In Stock' : 'Out of Stock'}
                  </span>
                  <span className="badge badge-default">
                    {viewingProduct.visibility || 'public'}
                  </span>
                  {!viewingProduct.active && <span className="badge badge-danger">Hidden</span>}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                  {viewingProduct.description || 'No description provided.'}
                </p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Sizing &amp; Stock Availability</h4>
              {Array.isArray(viewingProduct.variants) && viewingProduct.variants.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                  {viewingProduct.variants.map((v, i) => (
                    <div key={i} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: '#F8FAFC' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{v.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Stock: {v.stock === -1 ? 'Unlimited' : v.stock}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">One Size / Standard stock</p>
              )}
            </div>

            {viewingProduct.sizeGuideUrl && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                    <Ruler size={16} /> Size Guide
                  </h4>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline" 
                    onClick={() => setImageModal({ open: true, url: viewingProduct.sizeGuideUrl, title: `${viewingProduct.name} - Size Guide` })}
                  >
                    <Eye size={12} className="mr-xs" /> View Full
                  </button>
                </div>
                <div 
                  style={{ maxHeight: 220, overflow: 'auto', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => setImageModal({ open: true, url: viewingProduct.sizeGuideUrl, title: `${viewingProduct.name} - Size Guide` })}
                >
                  <img src={viewingProduct.sizeGuideUrl} alt="Size Guide" style={{ width: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setViewingProduct(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { const p = viewingProduct; setViewingProduct(null); openEdit(p); }}>
                <Edit2 size={14} className="mr-xs" /> Edit Product
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Global Image Lightbox Modal */}
      <ImageModal 
        isOpen={imageModal.open}
        imageUrl={imageModal.url}
        title={imageModal.title}
        onClose={() => setImageModal({ open: false, url: '', title: '' })}
      />
    </div>
  );
}
