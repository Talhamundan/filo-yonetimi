import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// .env dosyasındaki değişkenleri manuel olarak yüklüyoruz
dotenv.config();

export default defineConfig({
  datasource: {
    // URL'in geldiğinden emin oluyoruz
    url: process.env.DATABASE_URL,
  },
});