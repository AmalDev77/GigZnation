FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* bun.lock* ./
RUN npm install
COPY . .
ARG VITE_SUPABASE_URL="https://api.gigznation.com"
ARG VITE_SUPABASE_PROJECT_ID="gigznation"
ARG VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgzNjc2NDYzLCJleHAiOjIwOTkwMzY0NjN9.y9PKrA4TBmziVwgP7UHd1fMRMW_a5NbqHEM3BAumAL8"
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
