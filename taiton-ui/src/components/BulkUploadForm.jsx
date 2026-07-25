import { useState } from 'react';
import { notify } from '../utils/notify.js';

export function BulkUploadForm({
  title,
  description,
  templateUrl,
  templateButtonLabel = 'Download Excel Seeding Template',
  processButtonLabel = 'Process Upload',
  uploading,
  uploadStats,
  uploadErrors = [],
  downloadUrl,
  onUpload,
  onClearReport,
  acceptImages = true,
  imageLabel = 'Choose Accompanying Images (Optional)',
}) {
  const [excelFile, setExcelFile] = useState(null);
  const [imagesList, setImagesList] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!excelFile) {
      notify.formWarning('Please select a template Excel file.');
      return;
    }
    onUpload(excelFile, imagesList);
  };

  const handleDismiss = () => {
    setExcelFile(null);
    setImagesList([]);
    const fileInputs = document.querySelectorAll('.cp-bulk-file-input');
    fileInputs.forEach(input => { input.value = ''; });
    if (onClearReport) {
      onClearReport();
    }
  };

  return (
    <section className="cp-card cp-card-pad">
      <h2 className="cp-section-title" style={{ marginBottom: '12px' }}>{title}</h2>
      <p className="cp-muted" style={{ marginBottom: '24px' }}>
        {description}
      </p>

      {/* 1. Processing Report */}
      {uploadStats && (
        <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', border: '1px solid var(--cp-border)', backgroundColor: 'var(--cp-surface)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Upload Processing Report</span>
            <button
              type="button"
              className="cp-btn cp-btn-secondary"
              onClick={handleDismiss}
              style={{ padding: '4px 12px', minHeight: '32px', fontSize: '12px' }}
            >
              Dismiss Report
            </button>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}>
              <span className="cp-muted" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Processed</span>
              <strong style={{ fontSize: '20px', color: 'var(--cp-text)', display: 'block', marginTop: '4px' }}>{uploadStats.total}</strong>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}>
              <span className="cp-muted" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success Count</span>
              <strong style={{ fontSize: '20px', color: '#16a34a', display: 'block', marginTop: '4px' }}>{uploadStats.success}</strong>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}>
              <span className="cp-muted" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed Count</span>
              <strong style={{ fontSize: '20px', color: uploadStats.failed > 0 ? '#dc2626' : 'var(--cp-text-muted)', display: 'block', marginTop: '4px' }}>{uploadStats.failed}</strong>
            </div>
          </div>

          {downloadUrl && uploadStats.failed > 0 && (
            <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: 'rgba(220, 38, 38, 0.05)', borderRadius: '8px', border: '1px dashed rgba(220, 38, 38, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#991b1b', fontWeight: '500' }}>Failed rows have been highlighted in RED in the output sheet with failure reasons.</span>
              <button
                type="button"
                className="cp-btn cp-btn-secondary"
                onClick={() => window.open((downloadUrl.startsWith('http') ? '' : (import.meta.env?.VITE_API_BASE || window.location.origin)) + downloadUrl, '_blank')}
                style={{ minHeight: '32px', fontSize: '12px', padding: '4px 12px', whiteSpace: 'nowrap' }}
              >
                Download Error Spreadsheet
              </button>
            </div>
          )}

          {uploadErrors.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#991b1b', fontSize: '14px', fontWeight: '700' }}>Rejection & Failure Log</h4>
              <div className="cp-table-wrap" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>
                <table className="cp-table">
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
                      <th style={{ color: '#991b1b', fontWeight: '700' }}>Sheet</th>
                      <th style={{ color: '#991b1b', fontWeight: '700' }}>Row Num</th>
                      <th style={{ color: '#991b1b', fontWeight: '700' }}>Record ID</th>
                      <th style={{ color: '#991b1b', fontWeight: '700' }}>Reason for Failure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadErrors.map((err, index) => (
                      <tr key={index} style={{ backgroundColor: 'var(--cp-bg-card)' }}>
                        <td><span className="cp-tag cp-tag-secondary">{err.sheet}</span></td>
                        <td style={{ fontWeight: '600' }}>{err.row}</td>
                        <td><code>{err.identifier}</code></td>
                        <td style={{ color: '#dc2626', fontWeight: '500' }}>{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. File Upload Form */}
      <form onSubmit={handleSubmit} className="cp-grid" style={{ maxWidth: '600px', margin: '0 auto', gap: '20px' }}>
        <div>
          <button
            type="button"
            className="cp-btn cp-btn-secondary"
            onClick={() => window.open(templateUrl, '_blank')}
            style={{ width: '100%', minHeight: '44px' }}
          >
            {templateButtonLabel}
          </button>
        </div>

        <label className="cp-field">
          <span className="cp-field-label-text">1. Select Excel File (.xlsx) <span className="cp-req">*</span></span>
          <input
            type="file"
            className="cp-input cp-bulk-file-input"
            accept=".xlsx"
            onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
            required
          />
        </label>

        {acceptImages && (
          <label className="cp-field">
            <span className="cp-field-label-text">2. {imageLabel}</span>
            <input
              type="file"
              multiple
              className="cp-input cp-bulk-file-input"
              accept="image/*"
              onChange={(e) => setImagesList(Array.from(e.target.files || []))}
            />
          </label>
        )}

        <div>
          <button
            type="submit"
            className="cp-btn cp-btn-primary"
            disabled={!excelFile || uploading}
            style={{ minHeight: '44px', width: '100%' }}
          >
            {uploading ? 'Processing Upload…' : processButtonLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
