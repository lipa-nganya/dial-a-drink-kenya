FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG REACT_APP_API_URL=https://deliveryos-production-backend-805803410802.us-central1.run.app/api
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

FROM nginx:1.25-alpine

ENV PORT=8080
EXPOSE 8080

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy nginx config (listens on port 8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app
COPY --from=builder /app/build /usr/share/nginx/html

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
