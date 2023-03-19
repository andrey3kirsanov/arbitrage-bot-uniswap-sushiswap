FROM node:16.18.0-slim
WORKDIR /usr/app
COPY .env .
COPY package.json .
COPY package-lock.json .
RUN npm install --production
COPY . .