import { useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { storageService } from '../services/storageService';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import { Search, Plus, Edit2, Trash2, Image as ImageIcon, Upload, Globe, Lock, Info, Ruler } from 'lucide-react';

export default function ProductsPage() {
  const { selectedClubId } = useClub();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingSizeGuide, setUploadingSizeGuide] = useState(false);

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

  const handleImageUpload = async (e, type = 'product') => {
    const file = e.target.files[0];
    if (!file || !selectedClubId) return;

    if (type === 'product') setUploadingImage(true);
    else setUploadingSizeGuide(true);

    try {
      const folder = type === 'product' ? 'products' : 'sizeguides';
      const prefix = type === 'product' ? 'prod_' : 'guide_';
      const storageRef = ref(storage, `clubs/${selectedClubId}/${folder}/${prefix}${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      if (type === 'product') {
        setForm(prev => ({ ...prev, imageUrl: url }));
      } else {
        setForm(prev => ({ ...prev, sizeGuideUrl: url }));
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      if (type === 'product') setUploadingImage(false);
      else setUploadingSizeGuide(false);
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
      await fetch();
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
      await fetch();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Shop Inventory</h1><p>Manage club products, sizing variants, and guides</p></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />Add Product</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} Product{filtered.length !== 1 ? 's' : ''}</h3>
          <div className="search-box"><Search size={16} /><input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Sizing Variants</th>
              <th>Visibility</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No products found</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="product-thumb">
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <ImageIcon size={20} className="text-muted" />}
                  </div>
                </td>
                <td>
                  <strong>{p.name}</strong>
                  {!p.active && <span className="badge badge-danger ml-sm" style={{ fontSize: 10 }}>Hidden</span>}
                  {p.sizeGuideUrl && (
                    <span className="ml-sm" style={{ color: 'var(--primary)' }} title="Has Size Guide">
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
                    <button className="btn-icon" onClick={() => openEdit(p)}><Edit2 size={15} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(p)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Add New Product' : 'Edit Product'} wide={true}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Left Column: Product Details & Images */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Product Image</label>
                <div className="image-upload-zone" style={{ height: '120px' }}>
                  {form.imageUrl ? (
                    <div className="image-preview">
                      <img src={form.imageUrl} alt="Preview" />
                      <button className="btn-remove" onClick={() => setForm({ ...form, imageUrl: '' })}>×</button>
                    </div>
                  ) : (
                    <label className="upload-placeholder">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'product')} hidden />
                      <div className="flex-column align-center">
                        <Upload size={20} className="mb-xs" />
                        <span style={{ fontSize: '12px' }}>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Size Guide Image</label>
                <div className="image-upload-zone" style={{ height: '120px' }}>
                  {form.sizeGuideUrl ? (
                    <div className="image-preview">
                      <img src={form.sizeGuideUrl} alt="Size Guide Preview" />
                      <button className="btn-remove" onClick={() => setForm({ ...form, sizeGuideUrl: '' })}>×</button>
                    </div>
                  ) : (
                    <label className="upload-placeholder">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'sizeguide')} hidden />
                      <div className="flex-column align-center">
                        <Upload size={20} className="mb-xs" />
                        <span style={{ fontSize: '12px' }}>{uploadingSizeGuide ? 'Uploading...' : 'Upload Size Guide'}</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Product Name</label>
              <input className="form-control" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required />
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
              <textarea className="form-control" rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
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
    </div>
  );
}
