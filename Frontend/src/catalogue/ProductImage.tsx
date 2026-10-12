import { useState } from 'react'
import {
  Blocks, Bot, Calculator, Camera, CarFront, FlaskConical, Gamepad2, HardDrive, Headphones,
  Keyboard, LampDesk, Laptop, Monitor, Mouse, Package, Plug, Puzzle, Ship, Smartphone, Speaker,
  ToyBrick, Truck, Watch, Webcam,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type ProductIllustration = { icon: LucideIcon; tone: string; label: string }
type ProductPhoto = { src: string; alt: string }

function productPhoto(name: string): ProductPhoto | null {
  const text = name.toLowerCase()
  if (text === 'apple iphone 15 pro') return { src: '/products/iphone-15-pro-user.png', alt: name }
  if (text === 'samsung galaxy s24 ultra') return { src: '/products/galaxy-s24-ultra-user.jpg', alt: name }
  if (/sony wh-1000xm5/.test(text)) return { src: '/products/headphones-user.jpg', alt: 'Representative Sony over-ear headphones' }
  if (/brightbuy nova phone/.test(text)) return { src: '/products/huawei-phone-user.png', alt: 'Huawei smartphone, representative image' }
  if (/brightbuy lite phone/.test(text)) return { src: '/products/honor-phone-user.png', alt: 'HONOR smartphone, representative image' }
  if (/brightbuy mini phone/.test(text)) return { src: '/products/toy-smartphone-user.png', alt: 'Toy-style smartphone, representative image' }
  if (/brightbuy max phone/.test(text)) return { src: '/products/oneplus-phone-user.png', alt: 'OnePlus smartphone, representative image' }
  if (/brightbuy plus phone/.test(text)) return { src: '/products/sologic-phone-user.png', alt: 'Sologic smartphone, representative image' }
  if (/earbud/.test(text)) return { src: '/products/wireless-earbuds-user.png', alt: 'Wireless earbuds and charging case' }
  if (/soundbar/.test(text)) return { src: '/products/soundbar-user.png', alt: 'Soundbar, subwoofer and surround speakers' }
  if (/speaker/.test(text)) return { src: '/products/portable-speaker-user.png', alt: 'Portable Bluetooth speaker' }
  if (/gaming headset/.test(text)) return { src: '/products/gaming-headset-user.png', alt: 'Over-ear gaming headset with microphone' }
  if (/studio headphones/.test(text)) return { src: '/products/studio-headphones-user.png', alt: 'Beyerdynamic DT 990 Pro wired headphones' }
  if (/headphone|headset/.test(text)) return { src: '/products/sony-headphones.jpg', alt: 'Over-ear headphones' }
  if (/fitness band/.test(text)) return { src: '/products/fitness-band-user.png', alt: 'Fitness tracker band' }
  if (/watch/.test(text)) return { src: '/products/smart-watch-user.jpg', alt: 'Smart watch' }
  if (/lamp/.test(text)) return { src: '/products/smart-lamp-user.png', alt: 'Adjustable smart desk lamp' }
  if (/smart plug/.test(text)) return { src: '/products/smart-plug.jpg', alt: 'Smart plug adapter' }
  if (/camera/.test(text)) return { src: '/products/security-camera-user.png', alt: 'Indoor security camera' }
  if (/webcam/.test(text)) return { src: '/products/webcam-4k-user.png', alt: '4K USB webcam with privacy cover' }
  if (/workstation/.test(text)) return { src: '/products/workstation-laptop-user.png', alt: 'Dell laptop computer' }
  if (/convertible laptop/.test(text)) return { src: '/products/convertible-laptop-user.png', alt: 'ASUS Vivobook laptop' }
  if (/gaming laptop/.test(text)) return { src: '/products/gaming-laptop-user.png', alt: 'Acer Predator gaming laptop' }
  if (/air laptop/.test(text)) return { src: '/products/air-laptop-user.png', alt: 'BrightBuy Air Laptop' }
  if (/pro laptop/.test(text)) return { src: '/products/pro-laptop-user.png', alt: 'Lenovo Legion laptop' }
  if (/gaming laptop|laptop|workstation|computer/.test(text)) return { src: '/products/laptop-user.png', alt: 'HP Victus gaming laptop' }
  if (/keyboard/.test(text)) return { src: '/products/mechanical-keyboard-user.png', alt: 'RGB mechanical keyboard' }
  if (/mouse/.test(text)) return { src: '/products/wireless-mouse-user.png', alt: 'Wireless computer mouse with USB receiver' }
  if (/ssd/.test(text)) return { src: '/products/portable-ssd-user.png', alt: 'Portable solid-state drive' }
  if (/hub/.test(text)) return { src: '/products/usb-c-hub-user.png', alt: 'USB-C hub with multiple ports' }
  if (/monitor/.test(text)) return { src: '/products/monitor-user.png', alt: 'Curved desktop monitor' }
  if (/abacus|counting/.test(text)) return { src: '/products/abacus-user.png', alt: 'Counting abacus' }
  if (/boat/.test(text)) return { src: '/products/rc-boat-user.png', alt: 'Remote-controlled boat' }
  if (/science/.test(text)) return { src: '/products/science-kit-user.png', alt: 'Science activity kit' }
  if (/alphabet puzzle|puzzle/.test(text)) return { src: '/products/alphabet-puzzle-user.png', alt: 'Alphabet puzzle' }
  if (/blocks/.test(text)) return { src: '/products/building-blocks-user.png', alt: 'Colorful educational building blocks' }
  if (/coding robot kit/.test(text)) return { src: '/products/coding-robot-kit-user.png', alt: 'Programmable construction robot kit' }
  if (/robot/.test(text)) return { src: '/products/toy-robot-user.png', alt: 'Toy robot' }
  if (/truck/.test(text)) return { src: '/products/rc-truck-user.png', alt: 'Remote-controlled monster truck' }
  if (/car|buggy|remote|rc/.test(text)) return { src: '/products/rc-car-user.png', alt: 'Remote-controlled toy car' }
  if (/phone|iphone|smartphone/.test(text)) return { src: '/products/smartphone.jpg', alt: 'Smartphone' }
  return null
}

function productIllustration(name: string): ProductIllustration {
  const text = name.toLowerCase()
  if (/phone|iphone|smartphone/.test(text)) return { icon: Smartphone, tone: 'coral', label: 'Mobile' }
  if (/earbud|headphone|headset/.test(text)) return { icon: Headphones, tone: 'violet', label: 'Audio' }
  if (/soundbar|speaker/.test(text)) return { icon: Speaker, tone: 'violet', label: 'Audio' }
  if (/watch|fitness band/.test(text)) return { icon: Watch, tone: 'mint', label: 'Wearable' }
  if (/lamp/.test(text)) return { icon: LampDesk, tone: 'mint', label: 'Smart home' }
  if (/smart plug|hub/.test(text)) return { icon: Plug, tone: 'mint', label: 'Connected' }
  if (/camera/.test(text)) return { icon: Camera, tone: 'mint', label: 'Smart home' }
  if (/gaming laptop/.test(text)) return { icon: Gamepad2, tone: 'blue', label: 'Gaming' }
  if (/laptop|workstation|computer|electronic/.test(text)) return { icon: Laptop, tone: 'blue', label: 'Computing' }
  if (/keyboard/.test(text)) return { icon: Keyboard, tone: 'blue', label: 'Accessories' }
  if (/mouse/.test(text)) return { icon: Mouse, tone: 'blue', label: 'Accessories' }
  if (/ssd/.test(text)) return { icon: HardDrive, tone: 'blue', label: 'Storage' }
  if (/monitor/.test(text)) return { icon: Monitor, tone: 'blue', label: 'Display' }
  if (/webcam/.test(text)) return { icon: Webcam, tone: 'blue', label: 'Accessories' }
  if (/science/.test(text)) return { icon: FlaskConical, tone: 'gold', label: 'Learning' }
  if (/puzzle/.test(text)) return { icon: Puzzle, tone: 'gold', label: 'Learning' }
  if (/abacus|counting/.test(text)) return { icon: Calculator, tone: 'gold', label: 'Learning' }
  if (/blocks/.test(text)) return { icon: Blocks, tone: 'gold', label: 'Learning' }
  if (/robot/.test(text)) return { icon: Bot, tone: 'gold', label: 'Robotics' }
  if (/truck/.test(text)) return { icon: Truck, tone: 'coral', label: 'Remote control' }
  if (/boat/.test(text)) return { icon: Ship, tone: 'coral', label: 'Remote control' }
  if (/car|buggy/.test(text)) return { icon: CarFront, tone: 'coral', label: 'Remote control' }
  if (/toy|game|remote|rc/.test(text)) return { icon: ToyBrick, tone: 'gold', label: 'Toys & play' }
  return { icon: Package, tone: 'neutral', label: 'BrightBuy' }
}

export function PackageIcon() {
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="m40 12 26 14v29L40 70 14 55V26l26-14Z" /><path d="m14 26 26 15 26-15M40 41v29M27 19l26 15v14" /></svg>
}

export default function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set())
  const safeImage = src && /^(https?:\/\/|\/[^/])/.test(src) ? src : null
  const photo = productPhoto(name)
  const image = [safeImage, photo?.src].find(candidate => candidate && !failedImages.has(candidate)) ?? null
  const { icon: Icon, tone, label } = productIllustration(name)
  return image
    ? <img src={image} alt={image === safeImage ? name : photo?.alt ?? name} loading="lazy" onError={() => {
      setFailedImages(previous => new Set(previous).add(image))
    }} />
    : <div className={`catalogue-product-art tone-${tone}`} role="img" aria-label={`Illustration of ${name}`}>
      <span className="catalogue-art-orbit" aria-hidden="true" />
      <span className="catalogue-art-object"><Icon aria-hidden="true" /></span>
      <span className="catalogue-art-spark" aria-hidden="true" />
      <span className="catalogue-art-label" aria-hidden="true">{label}</span>
    </div>
}
