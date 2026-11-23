import { createContext, useContext, useMemo, useReducer } from 'react';

const CartContext = createContext(null);

function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const id = action.product._id ?? action.product.id;
      const existing = state.find((item) => (item._id ?? item.id) === id);
      return existing
        ? state.map((item) => ((item._id ?? item.id) === id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...state, { ...action.product, quantity: 1 }];
    }
    case 'remove':
      return state.filter((item) => (item._id ?? item.id) !== action.id);
    case 'clear':
      return [];
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const value = useMemo(() => ({
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    addToCart: (product) => dispatch({ type: 'add', product }),
    removeFromCart: (id) => dispatch({ type: 'remove', id }),
    clearCart: () => dispatch({ type: 'clear' }),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart phải được dùng bên trong CartProvider');
  return context;
}
