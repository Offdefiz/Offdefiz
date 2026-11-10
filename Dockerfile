FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=10000 BIND_HOST=0.0.0.0
EXPOSE 10000
USER node
CMD ["npm", "start"]
