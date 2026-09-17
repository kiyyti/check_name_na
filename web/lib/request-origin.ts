// Compare the browser Origin with the actual HTTP Host, not Next's internal
// request URL (which can contain localhost behind the server adapter).
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin'),host=req.headers.get('host');
 if(!origin||!host)return false;
 try{const url=new URL(origin);return url.origin===origin&&url.host===host&&['https:','http:'].includes(url.protocol)&&(!process.env.VERCEL||url.protocol==='https:');}
 catch{return false;}
}
