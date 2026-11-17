import json, sys, os, collections

sp = sys.argv[1]


def load(p, root):
    out = collections.Counter()
    for f in json.load(open(p, encoding="utf-8")):
        norm = f["filePath"].replace("\\", "/")
        rel = "src/" + norm.split("/src/", 1)[1]
        for m in f["messages"]:
            if m["severity"] != 2:
                continue
            out[(rel, m.get("ruleId"), m["message"].split("\n")[0][:90])] += 1
    return out


base = load(sp + "/base.json", sp + "/base/frontend")
cur = load(sp + "/current.json", sp + "/current")
print("ERRORES base(59a4717)=", sum(base.values()), " actual=", sum(cur.values()))

changed = set(
    l.strip().replace("frontend/", "", 1)
    for l in open(sp + "/changed.txt", encoding="utf-8")
    if l.strip()
)
mine = set(open(sp + "/mine.txt", encoding="utf-8").read().split())
shared = {"src/app/(shop)/pedido/confirmacion/page.js", "src/app/(shop)/seguimiento/page.js", "src/app/(auth)/cuenta/page.js", "src/components/admin/OrderDetail.jsx", "src/app/admin/contenido/page.js"}


def who(f):
    if f in shared:
        return "COMPARTIDO"
    if f in mine:
        return "REMEDIACION"
    if f in changed:
        return "PROPIETARIO"
    return "SIN_CAMBIOS"


new = cur - base
gone = base - cur
print("\nNUEVOS respecto a la base:")
for (f, r, m), n in sorted(new.items()):
    print(f"  +{n} {who(f)} {f} [{r}] {m}")
print("\nDESAPARECIDOS respecto a la base:")
for (f, r, m), n in sorted(gone.items()):
    print(f"  -{n} {who(f)} {f} [{r}] {m}")
print("\nACTUALES por archivo y origen:")
per = collections.Counter()
for (f, r, m), n in cur.items():
    per[(who(f), f, r)] += n
for (w, f, r), n in sorted(per.items()):
    print(f"  {n} {w} {f} [{r}]")
json.dump(
    {
        "base": sum(base.values()),
        "current": sum(cur.values()),
        "new": [[f, r, m, n, who(f)] for (f, r, m), n in new.items()],
        "gone": [[f, r, m, n, who(f)] for (f, r, m), n in gone.items()],
        "current_by_file": [[w, f, r, n] for (w, f, r), n in per.items()],
    },
    open(sp + "/lint-compare.json", "w", encoding="utf-8"),
    ensure_ascii=False,
    indent=1,
)
