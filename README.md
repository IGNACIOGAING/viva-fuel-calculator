# Viva Aerobus · Fuel Loading Calculator

Calculadora de carga de combustible para uso de pilotos de Viva Aerobus + vista admin para auditar todos los registros en tiempo real.

## Páginas

| URL | Para quién | Qué hace |
|---|---|---|
| `index.html` | Pilotos | Calcula el rango de carga, valida con ground handler, deja registro local + push al backend compartido |
| `admin.html` | Operaciones / vos | Tabla en tiempo real con TODOS los registros de todos los pilotos, filtros, descarga CSV |

## Acceso

GitHub Pages, sin login ni instalación. Funciona en cualquier navegador moderno (desktop, tablet, mobile).

## Cómo se usa (piloto)

1. Setear el **Pilot ID** la primera vez (queda persistido en el dispositivo).
2. Ingresar número de vuelo, FR (KG) y FOB (KG).
3. Pedir la densidad por radio/teléfono al ground handler.
4. La calculadora devuelve el **rango en litros** (low end / high end, ±1.75%) que el piloto le comunica al ground handler.
5. Apretar **Log load** → queda guardado local + se sube al backend compartido.
6. Si el ground handler no se comunica, el piloto deja constancia con **No info from GH** (solo requiere flight number).
7. El histórico de su dispositivo se descarga como CSV cuando lo necesite.

## Cómo se usa (admin)

1. Abrir `admin.html` (URL: `<base>/admin.html`).
2. Primera vez pide Bin ID + Master API Key del JSONBin → quedan guardados localmente.
3. Tabla con TODOS los registros, auto-refresh cada 30 s.
4. Filtros por piloto, vuelo, status, rango de fechas y búsqueda libre.
5. Stats arriba (Total / Hoy / Pilotos activos / Incidentes No-info) calculadas según el filtro actual.
6. Botón **Download CSV** exporta lo filtrado.
7. Botón **Sign out** olvida las credenciales en este navegador (no toca el bin).

## Fórmula

```
TOTAL_KG  = FOB − FR
TOTAL_L   = (TOTAL_KG + 200) / densidad
LOW_END   = TOTAL_L × (1 − 0.0175)
HIGH_END  = TOTAL_L × (1 + 0.0175)
```

## Notas técnicas

- HTMLs autocontenidos (HTML + CSS + JS inline). Logo embebido como data URI.
- **Service Worker** (`sw.js`) cachea la app del piloto: carga sin internet a partir de la 2.ª visita.
- Pilotos: cada save va a `localStorage` y al backend. Si está offline, queda encolado y se manda al volver la conexión (auto-resync).
- Admin: solo lee del backend, nunca escribe.
- Compatibilidad: Chrome, Edge, Safari, Firefox modernos.

## Backend compartido (JSONBin)

La sincronización pasa por un **bin de JSONBin.io** (free tier). Se configuran dos constantes en `index.html` y `admin.html`:

```js
const JSONBIN_BIN_ID  = '...';
const JSONBIN_API_KEY = '...';
```

Mientras estén vacías, la app corre en **modo local** (cada tablet ve solo lo suyo, admin pide credenciales).

Pasos completos: [`SETUP_JSONBIN.md`](./SETUP_JSONBIN.md) (5 minutos).
