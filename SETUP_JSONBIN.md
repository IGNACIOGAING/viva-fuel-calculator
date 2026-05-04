# Setup paso a paso — Backend con JSONBin.io

> **Objetivo:** que cada registro que carga un piloto en `index.html` aparezca automáticamente en `admin.html` (tu vista cross-piloto), usando un servicio gratis sin Microsoft ni Google.
>
> **Tiempo total:** ~5 minutos.

---

## Arquitectura

```
   Pilot tablet                       Cloud                       Admin laptop
  ┌──────────────┐         ┌────────────────────────┐        ┌──────────────────┐
  │ index.html   │────────►│ JSONBin.io (private    │◄───────│ admin.html       │
  │ (write-only) │  PUSH   │ bin con array JSON)    │ POLL   │ (read-only, 30s) │
  └──────────────┘         └────────────────────────┘        └──────────────────┘
```

- Cada piloto: ve **solo sus propios** registros (localStorage del dispositivo) y empuja cada save al bin.
- Vos como admin: ves **todos** los registros de todos los pilotos en `admin.html`, con filtros y CSV.

---

## Paso 1 — Cuenta en JSONBin (1 min)

1. Ir a <https://jsonbin.io>.
2. Clic **Sign up** (arriba a la derecha).
3. Email + password (no hace falta confirmar email para empezar).

Free tier: 10.000 requests / mes — alcanza para ~50 pilotos haciendo decenas de saves diarios.

---

## Paso 2 — Crear el bin (2 min)

1. Una vez logueado, vas al **Bin Browser** (menú izq).
2. Clic **Create a Bin** (botón verde).
3. En el editor JSON, **borrá** lo que tenga y pegá:

   ```json
   []
   ```

4. (Opcional pero recomendado) En la barra de **Settings** del bin:
   - **Private**: ON (default)
   - **Versioning**: ON (te da historial por si pasa algo)
   - **Bin Name**: `viva-fuel-records` (para reconocerlo)

5. Clic **Create**.
6. Cuando se crea, arriba ves el **Bin ID** (algo como `6713abcd1234567890abcdef`). **Copialo.**

---

## Paso 3 — Conseguir el Master API Key (1 min)

1. Menú izq → **API Keys**.
2. Vas a ver **Master Key** (algo tipo `$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxx`).
3. Clic en el ojito 👁 para mostrarla. **Copiala.**

> ⚠️ La Master Key da **acceso total** a tu cuenta JSONBin. Para una versión más segura, ver "Hardening" al final de este documento.

---

## Paso 4 — Pasame los datos (30 seg)

Pegá en el chat:

```
BIN_ID: 6713abcd1234567890abcdef
API_KEY: $2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Yo los pego en `dist/index.html` (línea ~1218 aprox., constantes `JSONBIN_BIN_ID` y `JSONBIN_API_KEY`), commit y push. En 1-2 minutos GitHub Pages tiene la versión nueva.

---

## Paso 5 — Probar (1 min)

1. Abrí en una pestaña: `https://ignaciogaing.github.io/viva-fuel-calculator/` (la app del piloto).
2. Abrí en otra pestaña: `https://ignaciogaing.github.io/viva-fuel-calculator/admin.html`
3. En `admin.html`, primera vez te pide Bin ID + Master Key. Pegá los mismos del paso 4. Clic **Connect**.
4. En la pestaña del piloto, llená un registro de prueba con un Pilot ID y dale **Log load**.
5. Mirá la pill arriba de la tabla:
   - **"Syncing…"** → mandando al bin
   - **"Synced · cloud"** → llegó (aparece en admin.html en máximo 30s, o clic Refresh)
6. En `admin.html` el registro nuevo debería aparecer.

✅ **Listo.** Cada vez que un piloto guarde, en máximo 30s aparece en tu vista admin.

---

## Cómo funciona offline

- El piloto carga un registro **sin internet** → se guarda en `localStorage`, pill dice **"Offline · queued"** con un badge `1`, `2`, etc.
- Cuando el dispositivo recupera conexión:
  - Se dispara `online` event
  - La app vacía la cola en orden y los manda al bin
  - Pill pasa a "Syncing…" → "Synced · cloud"
  - Toast: "X pending records synced"
- Si la app está cerrada cuando vuelve la conexión, se sincroniza la próxima vez que la abran (`initialSync`).

El **Service Worker** (`sw.js`) además cachea el HTML, así la app abre sin internet a partir de la 2.ª visita.

---

## Cómo funciona la app admin

- `admin.html` consulta el bin entero cada **30 segundos** (auto-refresh).
- También refresca al volver a la pestaña (visibility change) y cuando recupera conexión.
- **Filtros** en vivo: pilot, flight, status, date range, búsqueda libre.
- **Stats** se actualizan según los filtros (no son del total, son del filtrado actual — es lo más útil para auditar).
- **Download CSV** exporta lo que está visible (filtrado), no todo.
- **Sign out** borra las credenciales del navegador (no del bin).

---

## Hardening (opcional, después de que esté andando)

La Master Key embebida públicamente significa que cualquiera con el HTML puede leer/escribir el bin. Para una versión más segura:

### Opción A — Access Keys con permisos por bin

JSONBin permite crear "Access Keys" con permisos específicos:

1. Menú izq → **Access Keys** → **Create**.
2. Crear una **write-only** key, scope = solo este bin.
3. Crear una **read-only** key, scope = solo este bin.
4. En `index.html` reemplazar la Master Key por la write-only.
5. En `admin.html` reemplazar por la read-only.

Resultado: si un piloto inspecciona el HTML, solo puede escribir, no leer registros ajenos.

### Opción B — Proxy con Cloudflare Worker

Mover las API keys a un Cloudflare Worker que actúa de proxy entre la HTML y JSONBin. Así las keys nunca salen del server. Tarda 20 min más de setup. Pedímelo cuando estemos en ese punto.

---

## Troubleshooting

### "Wrong API key or no access to this bin" en admin.html

- Verificá que el Bin ID es el correcto (sin espacios, sin comillas).
- Verificá que copiaste la **Master Key** completa (empieza con `$2a$10$` o similar).
- Si reseteaste la API key en JSONBin, todas las apps que la usaban dejan de funcionar — hay que actualizarlas.

### Pill del piloto queda en "Sync error"

1. Abrir DevTools → Network → buscar `api.jsonbin.io`.
2. Ver el código de error:
   - **401/403** → API key mal o expirada → repegar en `index.html`.
   - **404** → Bin ID mal o el bin se borró.
   - **429** → superaste el rate limit (no debería pasar con uso normal).
   - **CORS error** → JSONBin debería tener CORS habilitado por default; chequear si la URL es `https://api.jsonbin.io/v3/b/...`.

### Los pilotos NO ven los registros de los demás

Eso es **correcto** y es por diseño. El piloto solo ve los suyos (localStorage). Si querés que los pilotos también vean a todos, decímelo y agrego una vista "shared history" toggleable.

### Quiero "borrar" un registro mal cargado

Por ahora no hay UI de delete. Workaround:

1. Ir a jsonbin.io → tu bin → editor.
2. Editar el JSON y borrar el objeto del array.
3. Save.
4. En 30s, admin.html refleja el cambio.

Si esto es frecuente, decímelo y agrego botón de delete en `admin.html` (con confirmación).

### Quiero un bin DISTINTO para staging vs prod

1. Crear un bin nuevo en jsonbin.io.
2. Mantener dos branches en GitHub: `main` (prod) y `staging`.
3. Cada branch tiene sus propias constantes JSONBIN_BIN_ID.

---

## Comandos útiles para testear desde la consola

Abrir DevTools en cualquier pestaña y pegar:

```js
// Listar todo lo que hay en el bin
fetch('https://api.jsonbin.io/v3/b/TU_BIN_ID/latest', {
  headers: { 'X-Master-Key': 'TU_API_KEY', 'X-Bin-Meta': 'false' }
}).then(r => r.json()).then(console.log);

// Vaciar el bin (CUIDADO: irreversible)
fetch('https://api.jsonbin.io/v3/b/TU_BIN_ID', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-Master-Key': 'TU_API_KEY' },
  body: '[]'
});
```
