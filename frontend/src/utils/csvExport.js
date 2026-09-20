export function exportToCSV(data, filename, columns) {
  if (!data || !data.length) return;

  // Header row
  const headers = columns.map(col => col.label).join(',');
  
  // Data rows
  const rows = data.map(item => {
    return columns.map(col => {
      let val = item[col.key];
      // Handle nested or formatted values
      if (col.formatter) {
        val = col.formatter(val, item);
      }
      if (val === null || val === undefined) val = '';
      
      // Escape commas and quotes for CSV
      const strVal = String(val).replace(/"/g, '""');
      return `"${strVal}"`;
    }).join(',');
  });

  // Combine and add BOM for Excel
  const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
