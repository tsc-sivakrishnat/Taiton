import { useEffect, useRef, useState } from 'react';

export function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = '-- Select Option --',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync state
  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    String(opt.label || '').toLowerCase().includes(search.toLowerCase()) ||
    String(opt.value || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: '100%',
        fontFamily: 'inherit',
      }}
    >
      {/* Collapsed Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          padding: '10px 14px',
          backgroundColor: disabled ? 'var(--cp-bg, #f1f5f9)' : 'var(--cp-bg, #eef2f6)',
          border: '1px solid var(--cp-border, #e2e8f0)',
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          fontSize: '13px',
          color: selectedOption ? 'var(--cp-text, #0f172a)' : 'var(--cp-muted, #64748b)',
          fontWeight: selectedOption ? '600' : 'normal',
          minHeight: '40px',
        }}
      >
        <span>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--cp-muted, #64748b)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▲
        </span>
      </div>

      {/* Popover Dropdown Panel */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--cp-surface, #ffffff)',
            border: '1px solid var(--cp-border, #e2e8f0)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            zIndex: 9999,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Internal Search Input */}
          <input
            ref={searchInputRef}
            type="text"
            className="cp-input"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid var(--cp-primary, #2563eb)',
              outline: 'none',
              borderRadius: '6px',
            }}
            placeholder="Type to search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()} // Prevent closing dropdown on input click
          />

          {/* Options List */}
          <ul
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {filteredOptions.length === 0 ? (
              <li
                style={{
                  padding: '8px 12px',
                  color: 'var(--cp-muted, #64748b)',
                  fontSize: '13px',
                  fontStyle: 'italic',
                }}
              >
                No options found
              </li>
            ) : (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    backgroundColor: String(opt.value) === String(value) ? 'var(--cp-bg, #f1f5f9)' : 'transparent',
                    color: 'var(--cp-text, #0f172a)',
                    transition: 'background-color 0.15s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--cp-bg, #f1f5f9)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      String(opt.value) === String(value) ? 'var(--cp-bg, #f1f5f9)' : 'transparent')
                  }
                  onClick={() => handleSelect(opt.value)}
                >
                  <span style={{ fontWeight: String(opt.value) === String(value) ? '600' : 'normal' }}>
                    {opt.label}
                  </span>
                  <span style={{ color: 'var(--cp-muted, #64748b)', fontSize: '11px' }}>
                    {opt.value}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
