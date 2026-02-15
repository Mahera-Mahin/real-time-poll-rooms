# Use official Node image
FROM node:20-alpine

WORKDIR /app

# Copy all files first
COPY . .

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["node", "server.js"]
