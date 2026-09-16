/* Parser CSV incremental: aspas escapadas, vírgulas e campos multilinha. */
(function(root) {
'use strict';
  class CSVParser {
    constructor(onRow) { this.onRow = onRow; this.row = []; this.field = ''; this.quoted = false; this.pending = false; }
    push(text) {
      for (const c of text) {
        if (this.pending) {
          this.pending = false;
          if (c === '"') { this.field += '"'; continue; }
          this.quoted = false;
        }
        if (this.quoted) { if (c === '"') this.pending = true; else this.field += c; }
        else if (c === '"' && !this.field) this.quoted = true;
        else if (c === ',') { this.row.push(this.field); this.field = ''; }
        else if (c === '\n') this.emit();
        else if (c !== '\r') this.field += c;
      }
    }
    emit() { this.row.push(this.field); if (this.row.some(x => x.trim())) this.onRow(this.row); this.row = []; this.field = ''; }
    end() { if (this.quoted && !this.pending) throw new Error('CSV com aspas não fechadas.'); if (this.field || this.row.length) this.emit(); }
  }

if (typeof module !== 'undefined') module.exports = { CSVParser }; else root.SteamGA = { CSVParser };
})(typeof globalThis !== 'undefined' ? globalThis : this);

