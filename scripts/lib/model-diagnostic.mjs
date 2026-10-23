// Diagnostic text is a bounded view. Original identities and source strings are
// kept elsewhere and are never truncated for resolution or output identities.
export const modelDiagnosticBytes = 512;
export const modelMessageBytes = 1024;
const fragmentBytes = 256;

// Visit at most the output budget, preserving Unicode code-point boundaries.
// Never encode or concatenate the entire untrusted input merely to truncate it.
export function diagnosticText(value, maxBytes = modelDiagnosticBytes) {
  const text = typeof value === 'string' ? value
    : value === null || ['number', 'boolean', 'undefined'].includes(typeof value) ? String(value) : '[value]';
  const marker = maxBytes >= 3 ? '…' : '';
  const budget = maxBytes - Buffer.byteLength(marker);
  let result = '';
  let bytes = 0;
  let consumed = 0;
  for (const point of text) {
    const size = Buffer.byteLength(point);
    if (bytes + size > budget) return result + marker;
    result += point;
    bytes += size;
    consumed += point.length;
  }
  return consumed === text.length ? result : result + marker;
}

// Bound each interpolation before appending it and bound the assembled message.
// Call sites use a tag so no large interpolated message is assembled first.
export function modelMessage(parts, ...values) {
  let result = '';
  const append = (text) => {
    const remaining = modelMessageBytes - Buffer.byteLength(result);
    if (remaining > 0) result += diagnosticText(text, remaining);
  };
  for (let i = 0; i < parts.length; i++) {
    append(parts[i]);
    if (i < values.length) append(diagnosticText(values[i], fragmentBytes));
  }
  return result;
}
