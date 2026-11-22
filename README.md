# Gordo Arepas — Next.js

Reescritura del aplicativo de gestión (antes Spring Boot + Thymeleaf) sobre
**Next 16 (App Router) + TypeScript + Drizzle + PostgreSQL**.

El proyecto Java de `../GArepasAppV2Final` queda como espejo funcional de
referencia durante la migración: mismas tablas, mismas reglas de negocio.

## Cómo arrancar

```bash
cp .env.example .env.local        # ajusta DATABASE_URL + AUTH_SECRET
npm ci
npm run db:migrate                # aplica migraciones Drizzle
npm run db:seed                   # admin/admin123, cajero/cajero123, carta demo
npm run dev                       # http://localhost:3000
```

Rutas públicas: `/login`, `/menu` (carta), `/api/public/menu`.
Todo lo demás exige sesión; `/usuarios` y `/configuracion` exigen rol ADMIN.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` | ciclo Next |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | genera SQL desde `src/db/schema.ts` |
| `npm run db:migrate` | aplica migraciones |
| `npm run db:seed` | semilla mínima (usuarios, carta de ejemplo) |
| `npm run db:carta-real` | carga la carta real desde el CSV de recetas (borra el catálogo de prueba) |
| `npm run db:demo` | regenera 30 días de operación con ~1.000 ventas para probar la UI |
| `npm run test:units` | autochequeos de unidades, costos, producción y gastos |

## Estructura

```
src/
├── app/
│   ├── (consola)/         shell privado: layout con nav + módulos
│   ├── login/             sesión (JWT HS256 en cookie httpOnly)
│   ├── menu/              carta pública (React Bits: Aurora, BlurText…)
│   ├── api/public/menu/   JSON que consume la carta
│   └── actions/           server actions por dominio
├── components/            UI por dominio + reactbits/
├── db/                    schema Drizzle, migraciones y semilla
└── lib/                   sesión, auth, dinero, unidades, validaciones
```

## Lo que ya hace

- **POS con cambio**: efectivo recibido, billetes **acumulables** (dos toques de $10.000 suman
  $20.000), borrar y devuelta calculada; nota por ítem
  (presets: sin queso, bien asada…) que viaja al recibo; productos con *stock libre* se pueden
  vender aunque el inventario quede negativo; Enter en la búsqueda agrega el primer resultado.
- **Arqueo de caja**: la jornada abre con fondo inicial y cierra con conteo de efectivo,
  retiros y notas. La diferencia (esperado vs. contado) se guarda y aparece en Reportes.
- **Tiempo real sin recargar**: triggers `NOTIFY` en Postgres → SSE (`/api/eventos`) →
  `router.refresh()`. Un cierre de caja o una venta en otro equipo se refleja en segundos.
  Si el stream cae, hay respaldo por foco/visibilidad y cada 30 s.
- **Canal de venta** (`MOSTRADOR / WHATSAPP / APP / EVENTO / RETAIL`) con comisión
  configurable: Reportes muestra vendido, comisión y neto por canal.
- **Extras con precio** (queso, papita, salsa): se eligen por ítem en el POS, se suman al
  subtotal y quedan en el recibo con su precio del momento.
- **Carta pública (`/menu`)**: portada con el recorte de la arepa sobre un plato de papel
  (`public/images/carta/arepa.webp`, fondo transparente), sello 100% maíz, carta impresa con
  precios alineados, sección «Para hacer en casa», tres pasos y barra de WhatsApp fija en móvil.
  Si se reemplaza la foto, la URL cambia sola por la fecha del archivo (sin caché vieja).
- **Inicio tipo hoja de turno («La Pizarra»)**: masthead tipográfico, bitácora del día, balance,
  cocina/bodega, avisos, índice de estaciones y movimientos. Sin tarjetas ni hero: reglas y tipo.
- **Login con React Bits**: fondo `Silk` (WebGL, se pausa con movimiento reducido), `SpotlightCard`
  en la tarjeta, `ClickSpark` al escribir/entrar y `ShinyText` en la firma de marca.
- **Tutorial interactivo**: botón flotante «Tutorial» que recorre 12 pasos por las pantallas reales,
  iluminando el elemento del que habla, con avance guardado y navegación por teclado. Se entrega
  así al cliente: no hay que explicarle la app en una llamada.
- **Tema claro/oscuro** con botón en la barra lateral, persistente y sin parpadeo; la carta
  pública y los recibos impresos siempre en claro.
- **Análisis (`/analisis`)**: serie de ventas con media móvil, ingresos vs gastos, mapa de calor
  día × hora, margen y food cost por producto, neto por canal y tramos de cartera. Incluye
  recomendaciones calculadas (precio sugerido, comisión de apps, día flojo, cartera vencida,
  ticket bajo, anulaciones) con el umbral que las dispara.
- **Lista de compra sugerida** desde los insumos bajo mínimo, con envío por WhatsApp.
- **Todo se resuelve en diálogos**: crear, editar y eliminar/desactivar producto, insumo, receta,
  gasto, cliente, usuario, producción, venta y cobro de saldo. Las rutas `/nuevo` y `/[id]`
  siguen existiendo como enlaces directos, pero ningún botón de la consola navega a ellas.
  Si el servidor rechaza el guardado, el diálogo se reabre con el error junto al campo.

## Decisiones

- **Auth propia con `jose`** en vez de Auth.js: dos roles, un formulario de
  credenciales, `bcryptjs` contra los hashes que ya existían. ~60 líneas.
- **Dinero como `numeric` con `round2()` al escribir**, igual que el
  `BigDecimal` del backend; si algún día se factura a escala, pasar a centavos.
- **Unidades**: toda cantidad se guarda en unidad base (g, ml, unidad);
  `lib/units.ts` es el único lugar con factores.
- **React Bits** se reutilizan tal cual (JSX, MIT) con `allowJs`; no se
  reescriben por gusto.
- La consola usa densidades de dashboard (8/32 px) y la carta conserva la
  identidad de `tokens.css` del proyecto anterior.

## Estado de la migración

| Módulo | Estado |
|---|---|
| Sesión / roles | ✅ |
| Productos (CRUD) | ✅ |
| Carta pública + API | ✅ |
| Insumos + recetas + ajustes + costos | ✅ |
| Producciones + gastos + jornadas | ✅ |
| Ventas/POS + clientes + abonos | ✅ |
| Reportes + configuración + usuarios | ✅ |

Permisos replicados de `SecurityConfig`: la caja (`VENTAS`) entra a POS,
clientes, abonos y recibo; el catálogo, reportes, usuarios y configuración
son solo del dueño (`ADMIN`).

## Pendiente antes de cortar producción

- Confirmaciones de borrado (hoy se ejecutan directo) y revisión de UX de la
  consola con `design-taste-frontend`.
- PWA (manifest + service worker) que existía en la app Thymeleaf.
- Verificación de doble apertura de jornada con índice único parcial.
- Paridad funcional completa y pruebas de regresión de las reglas de stock.
- Exportar datos: apuntar al Postgres existente (`baseline` de Flyway) y
  verificar que `schema.ts` coincide columna a columna.
- Dockerfile + `output: standalone`, variables de Railway y redirects del
  dominio actual.
