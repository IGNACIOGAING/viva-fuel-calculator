# Setup paso a paso — SharePoint Excel + Power Automate

> **Objetivo:** que cada registro que carga un piloto en la web app se guarde **automáticamente** en el Excel de SharePoint (`A4` títulos, `A5..` registros), sin que los pilotos tengan que loguearse.
>
> **Cómo:** un flow de Power Automate con trigger HTTP (URL pública anónima) corre con tu cuenta McKinsey y escribe en el Excel cada vez que la HTML hace `POST`.
>
> **Qué necesitás vos** (~10–15 min):
> 1. Acceso al Excel de SharePoint con permiso **Edit**.
> 2. Acceso a Power Automate (`make.powerautomate.com`).
> 3. Office Script ya creado en el Excel (paso 1 abajo).

---

## Tabla de contenidos

- [Camino A — Office Script + Run script](#camino-a) ← **recomendado**, más control
- [Camino B — Excel Table + Add a row](#camino-b) ← más simple si Camino A no anda
- [Paso final común — Cablear la URL en la HTML](#paso-final)
- [Troubleshooting](#troubleshooting)

---

## Antes de arrancar — datos del Excel que tenés que tener a mano

Tu Excel está en esta URL:

```
https://mckinsey.sharepoint.com/:x:/s/spe-int-nu8lxwa6h9wfzr1/IQDT5U26Ny07TYEMFmWLjOszAcpoomAl5fXrzftd-fdgrx8?e=pdgfEi
```

De ahí salen tres datos clave que vas a necesitar:

| Dato | Valor extraído de la URL |
|---|---|
| **Tenant** | `mckinsey.sharepoint.com` |
| **Site URL completa** | `https://mckinsey.sharepoint.com/sites/spe-int-nu8lxwa6h9wfzr1` |
| **Site name (para buscar en dropdowns)** | `spe-int-nu8lxwa6h9wfzr1` (es un nombre interno; en la UI puede aparecer con un display name distinto, ej. "Fuel Discrepancy" o el nombre del Team que lo creó) |

> Tip: si abrís el Excel en el navegador y mirás la barra de URL después de que termine de cargar, vas a ver la URL "real" del archivo (sin el token de share). Esa es la que tenés que reconocer en los dropdowns de Power Automate.

---

<a id="camino-a"></a>

# Camino A — Office Script + Run script  *(recomendado)*

## Paso A.1 — Crear el Office Script en el Excel

1. Abrí el Excel de SharePoint en el navegador.
2. Ubicate en la **hoja** donde van a vivir los registros (puede ser `Sheet1`).
3. Pestaña **Automate** → botón **New Script** (a la izquierda).
4. Borrá el código de ejemplo y pegá **TODO** el contenido del archivo [`office-script-fuel-records.ts`](./office-script-fuel-records.ts).
5. Arriba a la derecha, en el nombre del script (donde dice "Script 1" o similar), renombralo a **`Fuel Records Handler`**.
6. Botón **Save Script**.
7. (Opcional pero recomendado para verificar) Hacé clic en **Run** para chequear que no tira error de sintaxis. Es normal que devuelva `{ ok: false, error: "Unknown action: " }` — eso confirma que el script corrió bien.

> ✅ El script entiende dos comandos:
> - `{ action: "add", record: {...} }` → agrega 1 fila debajo de los títulos.
> - `{ action: "list" }` → devuelve todos los registros como JSON.

## Paso A.2 — Crear el flow de Power Automate

1. Andá a <https://make.powerautomate.com> con tu cuenta McKinsey.
2. **+ Create** (menú izquierdo) → **Instant cloud flow**.
3. Ponele nombre: `Viva Fuel Records Webhook`.
4. En "Choose how to trigger this flow" buscá y seleccioná **"When a HTTP request is received"** (icono morado de Request).
5. Clic en **Create**.

### A.2.1 — Configurar el trigger HTTP

Te abre el editor del flow con el trigger ya puesto. Hacé clic en el bloque del trigger para expandirlo y completá:

- **Method:** dejalo en *Default* (sirve POST por default), o seleccioná `POST` explícito.
- **Request Body JSON Schema:** clic en *"Use sample payload to generate schema"* y pegá:

```json
{
  "action": "add",
  "record": {
    "timestamp": "2026-04-29T10:30:00",
    "flight": "VB1234",
    "fr": 3500,
    "fob": 8500,
    "totalKg": 5000,
    "density": 0.793,
    "totalL": 6557,
    "lowL": 6442,
    "highL": 6671,
    "status": "OK",
    "id": "1714421200000"
  }
}
```

Clic en **Done**. Power Automate genera el schema solo.

### A.2.2 — Acción "Run script"

1. **+ New step** debajo del trigger.
2. En el buscador escribí: `excel`.
3. Seleccioná el conector verde **Excel Online (Business)**.
4. En la lista de acciones, seleccioná **Run script** (NO "Run script from a SharePoint library").

Ahora viene la parte donde nos trabamos antes. Configurá los campos en este orden EXACTO **usando los dropdowns y el file picker — NO copiar/pegar texto a mano**:

#### a) Location

- Clic en el dropdown **Location**.
- En la lista, buscá tu site. Probablemente NO se llame `spe-int-nu8lxwa6h9wfzr1` literal; tiene un display name. Buscá por palabras clave del proyecto.
- **Si NO lo encontrás** en la lista:
  - Scroll hasta el final del dropdown → opción **"Enter custom value"** (o un cuadrito de texto).
  - Pegá la URL completa del site:
    ```
    https://mckinsey.sharepoint.com/sites/spe-int-nu8lxwa6h9wfzr1
    ```
  - Apretá Enter.

> ⚠️ **No selecciones "Austin Office Intranet" ni ningún otro site al azar.** Tiene que ser EL site donde está físicamente el Excel.

#### b) Document Library

- Una vez que la Location está bien, este dropdown se autopopula con las libraries del site.
- Elegí la library donde está el Excel (típicamente **"Documents"** o **"Shared Documents"**).
- **NO escribas a mano** — usá el dropdown.

#### c) File

- Clic en el ícono **📁 (carpeta)** a la derecha del campo File.
- Se abre un explorador con el contenido de la library.
- Navegá hasta el Excel y clic en él.
- El campo se llena automáticamente con un path tipo `/Documents/Fuel Records.xlsx`.

#### d) Script

- Dropdown → seleccioná **`Fuel Records Handler`**.
- ⚠️ **Aunque ya estuviera elegido**, abrí el dropdown y volvé a clickearlo — eso fuerza a Power Automate a re-leer la firma del script.

#### e) payloadJson  ← **el campo que antes no aparecía**

Apenas elegís el script en (d), Power Automate lee la firma de la función `main(workbook, payloadJson)` y **agrega un input nuevo abajo**, etiquetado **`payloadJson`**.

- Clic dentro del campo `payloadJson`.
- Se abre un panel a la derecha con dos pestañas: **Dynamic content** y **Expression** (fx).
- **Camino visual** (recomendado): pestaña **Dynamic content** → en la sección "When a HTTP request is received" → clic en **`Body`**. Aparece un token azul que dice "Body".
- **Camino fórmula** (alternativo): pestaña **Expression** → escribí `triggerBody()` → **OK**.

> ⚠️ Si te tira un error tipo "expected string, got object" cuando lo guardes, cambiá la expresión a `string(triggerBody())`. El Office Script igual lo parsea como JSON.

### A.2.3 — Acción "Response"

1. **+ New step** debajo de Run script.
2. En el buscador: `response`.
3. Seleccioná **Request → Response**.

Configurá:

- **Status Code:** `200`
- Clic en **Show advanced options**.
- En **Headers** agregá tres headers (click en `+ Add new item` por cada uno):

| Key | Value |
|---|---|
| `Content-Type` | `application/json` |
| `Access-Control-Allow-Origin` | `*` |
| `Access-Control-Allow-Methods` | `POST, OPTIONS` |

- **Body:** clic en el campo → en Dynamic content → buscá la salida de Run script → seleccioná **`result`**.

> Si no ves "result", buscá "Run script" en Dynamic content y vas a ver una opción ahí.

### A.2.4 — Guardar y probar

1. Botón **Save** (arriba a la derecha).
2. Una vez guardado, volvé a expandir el bloque del trigger HTTP. Ahora tiene un campo nuevo: **HTTP POST URL**.
3. Clic en el ícono de copiar a la derecha de la URL.
4. Test rápido (opcional, desde la consola del navegador):
   ```js
   fetch('TU_URL_AQUI', {
     method: 'POST',
     headers: { 'Content-Type': 'text/plain' },
     body: JSON.stringify({ action: 'list' })
   }).then(r => r.json()).then(console.log);
   ```
   Si devuelve `{ ok: true, records: [] }` → todo OK, andá al [Paso final](#paso-final).

> ⚠️ La URL incluye un token (`sig=...`). **Tratala como un secreto.** Si se filtra, regenerá el flow y obtené una nueva.

---

<a id="camino-b"></a>

# Camino B — Excel Table + Add a row  *(plan B)*

Si Camino A te trabó (no aparece el campo `payloadJson`, el connector no encuentra el site, etc.), este es más simple y NO requiere Office Scripts.

## Paso B.1 — Convertir el área de datos en Excel Table

1. Abrí el Excel.
2. En `A4`, escribí los títulos (uno por columna):
   ```
   A4: Timestamp   B4: Flight    C4: FR (kg)   D4: FOB (kg)
   E4: Total (kg)  F4: Density   G4: Total (L) H4: Low end (L)
   I4: High end (L) J4: Status   K4: ID
   ```
3. Seleccioná `A4:K4`.
4. Menú **Insert → Table** (o `Ctrl+T`).
5. Asegurate que esté tildado **"My table has headers"** → OK.
6. Con la tabla seleccionada, en la pestaña **Table Design** (arriba), cambiá el "Table Name" a **`FuelRecords`**.
7. Save.

> Ahora tenés una Excel Table llamada `FuelRecords` con headers en A4 y 0 filas. Power Automate va a poder agregar filas debajo automáticamente.

## Paso B.2 — Flow con "Add a row"

1. `make.powerautomate.com` → **+ Create** → **Instant cloud flow** → trigger **"When a HTTP request is received"**.
2. Pegá el mismo JSON schema del Camino A (paso A.2.1).
3. **+ New step** → **Excel Online (Business) → Add a row into a table**.
4. **Location, Document Library, File:** mismo método que en A.2.2 (usá los pickers, NO pegues texto).
5. **Table:** dropdown → seleccioná `FuelRecords`.

   ⚡ Apenas elegís la tabla, Power Automate **muestra un input por cada columna** (Timestamp, Flight, FR (kg), …, ID). No tiene problema de "no aparece el campo".

6. Llená cada input con el dato del trigger usando Dynamic content. Por ejemplo:
   - **Timestamp** → Dynamic content → busca `record/timestamp` (o usá expression `triggerBody()?['record']?['timestamp']`).
   - **Flight** → `record/flight`
   - **FR (kg)** → `record/fr`
   - … y así con todas.

7. **+ New step** → **Response** con los mismos headers de CORS y Body = `{ "ok": true }` (texto literal).
8. Save → copiá la URL del trigger.

> ⚠️ Limitación: este camino solo cubre el `add`. Para el `list` (que la app trae todos los registros desde la nube) hay que agregar un branch con **"Switch"** en el flow que mire `triggerBody()?['action']` y, si es `list`, ejecute **"List rows present in a table"** en lugar de Add. Pedímelo si querés que te lo arme.

---

<a id="paso-final"></a>

# Paso final — Cablear la URL en la HTML

1. Pasame por chat la URL del trigger (la que termina en `&sig=...`).
2. Yo la pego en `dist/index.html`:
   ```js
   const CLOUD_WEBHOOK_URL = 'https://prod-XX.westus.logic.azure.com:443/...';
   ```
3. `git commit` + `git push` → en 1 minuto la app deployada empieza a usar el flow.
4. Test desde la app:
   - Abrí la app (en cualquier dispositivo).
   - Llená un registro y dale "Log load".
   - El pill **"Cloud sync status"** arriba de la tabla pasa de "Local mode" → "Syncing…" → **"Synced · SharePoint"**.
   - Abrí el Excel → tenés que ver el registro nuevo en la fila debajo de los títulos.

---

<a id="troubleshooting"></a>

# Troubleshooting

### El campo `payloadJson` no aparece después de elegir el script

Causa más común: el File seleccionado no es donde está guardado el script.

1. Verificá que el File apunte al Excel correcto (no a otro archivo del mismo site).
2. Verificá que el script existe en ese Excel:
   - Abrí el Excel → Automate → mirá si está `Fuel Records Handler` en la lista del panel izquierdo.
3. Borrá la acción "Run script" entera y volvé a agregarla desde cero.
4. Si nada funciona → cambiá a **Camino B**.

### El site no aparece en el dropdown de Location

1. Andá al Excel en el navegador y compartilo con vos mismo de nuevo (Share → Add me).
2. Volvé a `make.powerautomate.com`, refrescá la página completa (`F5`).
3. Si sigue sin aparecer, probá con **"Enter custom value"** y la URL completa del site.
4. Si el connector dice "Site not found" → el site puede ser **SharePoint Embedded** (prefijo `spe-` lo sugiere). En ese caso, el Excel tendría que moverse a un site SharePoint clásico o a tu OneDrive personal. Hablamos.

### Cuando lo testeo desde la consola del navegador, da CORS error

1. Verificá que la acción **Response** tenga `Access-Control-Allow-Origin: *`.
2. Verificá que estés mandando `Content-Type: text/plain` (NO `application/json`) — la HTML ya lo hace bien por defecto, este test es solo si lo probás manualmente.

### El registro se guarda local pero no llega al Excel

1. Pill arriba de la tabla → ¿qué dice?
   - **"Offline · queued"** → no hay internet o el navegador no lo detecta. Conectate y esperá unos segundos.
   - **"Sync error"** → el flow está respondiendo con error. Andá a `make.powerautomate.com` → tu flow → **Run history** → mirá el último run y revisá qué falló.
   - **"Synced · SharePoint"** → ya se mandó, refrescá el Excel (`F5`).
2. En Run history, abrí el run fallido y mirá qué acción dio rojo:
   - Si es **Run script** → el JSON que llegó no tenía la forma esperada.
   - Si es **Response** → algo en el script tiró excepción.

### Quiero invalidar la URL y generar una nueva

Eliminá el flow y creá uno nuevo. La URL incluye una firma única (`sig=...`) que se regenera con cada flow.

---

# Cómo funciona en runtime (referencia)

```
Pilot tablet                    Power Automate                SharePoint Excel
                                                                        
Save record  ─POST {add}──►  HTTP trigger ─►  Run script ──►  Append row at end
             ◄─ 200 ─────                ◄─  result JSON ◄─

Open app    ─POST {list}──►  HTTP trigger ─►  Run script ──►  Read rows A5..K∞
             ◄─ records ──                ◄─  result JSON ◄─
```

- Si el dispositivo está **offline**, los registros quedan en `localStorage` con `synced: false`.
- Cuando vuelve la conexión, el frontend dispara `pushPending()` automáticamente y cada registro se manda con su `id` único.
- El Office Script (Camino A) chequea el `id` antes de insertar: si ya existe, no escribe duplicado.

# Si nada funciona — alternativas

| Plan | Pros | Contras |
|---|---|---|
| **OneDrive personal Excel** | Conector mucho más simple, no hay líos de site/library | Pierde el site compartido, queda colgado de tu cuenta personal |
| **Microsoft Lists + sync a Excel** | Lista nativa de SharePoint, fácil de mantener | No es un Excel directo, hay que sync manual o vía Power BI |
| **Volver a Google Sheets** (código original) | Setup en 5 min, probado y andando | Datos quedan en Google, no en SharePoint |
| **Azure Function + MS Graph API** | Profesional, control total | Requiere subscripción Azure y setup técnico |

Avisame y lo arrancamos.
