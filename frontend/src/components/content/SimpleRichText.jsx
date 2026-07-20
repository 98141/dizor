import {
  renderSimpleContentBlock,
  splitSimpleContentBlocks,
} from "@/lib/simpleContentBlocks";

/**
 * Descripción / cuerpo con formato ligero (párrafos, títulos, viñetas, imágenes).
 */
export default function SimpleRichText({ text, className = "simple-content" }) {
  if (!text?.trim()) return null;

  const blocks = splitSimpleContentBlocks(text);

  return (
    <div className={className}>
      {blocks.map((block, index) => renderSimpleContentBlock(block, index))}
    </div>
  );
}
