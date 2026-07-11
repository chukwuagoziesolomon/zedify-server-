FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git && corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN node ace build --production --ignore-ts-errors

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git && corepack enable

COPY --from=builder /app/build ./

ENV NODE_ENV=production

RUN yarn install --production --frozen-lockfile

EXPOSE 3335

CMD ["node", "server.js"]
