FROM node:22-alpine
WORKDIR /app
COPY package.json *.js *.cjs *.css *.html ./
ENV NODE_ENV=production
EXPOSE 10000
USER node
CMD ["node","server.cjs"]
