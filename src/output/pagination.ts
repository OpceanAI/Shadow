import * as readline from 'readline';

export interface PaginationOptions {
  pageSize?: number;
  searchEnabled?: boolean;
  title?: string;
  stream?: NodeJS.WriteStream;
}

export function paginate(lines: string[], options: PaginationOptions = {}): void {
  const pageSize = options.pageSize || getTerminalHeight() - 3;
  const title = options.title || '';
  const stream = options.stream || process.stdout;

  if (options.searchEnabled) {
    const rl = readline.createInterface({ input: process.stdin, output: stream });
    let currentIndex = 0;
    renderPage(lines, currentIndex, pageSize, title, stream);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key: string) => {
      switch (key) {
        case '\u001B[A':
        case 'k':
          currentIndex = Math.max(0, currentIndex - 1);
          break;
        case '\u001B[B':
        case 'j':
          currentIndex = Math.min(lines.length - pageSize, currentIndex + 1);
          break;
        case '\u001B[5~':
        case ' ':
          currentIndex = Math.min(lines.length - pageSize, currentIndex + pageSize);
          break;
        case '\u001B[6~':
        case 'b':
          currentIndex = Math.max(0, currentIndex - pageSize);
          break;
        case 'g':
          currentIndex = 0;
          break;
        case 'G':
          currentIndex = Math.max(0, lines.length - pageSize);
          break;
        case '/': {
          searchInLines(lines, rl, stream).then((foundIndex) => {
            if (foundIndex >= 0) {
              currentIndex = Math.max(0, Math.min(foundIndex - Math.floor(pageSize / 2), lines.length - pageSize));
            }
            renderPage(lines, currentIndex, pageSize, title, stream);
            process.stdin.setRawMode(true);
            process.stdin.resume();
          });
          return;
        }
        case 'q':
        case '\u0003':
          cleanup(rl);
          return;
        default:
          break;
      }
      currentIndex = Math.max(0, Math.min(currentIndex, lines.length - pageSize));
      renderPage(lines, currentIndex, pageSize, title, stream);
    });
  } else {
    for (const line of lines) {
      stream.write(line + '\n');
    }
  }
}

function renderPage(
  lines: string[],
  start: number,
  pageSize: number,
  title: string,
  stream: NodeJS.WriteStream
): void {
  readline.cursorTo(stream, 0, 0);
  readline.clearScreenDown(stream);

  if (title) {
    stream.write(`\u001B[1m${title}\u001B[0m\n`);
    stream.write('\u001B[90m' + '─'.repeat(process.stdout.columns || 80) + '\u001B[0m\n');
  }

  const end = Math.min(start + pageSize, lines.length);
  for (let i = start; i < end; i++) {
    stream.write(lines[i] + '\n');
  }

  const percent = lines.length > 0 ? Math.round((end / lines.length) * 100) : 100;
  const statusLine = `\u001B[7m Lines ${start + 1}-${end} of ${lines.length} (${percent}%)  q:quit  /:search  ↑↓:scroll \u001B[0m`;
  stream.write(statusLine);
}

async function searchInLines(
  lines: string[],
  rl: readline.Interface,
  stream: NodeJS.WriteStream
): Promise<number> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(false);
    const prevLine = readline.cursorTo(stream, 0, stream.rows || 0);
    stream.write('\nSearch: ');
    rl.question('', (query: string) => {
      if (!query) {
        resolve(-1);
        return;
      }
      const lowerQuery = query.toLowerCase();
      const foundIndex = lines.findIndex((line) => line.toLowerCase().includes(lowerQuery));
      resolve(foundIndex);
    });
  });
}

function cleanup(rl: readline.Interface): void {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  rl.close();
  process.exit(0);
}

function getTerminalHeight(): number {
  return process.stdout.rows || 24;
}

export function formatPaged(lines: string[], pageSize?: number): string[] {
  const totalPages = Math.ceil(lines.length / (pageSize || 24));
  return [
    ...lines,
    '',
    `--- Page info: ${lines.length} lines, ${totalPages} pages ---`,
  ];
}

export function paginateOutput(output: string, options: PaginationOptions = {}): void {
  const lines = output.split('\n');
  paginate(lines, options);
}
