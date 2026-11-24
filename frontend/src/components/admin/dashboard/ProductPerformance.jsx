"use client";
import Link from "next/link";
import { HiOutlineSparkles, HiOutlineArchiveBox, HiOutlineCube, HiOutlineArrowRight } from "react-icons/hi2";
import { formatCOP } from "@/lib/formatCurrency";
import { formatNumber } from "@/lib/dashboardPeriod";
import { DashboardCard, DashboardEmptyState, ProductThumb, StatusChip } from "./DashboardUI";

const productHref = (id) => `/admin/productos/${id}/editar`;
const variantHref = (item) => `/admin/productos?view=stock&productId=${item.productId}&variantId=${item.variantId}`;
const STATUS = { out: ["danger", "Agotada"], low: ["warning", "Stock bajo"], review: ["review", "Revisar"] };

export default function ProductPerformance({ products, inventory, periodText }) {
  const { top, withoutSales } = products;
  const maxUnits = Math.max(1, ...top.map((p) => p.units));
  return <div className="dz-products">
    <DashboardCard id="dz-top-title" title="Más vendidos" subtitle={`Unidades en pedidos conciliados · ${periodText}`} className="dz-top">
      {top.length ? <ol className="dz-rank">
        {top.map((p, i) => <li key={p.id} className="dz-rank__row">
          <span className="dz-rank__pos" aria-hidden="true">{i + 1}</span>
          <ProductThumb src={p.image} name={p.name} />
          <div className="dz-rank__main">
            {p.exists ? <Link href={productHref(p.id)} className="dz-rank__name">{p.name}</Link> : <span className="dz-rank__name">{p.name} <small>(ya no está en el catálogo)</small></span>}
            <span className="dz-rank__meter" aria-hidden="true"><span style={{ width: `${(p.units / maxUnits) * 100}%` }} /></span>
          </div>
          <div className="dz-rank__nums"><strong>{formatNumber(p.units)} {p.units === 1 ? "ud" : "uds"}</strong><span>{formatCOP(p.sales)}</span></div>
        </li>)}
      </ol> : <DashboardEmptyState icon={HiOutlineSparkles} title="Sin ventas conciliadas en el periodo" compact>Aquí aparecerán los cinco productos con más unidades vendidas.</DashboardEmptyState>}
    </DashboardCard>

    <DashboardCard id="dz-nosales-title" title="Productos sin ventas" subtitle="Productos publicados sin ventas conciliadas durante el periodo."
      actions={withoutSales.count > 0 ? <span className="dz-count" aria-label={`${withoutSales.count} productos`}>{formatNumber(withoutSales.count)}</span> : null} className="dz-nosales">
      {withoutSales.items.length ? <>
        <ul className="dz-plain-list">
          {withoutSales.items.map((p) => <li key={p.id} className="dz-plain-row">
            <ProductThumb src={p.image} name={p.name} size={36} />
            <Link href={productHref(p.id)} className="dz-plain-row__name">{p.name}</Link>
            <span className="dz-plain-row__meta">{p.stockStatus === "review" ? "Revisar existencias" : `${formatNumber(p.availableStock)} disp.`}</span>
          </li>)}
        </ul>
        <p className="dz-card__foot">{withoutSales.count > withoutSales.items.length ? `Mostrando ${withoutSales.items.length} de ${withoutSales.count}, con más existencias primero. ` : ""}
          <Link href="/admin/productos?isActive=true">Ver productos publicados<HiOutlineArrowRight aria-hidden="true" /></Link></p>
      </> : <DashboardEmptyState icon={HiOutlineArchiveBox} title="Todos los productos publicados registran ventas" compact />}
    </DashboardCard>

    <DashboardCard id="dz-inv-title" title="Inventario que requiere atención" subtitle={`Variantes activas de productos publicados · estado actual · umbral ≤ ${inventory.threshold} uds`} className="dz-inventory">
      <dl className="dz-inv-counts">
        <div className={inventory.outVariants ? "is-danger" : ""}><dt>Agotadas</dt><dd>{formatNumber(inventory.outVariants)}</dd></div>
        <div className={inventory.lowVariants ? "is-warning" : ""}><dt>Stock bajo</dt><dd>{formatNumber(inventory.lowVariants)}</dd></div>
        <div className={inventory.reviewVariants ? "is-review" : ""}><dt>Por revisar</dt><dd>{formatNumber(inventory.reviewVariants)}</dd></div>
      </dl>
      {inventory.items.length ? <ul className="dz-plain-list">
        {inventory.items.map((v) => <li key={v.variantId} className="dz-plain-row">
          <span className="dz-plain-row__icon" aria-hidden="true"><HiOutlineCube /></span>
          <span className="dz-plain-row__text">
            <Link href={variantHref(v)} className="dz-plain-row__name">{v.productName}</Link>
            <span className="dz-plain-row__sub">{[v.size, v.color].filter(Boolean).join(" · ")}{v.size || v.color ? " · " : ""}<span className="dz-mono">{v.sku}</span></span>
          </span>
          <span className="dz-plain-row__meta"><StatusChip tone={STATUS[v.status][0]}>{STATUS[v.status][1]}</StatusChip>{v.status !== "review" && <span>{formatNumber(v.stock)} {v.stock === 1 ? "ud" : "uds"}</span>}</span>
        </li>)}
      </ul> : <DashboardEmptyState icon={HiOutlineCube} title="Sin variantes agotadas ni con stock bajo" compact />}
      <p className="dz-card__foot"><Link href="/admin/productos?view=stock">Ir a existencias<HiOutlineArrowRight aria-hidden="true" /></Link></p>
    </DashboardCard>
  </div>;
}
