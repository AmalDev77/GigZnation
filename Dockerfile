FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* bun.lock* ./
RUN npm install
COPY . .
ARG VITE_SUPABASE_URL="https://tafyexasntvknzusreut.supabase.co"
ARG VITE_SUPABASE_PROJECT_ID="tafyexasntvknzusreut"
ARG VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZnlleGFzbnR2a256dXNyZXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTM5NzEsImV4cCI6MjA5MDI4OTk3MX0.6zMfyL8iW9wJ3PZf0MuxluK_hChnjw0hfft_9_xFU8s"
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
