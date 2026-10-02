import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, wide, extraWide }) {
  if (!open) return null;
  const widthClass = extraWide ? ' modal-extra-wide' : wide ? ' modal-wide' : '';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-content${widthClass}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
