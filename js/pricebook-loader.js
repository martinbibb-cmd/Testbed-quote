export class PricebookLoader {
  constructor({ manifest = [] } = {}) {
    this.manifest = manifest;
    this.data = {
      meta: { last_refreshed: null },
      sections: [],
      items: []
    };
  }

  async loadAll() {
    const sections = [];
    const items = [];
    let lastDates = [];

    for (const path of this.manifest) {
      const text = await this.#fetchText(path);
      const sec = this.#parseSectionMd(text, path);
      sections.push(sec);

      // Promote per-row brand for flues (from front-matter)
      if (sec.front.brand) {
        for (const r of sec.rows) r.brand = sec.front.brand;
      }
      // Tag section id on each row
      for (const r of sec.rows) r.__section_id = sec.id;

      items.push(...sec.rows);
      if (sec.front.last_refreshed) lastDates.push(sec.front.last_refreshed);
    }

    // choose the most recent date if present
    const last_refreshed = this.#mostRecentDate(lastDates);
    this.data = {
      meta: { last_refreshed },
      sections,
      items
    };
  }

  // ---------- internals ----------

  async #fetchText(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    return await res.text();
  }

  #parseSectionMd(md, path) {
    const { front, body } = this.#splitFrontMatter(md);
    const tables = this.#extractTables(body);
    if (tables.length === 0) {
      return {
        id: front.id || this.#slugFromPath(path),
        title: front.section || front.title || this.#titleFromPath(path),
        headers: [],
        rows: [],
        notes: front.notes || "",
        front
      };
    }
    // by convention, first table = primary table for the section
    const [primary] = tables;
    const id = front.id || this.#slugFromPath(path);
    const title = front.section || front.title || this.#titleFromPath(path);
    return {
      id, title,
      headers: primary.headers,
      rows: primary.rows,
      notes: front.notes || "",
      front
    };
  }

  #splitFrontMatter(md) {
    const fm = md.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!fm) return { front: {}, body: md.trim() };
    const yaml = fm[1];
    const body = md.slice(fm[0].length).trim();
    return { front: this.#parseLightYaml(yaml), body };
  }

  #parseLightYaml(yaml) {
    // minimal YAML: key: value | booleans | numbers | ISO dates
    const obj = {};
    const lines = yaml.split(/\r?\n/);
    for (let raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf(':');
      if (i === -1) continue;
      const key = line.slice(0, i).trim();
      let val = line.slice(i+1).trim();
      if (/^(true|false)$/i.test(val)) val = (/^true$/i.test(val));
      else if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
      else if (/^\d{4}-\d{2}-\d{2}/.test(val)) val = val; // keep date string
      else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1,-1);
      obj[key] = val;
    }
    return obj;
  }

  #extractTables(mdBody) {
    // Capture GitHub-flavored pipe tables
    // Table = header line with pipes, separator line with dashes/colons, then data rows with pipes
    const lines = mdBody.split(/\r?\n/);
    const tables = [];
    for (let i = 0; i < lines.length; i++) {
      const headerLine = lines[i];
      const sepLine = lines[i+1] || "";
      if (!this.#isPipeRow(headerLine) || !this.#isSeparatorRow(sepLine)) continue;

      // collect rows until a non-pipe line
      const rows = [];
      let j = i + 2;
      while (j < lines.length && this.#isPipeRow(lines[j])) {
        rows.push(lines[j]); j++;
      }

      const headers = this.#splitPipes(headerLine).map(h => this.#cleanCell(h));
      const tableRows = rows.map(r => {
        const cells = this.#splitPipes(r);
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = this.#cleanCell(cells[idx] ?? "");
        });
        return obj;
      });

      tables.push({ headers, rows: tableRows });
      i = j;
    }
    return tables;
  }

  #isPipeRow(s) { return /^\s*\|.*\|\s*$/.test(s); }
  #isSeparatorRow(s) { return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(s); }
  #splitPipes(row) {
    // split by '|' but ignore leading/trailing empties
    const parts = row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    return parts.map(p => p.trim());
  }
  #cleanCell(s) { return s.replace(/\\\|/g, '|').trim(); }

  #slugFromPath(p) {
    return p.replace(/^.*pricebook-md\//,'').replace(/\.[^.]+$/,'').replace(/[^\w]+/g,'_');
  }
  #titleFromPath(p) {
    const base = p.split('/').pop().replace(/\.[^.]+$/,'');
    return base.replace(/[-_]+/g,' ').replace(/\b\w/g, m => m.toUpperCase());
  }
  #mostRecentDate(arr) {
    const ds = arr.filter(Boolean).sort((a,b)=> (new Date(b)) - (new Date(a)));
    return ds[0] || null;
  }
}
