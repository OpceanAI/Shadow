/**
 * Sample TypeScript module for testing Shadow analyzer.
 */
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { User, CreateUserDto } from './models/user';
import { config } from './config';
import { logger } from './utils/logger';
import path from 'path';
import fs from 'fs';

const API_KEY = process.env.TSAPP_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

const prisma = new PrismaClient();
const app = express();

interface QueryParams {
  page: number;
  limit: number;
  sort?: string;
}

export class UserService {
  private db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    return this.db.user.create({ data: dto });
  }

  async fetchExternalUsers(): Promise<User[]> {
    const response = await axios.get('https://jsonplaceholder.typicode.com/users');
    return response.data.map((u: any) => ({
      id: String(u.id),
      name: u.name,
      email: u.email,
    }));
  }
}

export class AppConfig {
  static load(): Record<string, string> {
    return {
      port: process.env.PORT || '3000',
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  }
}

export function createApp() {
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  return app;
}

export const defaultConfig = {
  port: 3000,
  host: 'localhost',
};

async function main(): Promise<void> {
  const appConfig = AppConfig.load();
  const userService = new UserService(prisma);
  const app = createApp();

  app.listen(appConfig.port, () => {
    console.log(`Server running on port ${appConfig.port}`);
  });
}

const arrowFunction = (x: number): number => x * 2;

if (require.main === module) {
  main();
}

export { main };
