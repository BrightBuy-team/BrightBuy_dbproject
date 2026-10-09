import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiBase, apiRequest } from './catalogue/client'
import type { SessionUser } from './catalogue/session'
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
    const guest=sessionStorage.getItem('brightbuy_cart_guest')
    if(guest && !sessionStorage.getItem('brightbuy_cart_'+user.email)) {
     sessionStorage.setItem('brightbuy_cart_'+user.email,guest)
     sessionStorage.removeItem('brightbuy_cart_guest')
    }
    localStorage.setItem('currentUserEmail',user.email)
   } else localStorage.removeItem('currentUserEmail')
   localStorage.removeItem('role');localStorage.removeItem('mockUsers')
   window.location.assign('/catalogue.html')
  } catch {setError(register?'Registration or login failed. Try another email or check your details.':'Sign-in failed. Check your credentials and account type.')}
  finally{setBusy(false)}
 }
 return <main className="catalogue-detail-state"><h1>{register?'Create customer account':'Sign in'}</h1>
  <form onSubmit={submit}>
   {register&&<><label>First name<input name="firstName" required maxLength={100}/></label>
    <label>Last name<input name="lastName" required maxLength={100}/></label></>}
   <label>Email<input name="email" type="email" required autoComplete="username" maxLength={150}/></label>
   <label>Password<input name="password" type="password" required minLength={register?8:1} maxLength={72} autoComplete={register?'new-password':'current-password'}/></label>
   {!register&&<label>Account type<select name="accountType"><option value="CUSTOMER">Customer</option><option value="EMPLOYEE">Employee</option></select></label>}
   {error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?'Please wait…':register?'Register and sign in':'Sign in'}</button>
  </form><button onClick={()=>{setRegister(!register);setError('')}}>{register?'Already registered? Sign in':'Create an account'}</button>
  <p><a href="/catalogue.html">Browse without signing in</a></p>
 </main>
}
