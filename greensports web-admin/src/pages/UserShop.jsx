import { useEffect, useState, useMemo } from 'react';
import { collection, doc, getDocs, setDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, ShoppingBag, Eye, X, Plus, Minus, Trash2, CheckCircle2, ChevronRight, Truck, CreditCard, ShieldCheck } from 'lucide-react';
import Modal from '../components/Modal';

export default function UserShop() {
  const { selectedClubId, selectedClub } = useClub();
  const { profile, user } = useAuth();
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem(`cart_${user?.uid}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedSize, setSelectedSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);

  // Checkout Form fields
  const [fullName, setFullName] = useState(profile?.displayName || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [pickup, setPickup] = useState(true); // default local pickup

  const col = () => collection(db, 'clubs', selectedClubId, 'products');

  const fetchProducts = async () => {
    if (!selectedClubId) return;
    try {
      const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')));
      // Filter out products that are set as inactive in products CRUD
      const activeList = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.active !== false);
      setProducts(activeList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedClubId]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`cart_${user.uid}`, JSON.stringify(cart));
    }
  }, [cart, user]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesCat = activeCategory === 'All' || p.category === activeCategory;
      const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [products, activeCategory, search]);

  const addToCart = (product) => {
    const cartItem = {
      productId: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      imageUrl: product.imageUrl,
      size: selectedSize,
      quantity: quantity
    };

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.productId === product.id && item.size === selectedSize);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += quantity;
        return updated;
      }
      return [...prev, cartItem];
    });

    setSelectedProduct(null);
    setQuantity(1);
    setShowCart(true);
  };

  const updateCartQty = (idx, amount) => {
    setCart(prev => {
      const updated = [...prev];
      updated[idx].quantity += amount;
      if (updated[idx].quantity <= 0) {
        updated.splice(idx, 1);
      }
      return updated;
    });
  };

  const removeFromCart = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  const tax = useMemo(() => subtotal * 0.08, [subtotal]); // 8% sales tax
  const shipping = useMemo(() => (pickup ? 0 : 9.99), [pickup]);
  const total = useMemo(() => subtotal + tax + shipping, [subtotal, tax, shipping]);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setCheckoutLoading(true);

    try {
      const orderRef = doc(collection(db, 'clubs', selectedClubId, 'orders'));
      const orderData = {
        userName: fullName,
        userEmail: email,
        phone: phone,
        items: cart,
        subtotal: subtotal,
        shippingCost: shipping,
        total: total,
        status: 'pending',
        paymentStatus: 'paid', // Mark as paid for web orders immediately
        paymentMethod: 'Credit Card (Stripe)',
        shippingAddress: pickup ? 'Local Pickup' : {
          line1: addressLine1,
          city: city,
          zip: zip
        },
        createdAt: serverTimestamp()
      };

      await setDoc(orderRef, orderData);
      
      setSuccessOrder(orderRef.id);
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
    } catch (err) {
      alert('Order placement failed: ' + err.message);
    }
    setCheckoutLoading(false);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Club Merchandise Store</h1>
          <p className="subtitle">Gear up for the season! Browse official training uniforms, kits, bags, and support equipment for {selectedClub?.name}</p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => setShowCart(true)}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ShoppingCart size={18} />
          <span>View Cart</span>
          {cart.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: 'var(--primary)',
              color: '#ffffff',
              fontSize: '11px',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700
            }}>
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Catalog Search & Filtering */}
      <div className="table-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1 }}>
          {['All', 'Apparel', 'Equipment', 'Accessories', 'Merchandise'].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: '12px',
                border: `1px solid ${activeCategory === cat ? 'var(--primary)' : 'var(--border)'}`,
                background: activeCategory === cat ? 'var(--primary)' : '#ffffff',
                color: activeCategory === cat ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="search-box" style={{ width: '280px' }}>
          <input
            type="text"
            placeholder="Search catalog..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ borderRadius: '12px', width: '100%' }}
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="product-catalog-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '24px'
      }}>
        {filtered.length === 0 ? (
          <div className="card text-center" style={{ gridColumn: '1 / -1', padding: '60px', border: '1px solid var(--border)' }}>
            <ShoppingBag size={48} style={{ color: 'var(--text-lighter)', marginBottom: '16px' }} />
            <h3 style={{ margin: 0, color: 'var(--text)' }}>No products available</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>Check back later for new club merchandise and equipment!</p>
          </div>
        ) : filtered.map(product => (
          <div
            key={product.id}
            className="card product-card hover-lift shadow-sm"
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s'
            }}
          >
            {/* Image section */}
            <div style={{
              height: '240px',
              background: '#f8fafc',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid var(--border-light, #f1f5f9)'
            }}>
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <ShoppingBag size={48} style={{ color: 'var(--text-lighter)' }} />
              )}
              {product.inStock === false && (
                <span style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'var(--danger)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px'
                }}>
                  Out of Stock
                </span>
              )}
            </div>

            {/* Content section */}
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  {product.category}
                </span>
                <h4 style={{ margin: '4px 0 8px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                  {product.name}
                </h4>
                <p style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4',
                  margin: '0 0 16px 0',
                  height: '38px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineBreak: 'auto',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2
                }}>
                  {product.description || 'Official GreenSports high quality merchandise.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
                  ${(product.price || 0).toFixed(2)}
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setSelectedProduct(product)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '10px' }}
                >
                  <Eye size={14} /> Quick View
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Product Details Modal */}
      <Modal open={!!selectedProduct} onClose={() => setSelectedProduct(null)} title="Product Details">
        {selectedProduct && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
            {/* Left Image */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '320px'
            }}>
              {selectedProduct.imageUrl ? (
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }} />
              ) : (
                <ShoppingBag size={72} style={{ color: 'var(--text-lighter)' }} />
              )}
            </div>

            {/* Right Details */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>{selectedProduct.category}</span>
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 12px 0', color: 'var(--text)' }}>{selectedProduct.name}</h2>
                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '16px' }}>${(selectedProduct.price || 0).toFixed(2)}</p>
                
                <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 700 }}>Description</h5>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px 0' }}>{selectedProduct.description}</p>

                {/* Size options */}
                <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 700 }}>Select Size</h5>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(sz => (
                    <button
                      key={sz}
                      onClick={() => setSelectedSize(sz)}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        border: `1px solid ${selectedSize === sz ? 'var(--primary)' : 'var(--border)'}`,
                        background: selectedSize === sz ? 'var(--primary)' : 'transparent',
                        color: selectedSize === sz ? '#ffffff' : 'var(--text)',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                {/* Quantity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Quantity</span>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      style={{ border: 'none', background: 'none', padding: '8px 12px', cursor: 'pointer' }}
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{ padding: '0 12px', fontWeight: 600 }}>{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      style={{ border: 'none', background: 'none', padding: '8px 12px', cursor: 'pointer' }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => addToCart(selectedProduct)}
                disabled={selectedProduct.inStock === false}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <ShoppingCart size={18} />
                {selectedProduct.inStock === false ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cart Drawer Modal */}
      <Modal open={showCart} onClose={() => setShowCart(false)} title="Shopping Cart">
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <ShoppingCart size={48} style={{ color: 'var(--text-lighter)', marginBottom: '16px' }} />
            <h4 style={{ margin: 0 }}>Your cart is empty</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>Browse the shop catalog and add items to your cart!</p>
          </div>
        ) : (
          <div>
            {/* Cart Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: '#f8fafc' }}>
                  <div style={{ width: '56px', height: '56px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border-light, #f1f5f9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ShoppingBag size={20} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{item.name}</h5>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Size: {item.size} • ${(item.price || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', background: '#ffffff' }}>
                    <button onClick={() => updateCartQty(idx, -1)} style={{ border: 'none', background: 'none', padding: '4px 8px', cursor: 'pointer' }}><Minus size={10} /></button>
                    <span style={{ padding: '0 6px', fontSize: '12px', fontWeight: 600 }}>{item.quantity}</span>
                    <button onClick={() => updateCartQty(idx, 1)} style={{ border: 'none', background: 'none', padding: '4px 8px', cursor: 'pointer' }}><Plus size={10} /></button>
                  </div>
                  <button className="btn-icon danger" onClick={() => removeFromCart(idx)} style={{ padding: '6px' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <span>Sales Tax (8%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                <span>Shipping Method</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <label style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="radio" checked={pickup} onChange={() => setPickup(true)} /> Local Pickup ($0.00)
                  </label>
                  <label style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="radio" checked={!pickup} onChange={() => setPickup(false)} /> Courier ($9.99)
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, color: 'var(--text)', borderTop: '1px solid var(--border-light, #f1f5f9)', paddingTop: '12px' }}>
                <span>Total Amount</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => { setShowCart(false); setShowCheckout(true); }}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span>Proceed to Checkout</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </Modal>

      {/* Checkout Wizard Modal */}
      <Modal open={showCheckout} onClose={() => setShowCheckout(false)} title="Checkout Details">
        <form onSubmit={handleCheckout}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 12px 0' }}><Truck size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Shipping & Contact</h3>
          
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label>Customer Name</label>
            <input type="text" className="form-control" required value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" className="form-control" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="text" className="form-control" required value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>

          {!pickup && (
            <div style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Address Line 1</label>
                <input type="text" className="form-control" required={!pickup} value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>City</label>
                  <input type="text" className="form-control" required={!pickup} value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Zip / Post Code</label>
                  <input type="text" className="form-control" required={!pickup} value={zip} onChange={e => setZip(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '16px 0 12px 0', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <CreditCard size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Payment Details
          </h3>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '8px', fontSize: '13px', fontWeight: 700 }}>
              <ShieldCheck size={16} />
              <span>Security payment active (Stripe sandbox)</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              Payment is processed securely. Since this is the club web workspace, your card will be automatically authorized for sandbox sandbox testing.
            </p>
            <div className="form-group" style={{ margin: 0 }}>
              <input type="text" className="form-control" placeholder="4242 •••• •••• 4242" disabled value="4242 4242 4242 4242 (Authorized Test Card)" style={{ fontSize: '13px' }} />
            </div>
          </div>

          <div className="form-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowCheckout(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={checkoutLoading}>
              {checkoutLoading ? 'Processing Sandbox Payment...' : `Authorize & Pay $${total.toFixed(2)}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Success Modal */}
      <Modal open={!!successOrder} onClose={() => setSuccessOrder(null)} title="Order Placed!">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle2 size={56} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Order Successful!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px', lineHeight: 1.5 }}>
            Thank you for supporting {selectedClub?.name}! Your order has been registered under:
            <br />
            <code style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>#{successOrder}</code>
            <br />
            A manager will prepare your items shortly. You can track progress in My Orders!
          </p>
          <button className="btn btn-primary" onClick={() => setSuccessOrder(null)} style={{ marginTop: '20px', width: '100%', borderRadius: '10px' }}>
            Awesome!
          </button>
        </div>
      </Modal>

    </div>
  );
}
