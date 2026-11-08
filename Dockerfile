# Production image: builds the web app and runs the Express server (API + pages).
FROM node:24-bookworm-slim

WORKDIR /app
# Font for subtitles burned into videos (ffmpeg/libass needs a system font); Python for "Quitar fondo"
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core python3 python3-venv && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

# "Quitar fondo" runs server/python/quitar_fondo.py (rembg). The model is downloaded here, at build time.
ENV PYTHON_BIN=/opt/rembg/bin/python U2NET_HOME=/opt/rembg/models
COPY server/python/requirements.txt server/python/
RUN python3 -m venv /opt/rembg \
  && /opt/rembg/bin/pip install --no-cache-dir -r server/python/requirements.txt \
  && /opt/rembg/bin/python -c "from rembg import new_session; new_session('isnet-general-use')"

COPY package.json package-lock.json ./
# Dev dependencies are needed for the Vite build; they are removed afterwards
RUN npm ci --include=dev

COPY . .
# Vite inlines these public values into the web app at build time (.env is not copied)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build && npm prune --omit=dev

# Users, purchases and uploads live in /app/server/data: mount a persistent volume
# there (Fly.io: [mounts] in fly.toml).

EXPOSE 3001
CMD ["node", "server/index.js"]
