FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build for production
RUN npm run build

ENV PORT 8511
EXPOSE 8511

CMD ["npm", "run", "start"]
