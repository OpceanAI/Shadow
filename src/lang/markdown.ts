export interface MarkdownInfo {
  headings: MarkdownHeading[];
  links: MarkdownLink[];
  codeBlocks: MarkdownCodeBlock[];
  images: MarkdownImage[];
  lists: number;
  tables: number;
  lineCount: number;
}

export interface MarkdownHeading {
  level: number;
  text: string;
  line: number;
}

export interface MarkdownLink {
  text: string;
  url: string;
  line: number;
}

export interface MarkdownCodeBlock {
  language?: string;
  content: string;
  line: number;
}

export interface MarkdownImage {
  alt: string;
  src: string;
  line: number;
}

export function parseMarkdown(content: string, filePath?: string): MarkdownInfo {
  const lines = content.split('\n');
  const info: MarkdownInfo = {
    headings: [],
    links: [],
    codeBlocks: [],
    images: [],
    lists: 0,
    tables: 0,
    lineCount: lines.length,
  };

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockContent = '';
  let codeBlockLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        info.codeBlocks.push({
          language: codeBlockLang || undefined,
          content: codeBlockContent.trimEnd(),
          line: codeBlockLine,
        });
        codeBlockContent = '';
        codeBlockLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockLine = lineNum;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      info.headings.push({
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
        line: lineNum,
      });
    }

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(line)) !== null) {
      info.links.push({
        text: linkMatch[1],
        url: linkMatch[2],
        line: lineNum,
      });
    }

    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let imgMatch;
    while ((imgMatch = imageRegex.exec(line)) !== null) {
      info.images.push({
        alt: imgMatch[1],
        src: imgMatch[2],
        line: lineNum,
      });
    }

    if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      info.lists++;
    }

    if (line.includes('|') && lines[i + 1]?.includes('---')) {
      info.tables++;
    }
  }

  return info;
}

export function analyzeMarkdownQuality(info: MarkdownInfo): string[] {
  const tips: string[] = [];

  if (info.headings.length === 0 && info.lineCount > 10) {
    tips.push('No headings found - consider adding document structure');
  }

  if (info.headings.length > 0 && info.headings[0].level !== 1) {
    tips.push('First heading should be level 1 (h1)');
  }

  const headingLevels = info.headings.map((h) => h.level);
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) {
      tips.push(`Heading level jump at line ${info.headings[i].line} (from h${headingLevels[i - 1]} to h${headingLevels[i]})`);
      break;
    }
  }

  const brokenLinks = info.links.filter((l) => l.url.startsWith('http') && !l.url.includes('.'));
  if (brokenLinks.length > 0) {
    tips.push(`${brokenLinks.length} potentially malformed URLs found`);
  }

  if (info.codeBlocks.length === 0 && info.lineCount > 30) {
    tips.push('No code blocks found - consider adding examples');
  }

  if (info.lineCount > 200 && info.headings.length < 3) {
    tips.push('Long document with few headings - consider adding sections');
  }

  return tips;
}
