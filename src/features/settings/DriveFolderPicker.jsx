import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { driveListFiles, driveCreateFile } from '../../api/driveApi.js';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function listFolderChildren(token, folderId) {
  const q = `'${folderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;
  const result = await driveListFiles({ token, q, pageSize: 100, fields: 'files(id,name)' });
  return (result.files || []).sort((a, b) => a.name.localeCompare(b.name));
}

// ── FolderBrowser ────────────────────────────────────────────────────────────
// Modal for navigating the Drive folder hierarchy. Calls onSelect(id, pathStr)
// where pathStr is a human-readable label like "My Drive > Foo > Bar".
function FolderBrowser({ googleToken, onSelect, onClose }) {
  const ROOT = { id: 'root', name: 'My Drive' };
  const [path, setPath]             = useState([ROOT]);
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [hovered, setHovered]       = useState(null);

  const current = path[path.length - 1];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError('');
    setCreating(false);
    setNewName('');
    setCreateError('');
    setItems([]);
    listFolderChildren(googleToken, current.id)
      .then(f  => { if (!cancelled) { setItems(f);             setLoading(false); } })
      .catch(e => { if (!cancelled) { setFetchError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [googleToken, current.id]);

  function navigateInto(folder) {
    setPath(p => [...p, { id: folder.id, name: folder.name }]);
  }

  function breadcrumbNav(index) {
    if (index < path.length - 1) setPath(p => p.slice(0, index + 1));
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) { setCreateError('Enter a folder name.'); return; }
    setCreateBusy(true);
    setCreateError('');
    try {
      const folder = await driveCreateFile({
        token: googleToken,
        name,
        mimeType: FOLDER_MIME,
        parents: [current.id],
      });
      const created = { id: folder.id, name: folder.name };
      setItems(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCreating(false);
      setNewName('');
      navigateInto(created);
    } catch (e) {
      setCreateError('Failed: ' + e.message);
    } finally {
      setCreateBusy(false);
    }
  }

  // Build human-readable path string for the current location.
  const pathStr = path.map(p => p.name).join(' > ');
  const selectLabel = path.length === 1 ? 'Select My Drive root' : `Select "${current.name}"`;

  const S = {
    overlay: {
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    modal: {
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 10,
      width: 420, maxWidth: '92vw',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 14px',
      borderBottom: `1px solid ${COLORS.border}`,
      flexShrink: 0,
    },
    breadcrumb: {
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 2px',
      padding: '7px 14px',
      borderBottom: `1px solid ${COLORS.border}`,
      flexShrink: 0,
      fontSize: 12,
    },
    listArea: {
      overflowY: 'auto',
      minHeight: 120, maxHeight: 300,
      padding: '4px 0',
    },
    footer: {
      borderTop: `1px solid ${COLORS.border}`,
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      flexShrink: 0,
    },
    footerRow: {
      display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center',
    },
    btnPrimary: {
      padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
      border: `1px solid ${COLORS.accent}`,
      background: COLORS.accent,
      color: '#fff', fontFamily: 'inherit', whiteSpace: 'nowrap',
    },
    btnSecondary: {
      padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
      border: `1px solid ${COLORS.border2}`,
      background: 'transparent', color: COLORS.text2,
      fontFamily: 'inherit', whiteSpace: 'nowrap',
    },
    input: {
      flex: 1, padding: '4px 8px', borderRadius: 6, fontSize: 12,
      border: `1px solid ${COLORS.border2}`,
      background: COLORS.surface3, color: COLORS.text,
      fontFamily: 'inherit', outline: 'none',
    },
  };

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>Select a folder</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.muted,
                     fontSize: 20, lineHeight: 1, padding: '0 2px', fontFamily: 'inherit' }}
          >×</button>
        </div>

        {/* Breadcrumb */}
        <div style={S.breadcrumb}>
          {path.map((seg, i) => (
            <span key={seg.id + '_' + i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {i > 0 && <span style={{ color: COLORS.muted, margin: '0 2px' }}>›</span>}
              <button
                onClick={() => breadcrumbNav(i)}
                style={{
                  background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 12,
                  padding: 0, lineHeight: 1.4,
                  cursor: i < path.length - 1 ? 'pointer' : 'default',
                  color: i < path.length - 1 ? COLORS.text2 : COLORS.text,
                  fontWeight: i === path.length - 1 ? 500 : 400,
                  textDecoration: i < path.length - 1 ? 'underline' : 'none',
                }}
              >{seg.name}</button>
            </span>
          ))}
        </div>

        {/* Folder list */}
        <div style={S.listArea}>
          {loading && (
            <div style={{ padding: '16px 14px', fontSize: 13, color: COLORS.muted }}>Loading…</div>
          )}
          {!loading && fetchError && (
            <div style={{ padding: '16px 14px', fontSize: 13, color: '#e06c75' }}>{fetchError}</div>
          )}
          {!loading && !fetchError && items.length === 0 && (
            <div style={{ padding: '16px 14px', fontSize: 13, color: COLORS.muted, fontStyle: 'italic' }}>
              No subfolders — use &ldquo;New folder here&rdquo; to create one
            </div>
          )}
          {!loading && !fetchError && items.map(f => (
            <div
              key={f.id}
              onClick={() => navigateInto(f)}
              onMouseEnter={() => setHovered(f.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px',
                cursor: 'pointer',
                fontSize: 13, color: COLORS.text,
                background: hovered === f.id ? COLORS.surface2 : 'transparent',
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>📁</span>
              <span style={{ flex: 1 }}>{f.name}</span>
              <span style={{ fontSize: 11, color: COLORS.muted }}>›</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          {creating ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); setCreateError(''); }
                  }}
                  placeholder="New folder name…"
                  style={S.input}
                />
                <button onClick={handleCreate} disabled={createBusy} style={S.btnPrimary}>
                  {createBusy ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(''); setCreateError(''); }}
                  disabled={createBusy}
                  style={S.btnSecondary}
                >Cancel</button>
              </div>
              {createError && (
                <div style={{ fontSize: 11, color: '#e06c75' }}>{createError}</div>
              )}
            </div>
          ) : (
            <div style={S.footerRow}>
              <button onClick={() => setCreating(true)} style={S.btnSecondary}>
                + New folder here
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={S.btnSecondary}>Cancel</button>
                <button onClick={() => onSelect(current.id, pathStr)} style={S.btnPrimary}>
                  {selectLabel}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

FolderBrowser.propTypes = {
  googleToken: PropTypes.string.isRequired,
  onSelect:    PropTypes.func.isRequired,
  onClose:     PropTypes.func.isRequired,
};

// ── DriveFolderPicker ────────────────────────────────────────────────────────
// Reusable folder picker.
//
// Display modes:
//   displayPath set  → shows "📁 My Drive > Folder > Sub" + [Change…] [×]
//   value set only   → shows raw folder ID in input + [Browse…] [×]
//   neither set      → shows placeholder input + [Browse…]
//
// onChange(id, pathLabel?) — pathLabel is provided when the user selects via
// the browser; it is omitted when the user types an ID manually (caller should
// clear the stored path in that case).
function DriveFolderPicker({
  value,
  displayPath,
  onChange,
  placeholder = 'Drive folder ID (optional)',
  disabled = false,
  googleToken = '',
}) {
  const [browsing, setBrowsing] = useState(false);

  const canAct = !!(googleToken && !disabled);

  function handleSelect(id, pathLabel) {
    onChange(id, pathLabel);
    setBrowsing(false);
  }

  function handleClear() {
    onChange('', '');
  }

  const btnStyle = active => ({
    padding: '4px 10px', borderRadius: 6,
    border: `1px solid ${COLORS.border2}`,
    background: 'transparent',
    color: active ? COLORS.text2 : COLORS.muted,
    fontFamily: 'inherit', fontSize: 12,
    cursor: active ? 'pointer' : 'not-allowed',
    whiteSpace: 'nowrap', flexShrink: 0,
    opacity: active ? 1 : 0.5,
  });

  const inputStyle = {
    flex: 1, padding: '4px 8px', borderRadius: 6,
    border: `1px solid ${COLORS.border2}`,
    background: disabled ? COLORS.surface2 : COLORS.surface3,
    color: disabled ? COLORS.muted : COLORS.text,
    fontFamily: 'inherit', fontSize: 12, outline: 'none',
    opacity: disabled ? 0.6 : 1,
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {displayPath ? (
          /* Path display mode — folder was selected via browser */
          <div style={{
            flex: 1, padding: '4px 8px', borderRadius: 6,
            border: `1px solid ${COLORS.border2}`,
            background: COLORS.surface2,
            color: COLORS.text, fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6,
            minWidth: 0,
          }}>
            <span style={{ flexShrink: 0, fontSize: 13 }}>📁</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Google Drive &rsaquo; {displayPath}
            </span>
          </div>
        ) : (
          /* Raw ID input mode */
          <input
            value={value || ''}
            onChange={e => onChange(e.target.value.trim())}
            placeholder={placeholder}
            disabled={disabled}
            style={inputStyle}
          />
        )}

        {displayPath ? (
          /* Change + Clear when path is known */
          <>
            <button
              onClick={() => { if (canAct) setBrowsing(true); }}
              disabled={!canAct}
              title="Browse to select a different folder"
              style={btnStyle(canAct)}
            >Change…</button>
            <button
              onClick={handleClear}
              disabled={disabled}
              title="Clear selection"
              style={{ ...btnStyle(!disabled), color: COLORS.muted }}
            >×</button>
          </>
        ) : (
          /* Browse + optional Clear when no path */
          <>
            <button
              onClick={() => { if (canAct) setBrowsing(true); }}
              disabled={!canAct}
              title={!googleToken ? 'Connect Google Drive to enable' : 'Browse Drive folders'}
              style={btnStyle(canAct)}
            >Browse…</button>
            {value && (
              <button
                onClick={handleClear}
                disabled={disabled}
                title="Clear"
                style={{ ...btnStyle(!disabled), color: COLORS.muted }}
              >×</button>
            )}
          </>
        )}
      </div>

      {browsing && (
        <FolderBrowser
          googleToken={googleToken}
          onSelect={handleSelect}
          onClose={() => setBrowsing(false)}
        />
      )}
    </>
  );
}

DriveFolderPicker.propTypes = {
  value:       PropTypes.string,
  displayPath: PropTypes.string,
  onChange:    PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled:    PropTypes.bool,
  googleToken: PropTypes.string,
};

export { DriveFolderPicker };
