import Image from "next/image";

const assets = {
  camera: { src: "/mascot/sj-camera.webp", alt: "カメラを持ったSJの柴犬", size: 512 },
  history: { src: "/mascot/sj-history.webp", alt: "レシートのフォルダを持ったSJの柴犬", size: 512 },
  icon: { src: "/mascot/sj-icon.webp", alt: "SJレシートカメラの柴犬", size: 256 },
};

export function Shiba({ className = "", variant = "camera", sizes = "128px", preload = false, decorative = false }: {
  className?: string;
  variant?: keyof typeof assets;
  sizes?: string;
  preload?: boolean;
  decorative?: boolean;
}) {
  const asset = assets[variant];
  return <Image src={asset.src} alt={decorative ? "" : asset.alt} width={asset.size} height={asset.size} sizes={sizes} preload={preload} className={`mascot mascot-${variant} ${className}`} />;
}
