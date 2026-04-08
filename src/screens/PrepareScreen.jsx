import { useState } from 'react'
import { brand, palette } from '../theme.js'
import { getChecked, setChecked as saveChecked, getCustomItems, setCustomItems as saveCustomItems, getHiddenDefaults, saveHiddenDefaults } from '../lib/storage.js'

const DEFAULT_ITEMS = [
  { id: 'cover',  emoji: '🌿', label: 'Navaya cover packed'            },
  { id: 'seat',   emoji: '🪑', label: 'Comfortable seat identified'    },
  { id: 'water',  emoji: '💧', label: 'Water bottle filled'            },
  { id: 'phone',  emoji: '🔋', label: 'Phone charged'                  },
  { id: 'pads',   emoji: '✨', label: 'Breast pads in bag'             },
  { id: 'muslin', emoji: '🤍', label: 'Muslin cloth packed'            },
]

const PROTECTED_ID = 'cover'

export default function PrepareScreen({ night }) {
  const p = palette(night)

  const [checked,        setChecked]        = useState(() => getChecked())
  const [customItems,    setCustomItems]    = useState(() => getCustomItems())
  const [hiddenDefaults, setHiddenDefaults] = useState(() => getHiddenDefaults())
  const [newItem,        setNewItem]        = useState('')

  const visibleDefaults = DEFAULT_ITEMS.filter(i => !hiddenDefaults.includes(i.id))
  const allItems = [...visibleDefaults, ...customItems]
  const doneCount  = allItems.filter(i => checked[i.id]).length
  const totalCount = allItems.length
  const ready      = doneCount === totalCount && totalCount > 0
  const progress   = totalCount > 0 ? (doneCount / totalCount) * 100 : 0

  const toggle = (id) => {
    const next = { ...checked, [id]: !checked[id] }
    setChecked(next)
    saveChecked(next)
  }

  const addItem = () => {
    const label = newItem.trim()
    if (!label) return
    const item  = { id: 'custom_' + Date.now(), emoji: '➕', label }
    const next  = [...customItems, item]
    setCustomItems(next)
    saveCustomItems(next)
    setNewItem('')
  }

  const removeCustom = (id) => {
    const next = customItems.filter(i => i.id !== id)
    setCustomItems(next)
    saveCustomItems(next)
    const nextChecked = { ...checked }
    delete nextChecked[id]
    setChecked(nextChecked)
    saveChecked(nextChecked)
  }

  const removeDefault = (id) => {
    const next = [...hiddenDefaults, id]
    setHiddenDefaults(next)
    saveHiddenDefaults(next)
    const nextChecked = { ...checked }
    delete nextChecked[id]
    setChecked(nextChecked)
    saveChecked(nextChecked)
  }

  const reset = () => {
    setChecked({})
    saveChecked({})
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 12px' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Feed with confidence</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, marginTop: 2 }}>Prepare to go out</span>
        <span style={{ display: 'block', fontSize: 12, color: p.sub, marginTop: 4, lineHeight: 1.5 }}>Run through this before you leave. Everything ticked means you're ready.</span>
      </div>

      {/* Progress card */}
      <div style={{
        margin:     '0 14px 12px',
        background: ready ? '#2E3E2A' : p.card,
        borderRadius: 14,
        border:     `1px solid ${ready ? brand.green : p.border}`,
        padding:    '13px 14px',
        transition: 'all .3s',
      }}>
        {ready ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: brand.green, fontSize: 18 }}>✓</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#A8D4A8' }}>You're ready to feed anywhere.</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: p.sub }}>Getting ready</span>
              <span style={{ fontSize: 12, color: brand.bark, fontWeight: 600 }}>{doneCount}/{totalCount}</span>
            </div>
            <div style={{ height: 3, background: p.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: brand.sand, width: `${progress}%`, transition: 'width .3s', borderRadius: 2 }} />
            </div>
          </>
        )}
      </div>

      {/* Checklist items */}
      <div style={{ padding: '0 14px' }}>
        {allItems.map(item => {
          const isCustom = item.id.startsWith('custom_')
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
              <button onClick={() => toggle(item.id)}
                style={{
                  flex:        1,
                  display:     'flex',
                  alignItems:  'center',
                  background:  p.card,
                  borderRadius: 12,
                  border:      `1px solid ${checked[item.id] ? brand.sand : p.border}`,
                  padding:     '13px 14px',
                  cursor:      'pointer',
                  textAlign:   'left',
                  transition:  'border-color .2s',
                }}>
                {/* Checkbox */}
                <div style={{
                  width:        22,
                  height:       22,
                  borderRadius: 5,
                  border:       `1.5px solid ${checked[item.id] ? brand.sand : p.border}`,
                  background:   checked[item.id] ? brand.sand : 'transparent',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  marginRight:  10,
                  flexShrink:   0,
                  transition:   'all .2s',
                }}>
                  {checked[item.id] && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                </div>

                <span style={{ fontSize: 18, marginRight: 9 }}>{item.emoji}</span>
                <span style={{
                  fontSize:        13,
                  color:           checked[item.id] ? p.sub : p.text,
                  fontWeight:      500,
                  textDecoration:  checked[item.id] ? 'line-through' : 'none',
                  transition:      'all .2s',
                  flex:            1,
                }}>
                  {item.label}
                </span>
              </button>

              {/* Remove button — all items except the protected cover */}
              {item.id !== PROTECTED_ID && (
                <button onClick={() => isCustom ? removeCustom(item.id) : removeDefault(item.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.sub, fontSize: 16, padding: '0 0 0 8px', lineHeight: 1 }}>
                  ×
                </button>
              )}
            </div>
          )
        })}

        {/* Add custom item */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 8 }}>
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add your own item…"
            style={{
              flex:        1,
              background:  p.card,
              border:      `1px solid ${p.border}`,
              borderRadius: 11,
              padding:     '10px 13px',
              fontSize:    13,
              color:       p.text,
              fontFamily:  "'DM Sans', sans-serif",
              outline:     'none',
            }}
          />
          <button onClick={addItem} disabled={!newItem.trim()}
            style={{
              padding:     '0 16px',
              borderRadius: 11,
              border:      'none',
              background:  newItem.trim() ? brand.bark : p.border,
              color:       newItem.trim() ? brand.sand : p.sub,
              cursor:      newItem.trim() ? 'pointer' : 'default',
              fontSize:    20,
              transition:  'all .2s',
              lineHeight:  1,
            }}>
            +
          </button>
        </div>

        {doneCount > 0 && (
          <button onClick={reset}
            style={{ width: '100%', textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: p.sub, padding: '8px 0', letterSpacing: '.04em' }}>
            Reset checklist
          </button>
        )}
      </div>

      <div style={{ height: 20 }} />
    </div>
  )
}
