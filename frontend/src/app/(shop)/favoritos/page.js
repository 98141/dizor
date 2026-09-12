import FavoritosContent from "@/components/favorites/FavoritosContent";

export const metadata = {
  title: "Favoritos",
  description: "Tus piezas guardadas en Dizor.",
  robots: { index: false, follow: false },
};

export default function FavoritosPage() {
  return (
    <main className="favorites-page-wrap">
      <FavoritosContent />
    </main>
  );
}
