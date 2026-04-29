# Viva Aerobus · Fuel Loading Calculator

Calculadora de carga de combustible para uso de pilotos de Viva Aerobus.

## Acceso

La aplicación se publica vía GitHub Pages y es accesible desde cualquier navegador (desktop, tablet, mobile). No requiere instalación ni login.

## Cómo se usa

1. El piloto ingresa el número de vuelo, FR (KG) y FOB (KG).
2. Pide la densidad por radio/teléfono al ground handler.
3. La calculadora devuelve el **rango en litros** (low end / high end, ±1.75%) que el piloto le comunica al ground handler.
4. Apretando **Registrar carga** queda guardado en la tabla con fecha/hora automática.
5. Si el ground handler no se comunica, el piloto puede dejar registro con el botón **No me compartieron la info** (solo requiere número de vuelo).
6. El histórico se descarga como CSV.

## Fórmula

```
TOTAL_KG  = FOB − FR
TOTAL_L   = (TOTAL_KG + 200) / densidad
LOW_END   = TOTAL_L × (1 − 0.0175)
HIGH_END  = TOTAL_L × (1 + 0.0175)
```

## Notas técnicas

- Archivo único `index.html` autocontenido (HTML + CSS + JS inline). Logo embebido como data URI.
- Funciona offline una vez cargado en el navegador.
- Los registros se guardan en `localStorage` del dispositivo (cache local) **y** se sincronizan a un Excel compartido en SharePoint vía un flow de Power Automate (ver `SETUP_SHAREPOINT.md`).
- Si el dispositivo está offline, los registros quedan en cola y se suben automáticamente al recuperar conexión.
- Compatibilidad: navegadores modernos (Chrome, Edge, Safari, Firefox).

## Backend de registros compartidos

Toda la sincronización con SharePoint Excel se hace a través de un **único endpoint** (URL del trigger HTTP de Power Automate), configurado en la constante `CLOUD_WEBHOOK_URL` dentro de `index.html`.

- Mientras esa constante esté vacía, la app corre en **modo local** (cada tablet ve solo lo suyo).
- Apenas se setea la URL, la app pasa a **modo SharePoint**: cada registro se replica al Excel y al abrir la app se traen los registros de todos los pilotos.

Pasos detallados en [`SETUP_SHAREPOINT.md`](./SETUP_SHAREPOINT.md). El Office Script que escribe en el Excel está en [`office-script-fuel-records.ts`](./office-script-fuel-records.ts).
