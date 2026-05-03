import { Command } from 'commander';
import { writeFile } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import * as path from 'path';

export function scaffoldCommand(program: Command): void {
  program
    .command('scaffold <template>')
    .description('Generate project boilerplate')
    .option('--language <lang>', 'Programming language')
    .option('--framework <name>', 'Framework to use')
    .option('--output <dir>', 'Output directory', process.cwd())
    .option('--json', 'JSON output')
    .action(async (template, options) => {
      const outputDir = options.output;
      const generated: string[] = [];

      const templates: Record<string, () => Array<{ path: string; content: string }>> = {
        'api-server': () => generateAPIServer(options.language, options.framework),
        'cli-tool': () => generateCLITool(options.language, options.framework),
        'react-app': () => generateReactApp(),
        'python-ml': () => generatePythonML(),
      };

      const generator = templates[template];
      if (!generator) {
        console.log(chalk.red(`Unknown template: ${template}`));
        console.log(chalk.dim(`Available: ${Object.keys(templates).join(', ')}`));
        return;
      }

      const files = generator();
      for (const file of files) {
        const fullPath = path.join(outputDir, file.path);
        writeFile(fullPath, file.content);
        generated.push(file.path);
      }

      if (options.json) {
        printJSON({ template, files: generated });
        return;
      }

      console.log(chalk.bold.blue(`\n[shadow scaffold] ${template}\n`));
      console.log(chalk.green(`Generated ${generated.length} files:`));
      for (const f of generated) {
        console.log(`  ${chalk.cyan('✓')} ${f}`);
      }
      console.log(chalk.dim(`\n  cd ${outputDir} && npm install`));
      console.log('');
    });
}

function generateAPIServer(lang: string, framework: string): Array<{ path: string; content: string }> {
  if (lang === 'python') {
    return [
      {
        path: 'main.py',
        content: `from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/")\ndef root():\n    return {"status": "ok"}\n\n@app.get("/health")\ndef health():\n    return {"status": "healthy"}\n\nif __name__ == "__main__":\n    import uvicorn\n    uvicorn.run(app, host="0.0.0.0", port=8000)\n`,
      },
      {
        path: 'requirements.txt',
        content: 'fastapi==0.115.0\nuvicorn==0.30.0\n',
      },
      {
        path: 'Dockerfile',
        content: `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nCMD ["python", "main.py"]\n`,
      },
    ];
  }
  return [
    {
      path: 'src/index.ts',
      content: `import express from 'express';\n\nconst app = express();\nconst port = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get('/', (req, res) => {\n  res.json({ status: 'ok' });\n});\n\napp.get('/health', (req, res) => {\n  res.json({ status: 'healthy' });\n});\n\napp.listen(port, () => {\n  console.log(\`Server running on port \${port}\`);\n});\n`,
    },
    {
      path: 'package.json',
      content: `{\n  "name": "api-server",\n  "version": "1.0.0",\n  "scripts": {\n    "start": "ts-node src/index.ts",\n    "build": "tsc",\n    "dev": "ts-node-dev src/index.ts"\n  },\n  "dependencies": {\n    "express": "^4.21.0"\n  },\n  "devDependencies": {\n    "@types/express": "^4.17.21",\n    "@types/node": "^22.0.0",\n    "ts-node": "^10.9.2",\n    "typescript": "^5.7.0"\n  }\n}\n`,
    },
    {
      path: 'tsconfig.json',
      content: `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "commonjs",\n    "outDir": "./dist",\n    "rootDir": "./src",\n    "strict": true,\n    "esModuleInterop": true\n  },\n  "include": ["src/**/*"]\n}\n`,
    },
  ];
}

function generateCLITool(lang: string, framework: string): Array<{ path: string; content: string }> {
  return [
    {
      path: 'src/index.ts',
      content: `#!/usr/bin/env node\nimport { Command } from 'commander';\n\nconst program = new Command();\n\nprogram\n  .name('mycli')\n  .description('My CLI tool')\n  .version('1.0.0');\n\nprogram\n  .command('hello')\n  .description('Say hello')\n  .action(() => {\n    console.log('Hello, world!');\n  });\n\nprogram.parse(process.argv);\n`,
    },
    {
      path: 'package.json',
      content: `{\n  "name": "mycli",\n  "version": "1.0.0",\n  "bin": { "mycli": "./dist/index.js" },\n  "scripts": {\n    "build": "tsc",\n    "start": "node dist/index.js"\n  },\n  "dependencies": {\n    "commander": "^12.1.0"\n  },\n  "devDependencies": {\n    "@types/node": "^22.0.0",\n    "typescript": "^5.7.0"\n  }\n}\n`,
    },
    {
      path: 'tsconfig.json',
      content: `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "commonjs",\n    "outDir": "./dist",\n    "rootDir": "./src",\n    "strict": true\n  },\n  "include": ["src/**/*"]\n}\n`,
    },
  ];
}

function generateReactApp(): Array<{ path: string; content: string }> {
  return [
    {
      path: 'src/App.tsx',
      content: `import React from 'react';\n\nfunction App() {\n  return (\n    <div>\n      <h1>My App</h1>\n      <p>Welcome to your new React app!</p>\n    </div>\n  );\n}\n\nexport default App;\n`,
    },
    {
      path: 'src/index.tsx',
      content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nconst root = ReactDOM.createRoot(document.getElementById('root')!);\nroot.render(<React.StrictMode><App /></React.StrictMode>);\n`,
    },
    {
      path: 'package.json',
      content: `{\n  "name": "react-app",\n  "version": "1.0.0",\n  "scripts": {\n    "start": "react-scripts start",\n    "build": "react-scripts build"\n  },\n  "dependencies": {\n    "react": "^19.0.0",\n    "react-dom": "^19.0.0",\n    "react-scripts": "^5.0.1"\n  },\n  "devDependencies": {\n    "@types/react": "^19.0.0",\n    "@types/react-dom": "^19.0.0",\n    "typescript": "^5.7.0"\n  }\n}\n`,
    },
    {
      path: 'tsconfig.json',
      content: `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "esnext",\n    "jsx": "react-jsx",\n    "strict": true,\n    "esModuleInterop": true\n  },\n  "include": ["src/**/*"]\n}\n`,
    },
    {
      path: 'public/index.html',
      content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>React App</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>\n`,
    },
  ];
}

function generatePythonML(): Array<{ path: string; content: string }> {
  return [
    {
      path: 'train.py',
      content: `import numpy as np\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.metrics import accuracy_score\n\n\ndef main():\n    # TODO: Load your data\n    X = np.random.rand(100, 5)\n    y = (X[:, 0] + X[:, 1] > 1).astype(int)\n\n    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)\n\n    model = LogisticRegression()\n    model.fit(X_train, y_train)\n\n    y_pred = model.predict(X_test)\n    acc = accuracy_score(y_test, y_pred)\n    print(f"Accuracy: {acc:.4f}")\n\n\nif __name__ == "__main__":\n    main()\n`,
    },
    {
      path: 'requirements.txt',
      content: `numpy==1.26.0\nscikit-learn==1.5.0\npandas==2.2.0\nmatplotlib==3.9.0\n`,
    },
    {
      path: 'notebook.ipynb',
      content: JSON.stringify({
        cells: [
          {
            cell_type: 'code',
            source: ['# ML Notebook\nimport numpy as np\nimport pandas as pd\n'],
            metadata: {},
            execution_count: null,
            outputs: [],
          },
        ],
        metadata: { language_info: { name: 'python' } },
        nbformat: 4,
        nbformat_minor: 5,
      }, null, 2),
    },
  ];
}
