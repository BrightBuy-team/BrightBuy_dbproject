import { useState } from 'react'
import {
  Bot, Calculator, Camera, CarFront, FlaskConical, Gamepad2, HardDrive, Headphones,
  Keyboard, LampDesk, Laptop, Monitor, Mouse, Package, Plug, Puzzle, Ship, Smartphone,
  Speaker, ToyBrick, Truck, Watch, Webcam,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function PackageIcon() {
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="m40 12 26 14v29L40 70 14 55V26l26-14Z" /><path d="m14 26 26 15 26-15M40 41v29M27 19l26 15v14" /></svg>
}

type ProductArtwork = { icon: LucideIcon; tone: string; label: string }

function getProductArtwork(name: string): ProductArtwork {
  const text = name.toLowerCase()
  if (/phone|iphone|smartphone/.test(text)) return { icon: Smartphone, tone: 'coral', label: 'Mobile' }
  if (/earbud|headphone|headset/.test(text)) return { icon: Headphones, tone: 'violet', label: 'Audio' }
  if (/speaker|soundbar/.test(text)) return { icon: Speaker, tone: 'violet', label: 'Audio' }
  if (/watch|fitness band/.test(text)) return { icon: Watch, tone: 'mint', label: 'Wearable' }
  if (/smart plug/.test(text)) return { icon: Plug, tone: 'mint', label: 'Smart home' }
  if (/lamp/.test(text)) return { icon: LampDesk, tone: 'mint', label: 'Smart home' }
  if (/camera/.test(text)) return { icon: Camera, tone: 'mint', label: 'Smart home' }
  if (/laptop|workstation/.test(text)) return { icon: Laptop, tone: 'blue', label: 'Computing' }
  if (/keyboard/.test(text)) return { icon: Keyboard, tone: 'blue', label: 'Accessories' }
  if (/mouse/.test(text)) return { icon: Mouse, tone: 'blue', label: 'Accessories' }
  if (/ssd/.test(text)) return { icon: HardDrive, tone: 'blue', label: 'Accessories' }
  if (/monitor/.test(text)) return { icon: Monitor, tone: 'blue', label: 'Accessories' }
  if (/webcam/.test(text)) return { icon: Webcam, tone: 'blue', label: 'Accessories' }
  if (/hub/.test(text)) return { icon: Plug, tone: 'blue', label: 'Accessories' }
  if (/blocks/.test(text)) return { icon: ToyBrick, tone: 'gold', label: 'Learning' }
  if (/robot/.test(text)) return { icon: Bot, tone: 'gold', label: 'Learning & play' }
  if (/science/.test(text)) return { icon: FlaskConical, tone: 'gold', label: 'Learning' }
  if (/puzzle/.test(text)) return { icon: Puzzle, tone: 'gold', label: 'Learning' }
  if (/abacus|counting/.test(text)) return { icon: Calculator, tone: 'gold', label: 'Learning' }
  if (/truck/.test(text)) return { icon: Truck, tone: 'coral', label: 'Remote control' }
  if (/boat/.test(text)) return { icon: Ship, tone: 'coral', label: 'Remote control' }
  if (/car|buggy/.test(text)) return { icon: CarFront, tone: 'coral', label: 'Remote control' }
  if (/toy|game|remote|rc/.test(text)) return { icon: Gamepad2, tone: 'gold', label: 'Toys & play' }
  if (/computer|electronic/.test(text)) return { icon: Laptop, tone: 'blue', label: 'Computing' }
  return { icon: Package, tone: 'neutral', label: 'BrightBuy' }
}

export default function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const safeImage = src && /^(https?:\/\/|\/[^/])/.test(src) ? src : null
  if (safeImage && failedSrc !== safeImage) {
    return <img src={safeImage} alt={name} loading="lazy" onError={() => setFailedSrc(safeImage)} />
  }
  const { icon: Icon, tone, label } = getProductArtwork(name)
  return <div className={`catalogue-product-art tone-${tone}`} role="img" aria-label={`Illustration of ${name}`}>
    <span className="catalogue-art-orbit" aria-hidden="true" />
    <span className="catalogue-art-object"><Icon aria-hidden="true" /></span>
    <span className="catalogue-art-spark" aria-hidden="true" />
    <span className="catalogue-art-label" aria-hidden="true">{label}</span>
  </div>
}
