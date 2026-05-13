FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

ENV PORT=3001
ENV UPLOADS_DIR=/uploads

EXPOSE 3001

CMD ["npm", "run", "start"]
