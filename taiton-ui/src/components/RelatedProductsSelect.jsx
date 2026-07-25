import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/authContext.js';
import { enterpriseApi } from '../api/enterpriseApi.js';

export function RelatedProductsSelect({ value, onChange }) {
  const { token } = useAuth();
  const [allProducts, setAllProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Fetch all products
  useEffect(() => {
    if (token) {
      enterpriseApi.contentList(token, 'product')
        .then((res) => {
          setAllProducts(res.items ?? []);
        })
        .catch((err) => console.error('Failed to load related products list:', err));
    }
  }, [token]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse current value
  const selectedIds = value
    ? value.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const handleSelect = (prdId) => {
    if (!selectedIds.includes(prdId)) {
      const next = [...selectedIds, prdId].join(',');
      onChange(next);
    }
    setSearch('');
    setIsOpen(false);
  };

  const handleRemove = (prdId) => {
    const next = selectedIds.filter((id) => id !== prdId).join(',');
    onChange(next);
  };

  // Find product titles for chips
  const getProductTitle = (prdId) => {
    const found = allProducts.find((p) => p.payload?.prd_id === prdId);
    return found ? found.title : prdId;
  };

  // Filter options: not selected and matches search
  const options = allProducts.filter((p) => {
    const prdId = p.payload?.prd_id;
    if (!prdId || selectedIds.includes(prdId)) return false;
    const matchText = `${p.title} ${prdId} ${p.payload?.productCode || ''}`.toLowerCase();
    return matchText.includes(search.toLowerCase());
  });

  return (
    <div className="cp-field cp-field--full" ref={containerRef} style={{ position: 'relative' }}>
      <span className="cp-field-label-text">Related Products</span>

      {/* Selected chips display */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {selectedIds.map((prdId) => (
          <div
            key={prdId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: 'var(--cp-surface)',
              border: '1px solid var(--cp-border)',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--cp-text)'
            }}
          >
            <span>{getProductTitle(prdId)}</span>
            <button
              type="button"
              onClick={() => handleRemove(prdId)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--cp-text-muted)',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center'
              }}
              title="Remove product"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Selector trigger */}
      <div style={{ position: 'relative' }}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="cp-input"
          style={{
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            minHeight: '40px'
          }}
        >
          <span style={{ color: 'var(--cp-text-muted)', fontSize: '14px' }}>
            {selectedIds.length === 0 ? '-- Choose Related Products --' : `${selectedIds.length} product(s) selected`}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'transform 0.2s',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              color: 'var(--cp-text-muted)'
            }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        {/* Dropdown panel */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              backgroundColor: '#ffffff',
              border: '1px solid var(--cp-border)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
              zIndex: 1000,
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <input
              type="text"
              placeholder="Search products..."
              className="cp-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                fontSize: '13px',
                padding: '6px 10px',
                height: '34px',
                borderRadius: '6px'
              }}
              autoFocus
            />

            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {options.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p.payload?.prd_id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--cp-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <strong style={{ color: 'var(--cp-text)' }}>{p.title}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--cp-text-muted)' }}>
                    ID: {p.payload?.prd_id} {p.payload?.productCode ? `| Code: ${p.payload.productCode}` : ''}
                  </span>
                </div>
              ))}
              {options.length === 0 && (
                <div style={{ padding: '8px 12px', fontSize: '13px', color: 'var(--cp-text-muted)', textAlign: 'center' }}>
                  No matching products found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
