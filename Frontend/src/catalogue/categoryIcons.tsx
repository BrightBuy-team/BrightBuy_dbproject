import { Gamepad2, Headphones, Laptop, Package, Smartphone, ToyBrick, Tv, Watch } from 'lucide-react'

/** A fitting icon for a category name. Purely decorative. */
export default function CategoryIcon({ name }: { name: string }) {
  const text = name.toLowerCase()
  if (/phone|mobile/.test(text)) return <Smartphone aria-hidden="true" />
  if (/audio|sound|head/.test(text)) return <Headphones aria-hidden="true" />
  if (/laptop|computer/.test(text)) return <Laptop aria-hidden="true" />
  if (/remote|rc |gaming|game/.test(text)) return <Gamepad2 aria-hidden="true" />
  if (/toy|educat/.test(text)) return <ToyBrick aria-hidden="true" />
  if (/smart|watch|wear/.test(text)) return <Watch aria-hidden="true" />
  if (/electronic|tv|display/.test(text)) return <Tv aria-hidden="true" />
  return <Package aria-hidden="true" />
}
