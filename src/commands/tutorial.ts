import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { printSuccess, printSectionHeader, printDivider, printWarning } from '../output/human';

interface TutorialStep {
  step: number;
  title: string;
  description: string;
  instruction: string;
  hint?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    step: 1,
    title: 'Welcome to Shadow',
    description:
      'Shadow is a CLI tool that helps you understand, trace, test, and improve any codebase from your terminal.',
    instruction: 'Press Enter to continue through the tutorial.',
    hint: 'You can type "skip" to skip the rest of the tutorial.',
  },
  {
    step: 2,
    title: 'Inspecting Your Project',
    description:
      "The 'shadow info' command gives you a bird's-eye view of your codebase: language, files, imports, environment variables, and external API calls.",
    instruction: 'Try running: shadow . --info',
    hint: 'Use --json for machine-readable output or --short for a one-liner.',
  },
  {
    step: 3,
    title: 'Analyzing a Single File',
    description:
      "You can drill into individual files to see what they do, what they import, and what functions and classes they define.",
    instruction: 'Try running: shadow info <path_to_a_file>',
    hint: 'Use --env to see environment variables or --deps for dependencies.',
  },
  {
    step: 4,
    title: 'Dependency Graphs',
    description:
      "The 'shadow graph' command visualizes how your files connect — what imports what, which files read environment variables, and what external APIs are called.",
    instruction: 'Try running: shadow graph --output dot',
    hint: 'Pipe the output: shadow graph --output dot | dot -Tpng > graph.png',
  },
  {
    step: 5,
    title: 'Tracing Execution',
    description:
      "Shadow can trace any command and show you what files it accesses, what network calls it makes, and what environment variables it reads.",
    instruction: 'Try running: shadow trace --help',
    hint: 'Use --domain network to see only network events.',
  },
  {
    step: 6,
    title: 'AI-Powered Insights',
    description:
      "If you have an AI provider configured, you can ask natural language questions about your codebase.",
    instruction: 'Try: shadow ai "Summarize the key modules in this codebase"',
    hint: 'Set your provider in .shadow/config.json: { "aiProvider": "openai" }',
  },
  {
    step: 7,
    title: 'Test Generation',
    description:
      "Shadow can generate tests for your code, including unit tests, fuzz tests, and security tests.",
    instruction: 'Try: shadow test --help',
    hint: 'Use --ai for AI-powered test generation.',
  },
  {
    step: 8,
    title: 'Git Integration',
    description:
      'Shadow understands git. Get commit message suggestions, review diffs, and analyze history.',
    instruction: 'Try: shadow commit (in a git repo with staged changes)',
    hint: 'Use shadow blame to see who wrote each line.',
  },
  {
    step: 9,
    title: 'Configuration',
    description:
      'Shadow stores configuration in .shadow/config.json, .shadowrc, or .shadowrc.json.',
    instruction:
      'Create a config file to set your preferred AI provider, output format, theme, and more.',
    hint: 'Run "shadow info --help" to see all configurable options.',
  },
  {
    step: 10,
    title: 'Tutorial Complete',
    description:
      'You now know the basics of Shadow CLI! Use --help on any command for more details.',
    instruction: 'Happy coding! Run "shadow --help" to see all available commands.',
    hint: 'Check out the docs at https://github.com/OpceanAI/Shadow',
  },
];

const PROGRESS_FILE = path.join(process.cwd(), '.shadow', 'tutorial-progress.json');

function loadProgress(): number {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return data.currentStep || 0;
    }
  } catch {
    // Ignore parse errors
  }
  return 0;
}

function saveProgress(step: number): void {
  const shadowDir = path.join(process.cwd(), '.shadow');
  try {
    if (!fs.existsSync(shadowDir)) {
      fs.mkdirSync(shadowDir, { recursive: true });
    }
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ currentStep: step, completedAt: new Date().toISOString() }), 'utf-8');
  } catch (err) {
    console.warn(chalk.yellow(`Warning: could not save tutorial progress: ${(err as Error).message}`));
  }
}

function printStep(step: TutorialStep): void {
  printDivider();
  printSectionHeader(`Step ${step.step}: ${step.title}`);
  console.log(chalk.dim('─'.repeat(60)));
  console.log();
  console.log(chalk.white(step.description));
  console.log();
  console.log(chalk.cyan(step.instruction));
  if (step.hint) {
    console.log(chalk.dim(`💡 Hint: ${step.hint}`));
  }
  console.log();
}

async function waitForInput(prompt: string = 'Press Enter to continue...'): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.dim(prompt), (answer: string) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export function tutorialCommand(program: Command): void {
  program
    .command('tutorial')
    .description('Interactive tutorial to learn Shadow CLI')
    .option('--reset', 'Reset tutorial progress')
    .action(async (options) => {
      if (options.reset) {
        try {
          if (fs.existsSync(PROGRESS_FILE)) {
            fs.unlinkSync(PROGRESS_FILE);
          }
          printSuccess('Tutorial progress reset.');
        } catch {
          printWarning('Could not reset progress file.');
        }
        return;
      }

      let currentStep = loadProgress();

      if (currentStep > 0 && currentStep < TUTORIAL_STEPS.length) {
        console.log(chalk.dim(`Resuming from step ${currentStep}...`));
        console.log();
      }

      if (currentStep >= TUTORIAL_STEPS.length) {
        printSuccess('You have already completed the tutorial!');
        console.log(chalk.dim('Use --reset to start over.'));
        return;
      }

      for (const step of TUTORIAL_STEPS.slice(currentStep)) {
        printStep(step);

        const answer = await waitForInput();

        if (answer === 'skip') {
          printWarning('Skipping remaining tutorial steps.');
          saveProgress(TUTORIAL_STEPS.length);
          return;
        }

        if (answer === 'quit' || answer === 'exit') {
          console.log(chalk.dim('Tutorial paused. Run "shadow tutorial" to resume.'));
          saveProgress(step.step - 1);
          return;
        }

        saveProgress(step.step);
      }

      printDivider();
      printSuccess('Tutorial complete!');
      console.log(chalk.dim('Run "shadow --help" to explore all commands.'));
    });
}
