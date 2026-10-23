import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, NumberFormat, Packer, PageNumber,
  Paragraph, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
} from 'docx';
import { SECTIONS, PARTS, PARCOURS, type Parcours, type Section } from './plan';

export type ExportProject = {
  title: string; parcours: Parcours; owner_name: string; structure_accueil: string; annee: string;
  encadreur_name: string; maitre_stage: string;
};
export type Figure = { data: Buffer; width: number; height: number; type: 'png' | 'jpg' };

const FONT = 'Times New Roman';
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];
const FIG_LINE = /^!\[([^\]]*)\]\(figure:([^)]+)\)$/;

/** Lignes d'en-tête de la page de garde, séparées par « | » dans SCHOOL_HEADER. */
function schoolHeader() {
  return (process.env.SCHOOL_HEADER || "ÉCOLE SUPÉRIEURE D'AGRONOMIE").split('|').map((s) => s.trim()).filter(Boolean);
}

function centered(text: string, opts: { bold?: boolean; size?: number; before?: number; after?: number; caps?: boolean } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 120 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, allCaps: opts.caps, font: FONT })],
  });
}

function coverPage(p: ExportProject) {
  const out: Paragraph[] = schoolHeader().map((l) => centered(l, { bold: true, size: 26 }));
  out.push(centered(`Parcours : ${PARCOURS[p.parcours]}`, { before: 240, size: 24 }));
  out.push(centered('MÉMOIRE DE FIN DE CYCLE', { bold: true, size: 32, before: 1200 }));
  out.push(centered("Diplôme de Licence", { size: 24, after: 600 }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 },
    border: {
      top: { style: BorderStyle.DOUBLE, size: 6, space: 8, color: '1F5B3A' },
      bottom: { style: BorderStyle.DOUBLE, size: 6, space: 8, color: '1F5B3A' },
    },
    children: [new TextRun({ text: p.title, bold: true, size: 30, font: FONT, allCaps: true })],
  }));
  out.push(centered(`Présenté par : ${p.owner_name || '…'}`, { before: 900, size: 24 }));
  if (p.structure_accueil) out.push(centered(`Structure d'accueil : ${p.structure_accueil}`, { size: 22 }));
  out.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  if (p.maitre_stage) out.push(centered(`Maître de stage : ${p.maitre_stage}`, { size: 22 }));
  if (p.encadreur_name) out.push(centered(`Encadreur pédagogique : ${p.encadreur_name}`, { size: 22 }));
  out.push(centered(`Année académique : ${p.annee || '…'}`, { before: 900, size: 22, bold: true }));
  return out;
}

function heading(text: string, level: number, pageBreak = false) {
  return new Paragraph({
    heading: HEADINGS[Math.min(level, 4) - 1],
    pageBreakBefore: pageBreak,
    spacing: { before: 240, after: 160 },
    alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text: level === 1 ? text.toUpperCase() : text, font: FONT })],
  });
}

function body(text: string) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 360 },
    indent: { firstLine: 567 },
    children: runs(text),
  });
}

/** Gras en **texte**, italique en *texte*. */
function runs(text: string) {
  const out: TextRun[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT }));
    const t = m[0];
    out.push(t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true, font: FONT }) : new TextRun({ text: t.slice(1, -1), italics: true, font: FONT }));
    last = m.index! + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT }));
  return out;
}

function table(rows: string[][]) {
  const cols = Math.max(...rows.map((r) => r.length));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: Array.from({ length: cols }, (_, c) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: r[c] || '', bold: i === 0, size: 20, font: FONT })] })],
      })),
    })),
  });
}

function figure(fig: Figure | undefined, caption: string, n: number) {
  const out: (Paragraph)[] = [];
  if (fig) {
    const maxW = 450; // ≈ 12 cm
    const ratio = fig.width > maxW ? maxW / fig.width : 1;
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: fig.data, transformation: { width: Math.round(fig.width * ratio), height: Math.round(fig.height * ratio) } })],
    }));
  }
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: `Figure ${n} : ${caption}`, italics: true, size: 20, font: FONT })],
  }));
  return out;
}

/** Convertit le texte d'une section en paragraphes Word. */
function render(section: Section, text: string, figures: Record<string, Figure>, counter: { fig: number }) {
  const out: (Paragraph | Table)[] = [];
  const all = text.split('\n');
  if (section.kind === 'list') {
    const prefix = section.key === 'objectifs_specifiques' ? 'OS' : section.key === 'hypotheses' ? 'H' : '';
    all.map((l) => l.trim()).filter(Boolean).forEach((l, i) => {
      if (section.key === 'references') {
        out.push(new Paragraph({ spacing: { after: 120 }, indent: { left: 567, hanging: 567 }, alignment: AlignmentType.JUSTIFIED, children: runs(l) }));
      } else if (prefix) {
        out.push(new Paragraph({ spacing: { after: 100, line: 360 }, alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: `${prefix}${i + 1} : `, bold: true, font: FONT }), ...runs(l)] }));
      } else {
        out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80, line: 360 }, children: runs(l.replace(/^-\s*/, '')) }));
      }
    });
    return out;
  }
  for (let i = 0; i < all.length; i++) {
    const line = all[i].trim();
    if (!line) continue;
    const fig = line.match(FIG_LINE);
    if (fig) { counter.fig++; out.push(...figure(figures[fig[2]], fig[1], counter.fig)); continue; }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < all.length && all[i].trim().startsWith('|')) {
        const l = all[i].trim();
        if (!/^\|[\s:|-]+\|?$/.test(l)) rows.push(l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
        i++;
      }
      i--;
      if (rows.length) { out.push(table(rows)); out.push(new Paragraph({ children: [] })); }
      continue;
    }
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) { out.push(heading(h[2], Math.min(section.level + h[1].length - 1, 4))); continue; }
    if (/^[-•]\s+/.test(line)) {
      out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80, line: 360 }, alignment: AlignmentType.JUSTIFIED, children: runs(line.replace(/^[-•]\s+/, '')) }));
      continue;
    }
    out.push(body(line));
  }
  return out;
}

export async function buildDocx(p: ExportProject, content: Record<string, string>, figures: Record<string, Figure>) {
  const counter = { fig: 0 };
  const liminaires: (Paragraph | Table | TableOfContents)[] = [];
  const main: (Paragraph | Table)[] = [];

  for (const s of SECTIONS.filter((x) => x.part === 'Pages liminaires')) {
    const text = (content[s.key] || '').trim();
    if (!text) continue;
    if (s.key === 'mots_cles' || s.key === 'keywords') {
      liminaires.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `${s.title} : `, bold: true, font: FONT }), new TextRun({ text, font: FONT })] }));
      continue;
    }
    liminaires.push(heading(s.title, 1, liminaires.length > 0));
    liminaires.push(...render(s, text, figures, counter));
  }
  liminaires.push(heading('Sommaire', 1, liminaires.length > 0));
  liminaires.push(new TableOfContents('Sommaire', { hyperlink: true, headingStyleRange: '1-3' }));
  liminaires.push(new Paragraph({ children: [new TextRun({ text: 'Dans Word : clic droit sur le sommaire, puis « Mettre à jour les champs ».', italics: true, size: 18, color: '777777', font: FONT })] }));

  for (const part of PARTS.filter((x) => x !== 'Pages liminaires')) {
    const secs = SECTIONS.filter((x) => x.part === part);
    const isNumberedPart = part.startsWith('Partie');
    if (isNumberedPart) main.push(heading(part.replace(/^Partie (\d) : /, 'Partie $1 : '), 1, true));
    secs.forEach((s, idx) => {
      const text = (content[s.key] || '').trim();
      const breakBefore = !isNumberedPart && s.level === 1;
      if (!text && s.level === 3) return;
      main.push(heading(isNumberedPart ? `${idx + 1}. ${s.title}` : s.title, s.level, breakBefore && main.length > 0));
      if (text) main.push(...render(s, text, figures, counter));
    });
  }

  const doc = new Document({
    creator: p.owner_name || 'Sillon',
    title: p.title,
    styles: {
      default: { document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { line: 360 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { bold: true, size: 30, font: FONT, color: '1D2A1F' } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { bold: true, size: 26, font: FONT, color: '1D2A1F' } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { bold: true, italics: true, size: 24, font: FONT } },
        { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { italics: true, size: 24, font: FONT } },
      ],
    },
    features: { updateFields: true },
    sections: [
      { properties: { page: { margin: { top: 1417, bottom: 1417, left: 1417, right: 1417 } } }, children: coverPage(p) },
      {
        properties: { page: { margin: { top: 1417, bottom: 1417, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } },
        footers: { default: footer() },
        children: liminaires,
      },
      {
        properties: { page: { margin: { top: 1417, bottom: 1417, left: 1701, right: 1417 }, pageNumbers: { start: 1 } } },
        footers: { default: footer() },
        children: main,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function footer() {
  return new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })],
  });
}

/** Lit la largeur et la hauteur d'une image PNG ou JPEG sans dépendance. */
export function imageSize(buf: Buffer): { width: number; height: number; type: 'png' | 'jpg' } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: 'png' };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), type: 'jpg' };
      }
      i += 2 + len;
    }
  }
  return null;
}

