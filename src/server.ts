import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { testConnection } from './config/database';

const PORT = parseInt(process.env.PORT || '3000');

async function startServer(): Promise<void> {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`\n🚀 CSA App running at http://localhost:${PORT}`);
      console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Database    : ${process.env.DB_NAME || 'csa_app'}`);
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
