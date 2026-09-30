FROM node:24-alpine AS client-builder

WORKDIR /app
RUN apk upgrade --no-cache
# Yarn 1 calls url.parse(), which Node 24 deprecates (DEP0169)
ENV NODE_OPTIONS=--disable-warning=DEP0169
ENV YARN_CACHE_FOLDER=/tmp/yarn-cache

COPY vendor/guacamole-client/guacamole-common-js/ ./vendor/guacamole-client/guacamole-common-js/

WORKDIR /app/client

COPY client/package.json client/yarn.lock ./
RUN install_ok=0; \
    for i in 1 2 3; do \
      yarn install --frozen-lockfile --network-timeout 500000 && install_ok=1 && break; \
      yarn cache clean --all || true; \
      rm -rf "${YARN_CACHE_FOLDER}" || true; \
      sleep 15; \
    done; \
    [ "${install_ok}" -eq 1 ]; \
    yarn cache clean --all || true; \
    rm -rf "${YARN_CACHE_FOLDER}" || true

COPY client/ .
RUN yarn build

FROM node:24-alpine AS server-builder

ARG VERSION

WORKDIR /app
RUN apk upgrade --no-cache
ENV NODE_OPTIONS=--disable-warning=DEP0169
ENV YARN_CACHE_FOLDER=/tmp/yarn-cache

RUN apk add --no-cache \
    python3 py3-pip py3-setuptools \
    make g++ gcc build-base \
    jq

COPY package.json yarn.lock ./
RUN if [ -n "$VERSION" ]; then \
        jq --arg v "$VERSION" '.version = $v' package.json > tmp.json && mv tmp.json package.json; \
    fi
RUN install_ok=0; \
    for i in 1 2 3; do \
      yarn install --production --frozen-lockfile --network-timeout 500000 && install_ok=1 && break; \
      yarn cache clean --all || true; \
      rm -rf "${YARN_CACHE_FOLDER}" || true; \
      sleep 15; \
    done; \
    [ "${install_ok}" -eq 1 ]; \
    yarn cache clean --all || true; \
    rm -rf "${YARN_CACHE_FOLDER}" || true

COPY server/ server/

FROM node:24-alpine AS guacd-builder
RUN apk upgrade --no-cache

# guacd only serves RDP and VNC, the server handles terminals itself
RUN apk add --no-cache \
    cairo-dev jpeg-dev libpng-dev ossp-uuid-dev \
    libvncserver-dev libwebp-dev openssl-dev freerdp2-dev \
    pulseaudio-dev libvorbis-dev libogg-dev \
    build-base autoconf automake libtool

WORKDIR /build

COPY vendor/guacamole-server/ ./guacamole-server/

RUN cd guacamole-server \
    && autoreconf -fi \
    && ./configure --with-init-dir=/etc/init.d --prefix=/usr/local --disable-guacenc --disable-guaclog \
        --disable-kubernetes --without-ssh --without-telnet --without-terminal --without-pango --without-websockets \
        --without-libavcodec --without-libavformat --without-libavutil --without-libswscale \
    && make -j$(nproc) \
    && make DESTDIR=/install install \
    && rm -rf /install/usr/local/include \
    && rm -f /install/usr/local/lib/*.a \
    && rm -f /install/usr/local/lib/*.la \
    && rm -f /install/usr/local/*.md /install/usr/local/LICENSE \
    && strip /install/usr/local/sbin/guacd /install/usr/local/lib/*.so.* 2>/dev/null || true

FROM node:24-alpine
RUN apk upgrade --no-cache

RUN apk add --no-cache \
    cairo jpeg libpng ossp-uuid \
    libvncserver libwebp openssl freerdp2-libs \
    pulseaudio libvorbis libogg \
    samba-client su-exec

# a fresh data volume is handed to this user, see docker-start.sh
RUN addgroup -S -g 10001 infra-w && adduser -S -D -H -u 10001 -G infra-w -h /app infra-w

RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg

COPY --from=guacd-builder /install/usr/local/sbin/ /usr/local/sbin/
COPY --from=guacd-builder /install/usr/local/lib/ /usr/local/lib/
COPY --from=guacd-builder /install/usr/lib/freerdp2/ /usr/lib/freerdp2/

RUN ldconfig /usr/local/lib 2>/dev/null || true

ENV NODE_ENV=production
ENV LOG_LEVEL=system

WORKDIR /app

COPY --from=client-builder /app/client/dist ./dist

COPY --from=server-builder /app/server ./server
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/package.json ./
COPY --from=server-builder /app/yarn.lock ./

COPY docker-start.sh .

RUN chmod +x docker-start.sh

EXPOSE 6989 5878

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.SERVER_PORT || 6989) + '/api/service/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["/bin/sh", "docker-start.sh"]
