import { readStoredCart, customerCartKey, guestCartKey } from './catalogue/cart'
import { mergeCartLines } from './catalogue/cartMerge'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiBase, apiRequest } from './catalogue/client'
import type { SessionUser } from './catalogue/session'
import './LoginPage.css'
export default function LoginPage() {
 const [register,setRegister]=useState(false)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('')
  const data=new FormData(event.currentTarget)
  const email=String(data.get('email')||'')
  const password=String(data.get('password')||'')
  try {
   if(register) await apiRequest(apiBase('auth')+'/register',{method:'POST',body:JSON.stringify({
    firstName:data.get('firstName'),lastName:data.get('lastName'),email,password
   })})
   const {user}=await apiRequest<{user:SessionUser}>(apiBase('auth')+'/login',{method:'POST',
    body:JSON.stringify({email,password,accountType:register?'CUSTOMER':data.get('accountType')})})
   // A namespace for browser cart storage only; never used as authorization.
   if(user.accountType==='CUSTOMER') {
    const key=customerCartKey(user.email)
    localStorage.setItem('currentUserEmail',user.email)
    try {
     const merged=mergeCartLines(readStoredCart(key),readStoredCart(guestCartKey))
     sessionStorage.setItem(key,JSON.stringify(merged.items))
     sessionStorage.removeItem(guestCartKey)
     if(merged.adjusted)sessionStorage.setItem('brightbuy_cart_notice','Combined cart quantities were capped to the last known stock. Review before checkout; stock is not reserved.')
     else sessionStorage.removeItem('brightbuy_cart_notice')
    } catch {
     sessionStorage.setItem('brightbuy_cart_notice','You are signed in, but your carts could not be combined. Guest items were retained. Review the saved cart before checkout.')
    }
   } else localStorage.removeItem('currentUserEmail')
   localStorage.removeItem('role');localStorage.removeItem('mockUsers')
   window.location.assign('/catalogue.html')
  } catch {setError(register?'Registration or login failed. Try another email or check your details.':'Sign-in failed. Check your credentials and account type.')}
  finally{setBusy(false)}
 }
 return <main className="login-container"><section className="login-left"><div className="login-branding"><div className="login-logo-icon">b.</div><span className="login-logo-text">BrightBuy</span></div><h1>{register?'Create customer account':'Sign in'}</h1><p>Good finds. Everyday possibilities.</p></section><section className="login-right"><div className="login-form-container">
  <h2 className="login-title">{register?'Create customer account':'Sign in'}</h2>
  <form className="login-form" onSubmit={submit}>
   {register&&<><label>First name<input name="firstName" required maxLength={100}/></label>
    <label>Last name<input name="lastName" required maxLength={100}/></label></>}
   <label>Email<input name="email" type="email" required autoComplete="username" maxLength={150}/></label>
   <label>Password<input name="password" type="password" required minLength={register?8:1} maxLength={72} autoComplete={register?'new-password':'current-password'}/></label>
   {!register&&<label>Account type<select name="accountType"><option value="CUSTOMER">Customer</option><option value="EMPLOYEE">Employee</option></select></label>}
   {error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?'Please wait…':register?'Register and sign in':'Sign in'}</button>
  </form><button onClick={()=>{setRegister(!register);setError('')}}>{register?'Already registered? Sign in':'Create an account'}</button>
  <p><a href="/catalogue.html">Browse without signing in</a></p>
 </div></section></main>
}
