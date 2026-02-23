FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Default to production, but can be overridden via --build-arg
ARG REACT_APP_API_URL=https://deliveryos-production-backend-805803410802.us-central1.run.app/api
ARG REACT_APP_GOOGLE_MAPS_API_KEY
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_GOOGLE_MAPS_API_KEY=${REACT_APP_GOOGLE_MAPS_API_KEY}
RUN npm run build

FROM nginx:1.25-alpine

ENV PORT=8080
EXPOSE 8080

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
