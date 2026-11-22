ALTER TABLE "detalle_ventas" ADD COLUMN "nota" varchar(120);--> statement-breakpoint
ALTER TABLE "jornadas" ADD COLUMN "fondo_inicial" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jornadas" ADD COLUMN "retiros" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jornadas" ADD COLUMN "efectivo_contado" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "jornadas" ADD COLUMN "diferencia" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "jornadas" ADD COLUMN "notas" varchar(250);--> statement-breakpoint
ALTER TABLE "jornadas" ADD COLUMN "cerrada_por" varchar(60);--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "controlar_stock" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "efectivo_recibido" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "cambio" numeric(12, 2);