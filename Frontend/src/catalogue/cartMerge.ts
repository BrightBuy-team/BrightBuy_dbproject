import type { CartItem } from './cart'
export function mergeCartLines(saved: CartItem[],guest: CartItem[]): {items:CartItem[];adjusted:boolean} {
 const items=saved.map(i=>({...i}))
 let adjusted=false
 for(const incoming of guest){
  const previous=items.find(i=>i.variantId===incoming.variantId)
  if(previous){
   const stock=Math.min(previous.stockQuantity,incoming.stockQuantity)
   const requested=previous.quantity+incoming.quantity
   Object.assign(previous,incoming,{stockQuantity:stock,quantity:Math.min(stock,requested)})
   if(requested>stock)adjusted=true
  }else if(items.length<100)items.push({...incoming})
  else throw new Error('The combined cart exceeds 100 lines. Review your saved cart before merging.')
 }
 return {items:items.filter(i=>i.quantity>0),adjusted}
}
