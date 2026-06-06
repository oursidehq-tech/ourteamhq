import React, { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(0.1);

  const addItem = useCallback((product, variant, quantity = 1) => {
    setItems(prev => {
      const existingIdx = prev.findIndex(
        i => i.productId === product.id && i.variant === variant
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + quantity,
        };
        return updated;
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        description: product.description || "",
        price: product.price,
        imageUrl: product.imageUrl || product.image || '',
        sizeGuideUrl: product.sizeGuideUrl || "",
        postageOption: (product.postageOption || "post").toString(),
        variant,
        quantity,
      }];
    });
  }, []);

  const removeItem = useCallback((productId, variant) => {
    setItems(prev => prev.filter(
      i => !(i.productId === productId && i.variant === variant)
    ));
  }, []);

  const updateQuantity = useCallback((productId, variant, quantity) => {
    if (quantity <= 0) {
      removeItem(productId, variant);
      return;
    }
    setItems(prev => prev.map(i =>
      i.productId === productId && i.variant === variant
        ? { ...i, quantity }
        : i
    ));
  }, [removeItem]);

  const clearCart = useCallback(() => setItems([]), []);

  const setTaxConfig = useCallback(({ enabled, rate } = {}) => {
    if (typeof enabled === "boolean") {
      setTaxEnabled(enabled);
    }
    if (typeof rate === "number" && Number.isFinite(rate) && rate >= 0) {
      setTaxRate(rate);
    }
  }, []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const tax = taxEnabled ? subtotal * taxRate : 0;
  const total = subtotal + tax;

  return (
    <CartContext.Provider value={{
      items,
      itemCount,
      subtotal,
      tax,
      total,
      taxEnabled,
      taxRate,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      setTaxConfig,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
