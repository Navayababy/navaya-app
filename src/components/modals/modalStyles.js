// Factory function for shared modal input/label styles.
// Takes the active palette `p` as argument so styles update with night mode.
export function makeModalStyles(p) {
  return {
    input: {
      width: '100%',
      background: p.bg,
      border: `1px solid ${p.border}`,
      borderRadius: 11,
      padding: '11px 13px',
      fontSize: 16,
      color: p.text,
      fontFamily: "'Jost', sans-serif",
      outline: 'none',
      boxSizing: 'border-box',
    },
    label: {
      display: 'block',
      fontSize: 11,
      color: p.sub,
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
  }
}
