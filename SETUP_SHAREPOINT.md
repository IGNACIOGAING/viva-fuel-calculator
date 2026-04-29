# Setup — Guardar registros en el Excel de SharePoint

> **Objetivo:** que los registros que cargan los pilotos desde la HTML se guarden automáticamente en el Excel de SharePoint, **empezando con los títulos en `A4`** y los registros una fila debajo de la otra.

> **Cómo:** un **flow de Power Automate** con un trigger HTTP escucha los `POST` de la HTML y dispara un **Office Script** que escribe en el Excel.
> Los pilotos no necesitan login: el flow corre con **tu** cuenta McKinsey, que sí tiene permiso al archivo.

---

## Resumen visual

```
[ Pilot tablet ]                       [ Power Automate ]                  [ SharePoint Excel ]
                                                                                    
HTML / GitHub Pages  ──POST JSON──►  HTTP trigger (anonymous URL)  ─►  Run Office Script  ─►  Worksheet
                     ◄───response───                              ◄───   (returns JSON)   ◄───
```

---

## Paso 1 — Crear el Office Script en el Excel

1. Abrí el Excel de SharePoint:
   <https://mckinsey.sharepoint.com/:x:/s/spe-int-nu8lxwa6h9wfzr1/IQDT5U26Ny07TYEMFmWLjOszAcpoomAl5fXrzftd-fdgrx8?e=pdgfEi>

2. (Una sola vez) Posicionate en la **hoja** donde querés que vivan los registros. Asegurate que **A1..A3 puedan quedar libres** (la app escribe títulos en `A4` y registros desde `A5`).

3. Pestaña **Automate** → **New Script**.

4. Borrá el contenido y pegá **todo** el archivo [`office-script-fuel-records.ts`](./office-script-fuel-records.ts) que está en este mismo repo.

5. Renombralo a `Fuel Records Handler`.

6. **Save Script** → cerrá el panel.

> El script entiende dos acciones:
> - `add` → agrega 1 fila nueva (idempotente por `record.id`).
> - `list` → devuelve un JSON con todos los registros existentes.

---

## Paso 2 — Crear el flow de Power Automate

1. Andá a <https://make.powerautomate.com> con tu cuenta McKinsey.
2. **+ Create** → **Instant cloud flow** → **Skip**.
3. Buscá el trigger **"When a HTTP request is received"** y agregalo.

### 2a. Configurar el trigger HTTP

- **Method:** `POST`
- **Request Body JSON Schema:**

```json
{
  "type": "object",
  "properties": {
    "action": { "type": "string" },
    "record": {
      "type": "object",
      "properties": {
        "timestamp": { "type": "string" },
        "flight":    { "type": "string" },
        "fr":        { "type": "number" },
        "fob":       { "type": "number" },
        "totalKg":   { "type": "number" },
        "density":   { "type": "number" },
        "totalL":    { "type": "number" },
        "lowL":      { "type": "number" },
        "highL":     { "type": "number" },
        "status":    { "type": "string" },
        "id":        { "type": "string" }
      }
    }
  }
}
```

- (Recomendado) En **Settings del trigger** → **Triggering condition** → ninguna por ahora.
  Más adelante podés requerir un secret en un header (ej. `x-app-token`) si querés.

### 2b. Acción "Run script"

- **+ New step** → buscá **Excel Online (Business)** → acción **Run script**.
- **Location:** SharePoint
- **Document Library:** la del sitio (`spe-int-nu8lxwa6h9wfzr1` → la lib donde está el Excel)
- **File:** seleccioná el Excel `IQDT5U26Ny07TYEMFmWLjOszAcpoomAl5fXrzftd-fdgrx8`
- **Script:** `Fuel Records Handler`
- **payloadJson:** clic en el campo → en el panel "Dynamic content" o **Expression**, pegá:

```text
triggerBody()
```

  ⚠️ Si el conector pide un *string*, envolvelo así:
  
```text
string(triggerBody())
```

### 2c. Acción "Response"

- **+ New step** → buscá **Request → Response**.
- **Status Code:** `200`
- **Headers:** clic en *Show advanced options* y agregá tres headers para CORS:

| Key                            | Value                       |
| ------------------------------ | --------------------------- |
| `Content-Type`                 | `application/json`          |
| `Access-Control-Allow-Origin`  | `*`                         |
| `Access-Control-Allow-Methods` | `POST, OPTIONS`             |

- **Body:** del paso anterior, seleccioná **`result`** (la salida del script — es el string JSON).

### 2d. Guardar y obtener la URL

1. Dale **Save** al flow.
2. Volvé al trigger HTTP → ahora se ve el campo **HTTP POST URL**.
3. **Copiala** — esa es la URL que va a usar la HTML.

> La URL es larga e incluye un token (`sig=...`). **Tratala como un secreto.** Si se filtra, podés regenerarla regenerando el flow.

---

## Paso 3 — Cablear la URL en la HTML

1. Abrí `dist/index.html` (en este repo).
2. Buscá la línea:

   ```js
   const CLOUD_WEBHOOK_URL = '';
   ```

3. Pegá la URL del paso 2d entre las comillas:

   ```js
   const CLOUD_WEBHOOK_URL = 'https://prod-XX.westus.logic.azure.com:443/workflows/.../triggers/manual/paths/invoke?api-version=...&sig=...';
   ```

4. Hacé `git commit -m "feat: wire SharePoint webhook"` y `git push`.

> Si me la pasás vos por chat, lo hago yo. Es solo pegar.

---

## Cómo funciona en runtime

### Cuando un piloto guarda un registro

```
Pilot:  click "Log load"
Browser: POST a CLOUD_WEBHOOK_URL con body {
  "action": "add",
  "record": { timestamp, flight, fr, fob, totalKg, density, totalL, lowL, highL, status, id }
}
Power Automate → Run script(payloadJson = body) → escribe fila en Excel
Power Automate → Response 200 con { ok: true, row: 17 }
Browser: marca el registro como "synced" en localStorage
```

Si el navegador está offline o el flow falla, el registro queda **encolado en localStorage** y se reintenta al volver la conexión / al refrescar.

### Cuando se abre la app o se aprieta "Refresh"

```
Browser: POST a CLOUD_WEBHOOK_URL con body { "action": "list" }
Power Automate → Run script → devuelve { ok: true, records: [...] }
Browser: hace merge con localStorage (deduplicando por id) y renderiza la tabla
```

---

## Idempotencia y duplicados

- El frontend genera un `id` único por registro (`crypto.randomUUID()`).
- El Office Script chequea el `id` antes de insertar; si ya existe, **no** vuelve a escribir.
- Esto cubre reintentos, dobles clicks y registros offline que se mandan dos veces.

---

## Notas y troubleshooting

- **CORS:** la HTML manda `Content-Type: text/plain` para evitar el *preflight* `OPTIONS` (Power Automate no responde OPTIONS). El Office Script igual parsea el body como JSON.
- **Permisos del file:** asegurate que tu cuenta tenga **Edit** sobre el Excel (no solo View).
- **Run script timeout:** ~120 s. Esto es de sobra para una operación de append.
- **Regenerar URL:** si querés invalidar el endpoint anterior, eliminá el flow y creá uno nuevo (la URL incluye un firma única).
- **Ver logs:** Power Automate → tu flow → **Run history**. Vas a ver cada POST con su input/output.

---

## Si Power Automate no está disponible

Alternativas (en orden de simplicidad):

1. **Logic Apps en Azure** — mismo mecanismo, requiere subscripción Azure.
2. **Azure Function HTTP trigger** + Microsoft Graph API → escribir al Excel con auth de aplicación.
3. **Volver a Google Sheets** (el código original sigue siendo compatible) y un flow PA secundario que mirror el Sheet → SharePoint.

Avisame por chat cuál preferís y armamos el plan B.
