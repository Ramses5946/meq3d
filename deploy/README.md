# Despliegue local por Cloudflare Tunnel

La landing se sirve sin dependencias desde `127.0.0.1:3201` y se publica mediante el túnel local `meqforge` como:

`https://meq3d.meqforge.com`

## Comprobaciones

```powershell
node .\deploy\server.mjs
cloudflared tunnel --config "$env:USERPROFILE\.cloudflared\config-meqforge.yml" ingress validate
Invoke-WebRequest http://127.0.0.1:3201/healthz -UseBasicParsing
```

En esta máquina, el servidor y el túnel se registran como tareas de inicio de sesión para que sobrevivan reinicios. El código del sitio no requiere `npm install` ni un paso de build.

## Archivos STL

El endpoint `POST /api/uploads` acepta STL ASCII o binario de hasta 25 MB. Los archivos y sus metadatos se guardan fuera de la raíz pública en `..\work\meq3d-uploads`, salvo que se configure `MEQ3D_UPLOAD_DIR`. No hay una ruta pública para descargarlos.

## Administración del catálogo

Abre `http://127.0.0.1:3201/admin.html` desde esta máquina. El panel permite agregar un producto con imagen pública y un STL interno opcional. La operación de escritura se rechaza cuando llega a través de Cloudflare; los datos se guardan en `..\work\meq3d-catalog` y el sitio público consume `GET /api/catalog`.
